import { useState, useEffect, useRef, useCallback, SetStateAction, Dispatch } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSessionStore } from '../store/useSessionStore';
import type { Audio } from 'expo-av';
import type { AudioPlayer } from 'expo-audio';

const REST_TIMER_STORAGE_KEY = 'workout-rest-timer-storage-v1';
const REST_KEEP_AWAKE_TAG = 'workout-rest-timer';
const ANDROID_REST_CHANNEL_ID = 'workout-rest-timer-channel';

export interface RestTimerOption {
  label: string;
  seconds: number;
}

/**
 * Opciones de despliegue de 1 minuto a 5 minutos.
 * A partir del minuto 2 incluye intervalos de 30 segundos (2:30, 3:30, 4:30).
 */
export const REST_TIMER_OPTIONS: RestTimerOption[] = [
  { label: '1:00', seconds: 60 },
  { label: '2:00', seconds: 120 },
  { label: '2:30', seconds: 150 },
  { label: '3:00', seconds: 180 },
  { label: '3:30', seconds: 210 },
  { label: '4:00', seconds: 240 },
  { label: '4:30', seconds: 270 },
  { label: '5:00', seconds: 300 },
];

export const formatRestDuration = (sec: number): string => {
  const safe = Math.max(0, Math.round(sec));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, '0')}`;
};

// Verificación previa de módulos nativos antes de llamar require() para evitar RedBox en Expo Go
let notificationHandlerConfigured = false;
let notificationChannelConfigured = false;

function getNotificationsModule(): typeof import('expo-notifications') | null {
  try {
    if (!requireOptionalNativeModule('ExpoNotificationScheduler')) return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    if (!notificationHandlerConfigured && Notifications?.setNotificationHandler) {
      notificationHandlerConfigured = true;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }
    return Notifications;
  } catch {
    return null;
  }
}

async function ensureNotificationChannelAndPermissions(): Promise<
  typeof import('expo-notifications') | null
> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  try {
    if (Platform.OS === 'android' && !notificationChannelConfigured) {
      notificationChannelConfigured = true;
      await Notifications.setNotificationChannelAsync(ANDROID_REST_CHANNEL_ID, {
        name: 'Temporizador de Descanso',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // Continuar de forma segura en Expo Go si los permisos o canales no están disponibles
  }

  return Notifications;
}

function getLegacyAudioModule(): typeof Audio | null {
  try {
    if (!requireOptionalNativeModule('ExponentAV')) return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const av = require('expo-av') as { Audio: typeof Audio };
    return av?.Audio ?? null;
  } catch {
    return null;
  }
}

function createModernAudioPlayer(): AudioPlayer | null {
  try {
    if (!requireOptionalNativeModule('ExpoAudio')) return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoAudio = require('expo-audio') as typeof import('expo-audio');
    if (expoAudio?.createAudioPlayer) {
      return expoAudio.createAudioPlayer(require('../../assets/bell.mp3'));
    }
    return null;
  } catch {
    return null;
  }
}

interface PersistedRestTimerState {
  endTimestamp: number | null;
  activeSetId: string | null;
  durationSeconds: number;
}

// Estado compartido entre instancias del hook basándose en timestamps reales (funciona en segundo plano)
let sharedEndTimestamp: number | null = null;
let sharedActiveSetId: string | null = null;
let sharedDurationSeconds = 120;
let sharedTimeLeft = 0;
let sharedIsActive = false;
let isHydrated = false;
let globalIntervalId: ReturnType<typeof setInterval> | null = null;
let appStateSubscriptionInstalled = false;

type TimerListener = (
  timeLeft: number,
  isActive: boolean,
  activeSetId: string | null,
  durationSeconds: number,
) => void;

const timerSubscribers = new Set<TimerListener>();
const completionCallbacks = new Set<() => void>();

async function persistRestTimerState(): Promise<void> {
  try {
    const payload: PersistedRestTimerState = {
      endTimestamp: sharedEndTimestamp,
      activeSetId: sharedActiveSetId,
      durationSeconds: sharedDurationSeconds,
    };
    await AsyncStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignorar fallos de almacenamiento
  }
}

function notifyTimerSubscribers(
  nextTimeLeft: number,
  nextIsActive: boolean,
  nextActiveSetId: string | null = sharedActiveSetId,
  nextDurationSeconds: number = sharedDurationSeconds,
) {
  sharedTimeLeft = nextTimeLeft;
  sharedIsActive = nextIsActive;
  sharedActiveSetId = nextActiveSetId;
  sharedDurationSeconds = nextDurationSeconds;
  timerSubscribers.forEach((listener) =>
    listener(nextTimeLeft, nextIsActive, nextActiveSetId, nextDurationSeconds),
  );
}

function syncTimerFromClock() {
  if (!sharedIsActive || !sharedEndTimestamp) {
    return;
  }

  const now = Date.now();
  const remainingMs = sharedEndTimestamp - now;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

  if (remainingSec <= 0) {
    const finishedJustNow = remainingMs > -5000;
    sharedEndTimestamp = null;
    notifyTimerSubscribers(0, false, null, sharedDurationSeconds);
    void persistRestTimerState();
    void deactivateKeepAwake(REST_KEEP_AWAKE_TAG).catch(() => undefined);

    if (finishedJustNow) {
      // Disparar alerta háptica y sonora en el primer suscriptor disponible
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      const firstCallback = completionCallbacks.values().next().value;
      if (firstCallback) {
        firstCallback();
      }
    }
    stopGlobalTickerIfIdle();
  } else if (remainingSec !== sharedTimeLeft) {
    notifyTimerSubscribers(
      remainingSec,
      true,
      sharedActiveSetId,
      sharedDurationSeconds,
    );
  }
}

function ensureGlobalTicker() {
  if (!globalIntervalId) {
    globalIntervalId = setInterval(syncTimerFromClock, 500);
  }
  if (!appStateSubscriptionInstalled) {
    appStateSubscriptionInstalled = true;
    AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncTimerFromClock();
      }
    });
  }
}

function stopGlobalTickerIfIdle() {
  if (!sharedIsActive && globalIntervalId) {
    clearInterval(globalIntervalId);
    globalIntervalId = null;
  }
}

async function hydrateRestTimerIfNeeded(): Promise<void> {
  if (isHydrated) return;
  isHydrated = true;

  try {
    const raw = await AsyncStorage.getItem(REST_TIMER_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<PersistedRestTimerState>;
    if (parsed.durationSeconds && parsed.durationSeconds > 0) {
      sharedDurationSeconds = parsed.durationSeconds;
    }

    if (parsed.endTimestamp && parsed.endTimestamp > Date.now()) {
      sharedEndTimestamp = parsed.endTimestamp;
      sharedActiveSetId = parsed.activeSetId ?? null;
      const remainingSec = Math.max(
        0,
        Math.ceil((parsed.endTimestamp - Date.now()) / 1000),
      );
      notifyTimerSubscribers(
        remainingSec,
        true,
        sharedActiveSetId,
        sharedDurationSeconds,
      );
      ensureGlobalTicker();
      void activateKeepAwakeAsync(REST_KEEP_AWAKE_TAG).catch(() => undefined);
    } else if (parsed.endTimestamp) {
      sharedEndTimestamp = null;
      sharedActiveSetId = null;
      await persistRestTimerState();
    }
  } catch {
    // Ignorar errores de hidratación
  }
}

async function scheduleRestNotification(seconds: number): Promise<void> {
  try {
    const Notifications = await ensureNotificationChannelAndPermissions();
    if (!Notifications) return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    if (seconds > 0) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏱ Descanso Finalizado',
          body: 'Es hora de tu siguiente serie.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(seconds)),
          channelId:
            Platform.OS === 'android' ? ANDROID_REST_CHANNEL_ID : undefined,
        },
      });
    }
  } catch {
    // Continuar de forma segura si las notificaciones no están disponibles
  }
}

export interface UseWorkoutTimerReturn {
  timeLeft: number;
  isActive: boolean;
  activeSetId: string | null;
  durationSeconds: number;
  startTimer: (seconds: number, setId?: string) => Promise<void>;
  setTimeLeft: Dispatch<SetStateAction<number>>;
  stopTimer: () => Promise<void>;
}

export const useWorkoutTimer = (): UseWorkoutTimerReturn => {
  const [timeLeft, setTimeLeftInternal] = useState<number>(sharedTimeLeft);
  const [isActive, setIsActiveInternal] = useState<boolean>(sharedIsActive);
  const [activeSetId, setActiveSetIdInternal] = useState<string | null>(
    sharedActiveSetId,
  );
  const [durationSeconds, setDurationSecondsInternal] = useState<number>(
    sharedDurationSeconds,
  );
  const soundRef = useRef<Audio.Sound | null>(null);
  const modernPlayerRef = useRef<AudioPlayer | null>(null);

  // Hidratar estado en segundo plano y suscribir cambios
  useEffect(() => {
    void hydrateRestTimerIfNeeded();

    const listener: TimerListener = (
      nextTime,
      nextActive,
      nextSetId,
      nextDuration,
    ) => {
      setTimeLeftInternal(nextTime);
      setIsActiveInternal(nextActive);
      setActiveSetIdInternal(nextSetId);
      setDurationSecondsInternal(nextDuration);
    };
    timerSubscribers.add(listener);
    return () => {
      timerSubscribers.delete(listener);
    };
  }, []);

  // Precarga del buffer de audio (soporta tanto ExpoAudio en SDK 58 como ExponentAV en dev builds)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const AudioApi = getLegacyAudioModule();
        if (AudioApi?.Sound?.createAsync) {
          const { sound } = await AudioApi.Sound.createAsync(
            require('../../assets/bell.mp3'),
          );
          if (mounted) {
            soundRef.current = sound;
          } else {
            await sound.unloadAsync();
          }
          return;
        }

        const player = createModernAudioPlayer();
        if (mounted && player) {
          modernPlayerRef.current = player;
        } else if (player) {
          player.remove();
        }
      } catch {
        // Fallback silencioso si el hardware de audio no está disponible
      }
    })();

    const playCompletionSound = () => {
      if (soundRef.current) {
        void soundRef.current.replayAsync().catch(() => undefined);
      } else if (modernPlayerRef.current) {
        try {
          void modernPlayerRef.current.seekTo(0);
          modernPlayerRef.current.play();
        } catch {
          // Ignorar fallo de reproducción
        }
      }
    };

    completionCallbacks.add(playCompletionSound);

    return () => {
      mounted = false;
      completionCallbacks.delete(playCompletionSound);
      void soundRef.current?.unloadAsync().catch(() => undefined);
      try {
        modernPlayerRef.current?.remove();
      } catch {
        // Ignorar al desmontar
      }
    };
  }, []);

  const setTimeLeft: Dispatch<SetStateAction<number>> = useCallback((action) => {
    const resolved =
      typeof action === 'function' ? action(sharedTimeLeft) : action;
    const clamped = Math.max(0, Math.round(resolved));
    const nextActive = clamped > 0 ? sharedIsActive : false;
    sharedEndTimestamp = nextActive ? Date.now() + clamped * 1000 : null;
    notifyTimerSubscribers(
      clamped,
      nextActive,
      nextActive ? sharedActiveSetId : null,
      sharedDurationSeconds,
    );
    void persistRestTimerState();
    void scheduleRestNotification(clamped);
  }, []);

  const startTimer = useCallback(async (seconds: number, setId?: string) => {
    const cleanSeconds = Math.max(1, Math.round(seconds));
    const targetSetId = setId ?? sharedActiveSetId;
    sharedEndTimestamp = Date.now() + cleanSeconds * 1000;
    notifyTimerSubscribers(cleanSeconds, true, targetSetId, cleanSeconds);
    ensureGlobalTicker();
    void persistRestTimerState();
    void activateKeepAwakeAsync(REST_KEEP_AWAKE_TAG).catch(() => undefined);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    // Anular notificaciones previas y programar alerta OS en segundo plano
    await scheduleRestNotification(cleanSeconds);
  }, []);

  const stopTimer = useCallback(async () => {
    sharedEndTimestamp = null;
    notifyTimerSubscribers(0, false, null, sharedDurationSeconds);
    stopGlobalTickerIfIdle();
    void persistRestTimerState();
    void deactivateKeepAwake(REST_KEEP_AWAKE_TAG).catch(() => undefined);
    try {
      const Notifications = getNotificationsModule();
      await Notifications?.cancelAllScheduledNotificationsAsync();
    } catch {
      // Ignorar si falla en plataforma no compatible
    }
  }, []);

  return {
    timeLeft,
    isActive,
    activeSetId,
    durationSeconds,
    startTimer,
    setTimeLeft,
    stopTimer,
  };
};

// ─── Cronómetro global de duración de la sesión activa ───────────────────────

const KEEP_AWAKE_TAG = 'workout-session';

export const useSessionElapsedTimer = (): number => {
  const { startTimestamp, isActive, isRunning, accumulatedMs } = useSessionStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive || !isRunning || !startTimestamp) {
      return undefined;
    }

    const updateTime = () => {
      const now = Date.now();
      const currentElapsed = Math.floor(
        (accumulatedMs + Math.max(0, now - startTimestamp)) / 1000,
      );
      setElapsedSeconds(currentElapsed);
    };

    const intervalId = setInterval(updateTime, 1000);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        updateTime();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [isActive, isRunning, startTimestamp, accumulatedMs]);

  useEffect(() => {
    if (!isActive || !isRunning) return undefined;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [isActive, isRunning]);

  if (!isActive) return 0;
  if (!isRunning) return Math.floor(accumulatedMs / 1000);
  return Math.max(Math.floor(accumulatedMs / 1000), elapsedSeconds);
};
