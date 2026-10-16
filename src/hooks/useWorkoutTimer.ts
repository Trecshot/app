import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const STORAGE_KEY = '@gym_session_timer_state';
const KEEP_AWAKE_TAG = 'workout-session';

/**
 * Estado persistido del cronómetro.
 * El tiempo NUNCA se acumula sumando +1 por segundo: se calcula como
 *   T_total = accumulatedMs + (Date.now() - startTimestamp)
 * así sobrevive a segundo plano, pantalla bloqueada o cierre del proceso.
 */
interface PersistedTimerState {
  sessionActive: boolean;        // Se pulsó "Comenzar" y aún no se finaliza/reinicia
  isRunning: boolean;            // true = corriendo, false = pausado
  startTimestamp: number | null; // Date.now() del último inicio/reanudación
  accumulatedMs: number;         // Tiempo acumulado antes de la última pausa
}

const INITIAL_STATE: PersistedTimerState = { sessionActive: false, isRunning: false, startTimestamp: null, accumulatedMs: 0 };

const computeSeconds = ({ isRunning, startTimestamp, accumulatedMs }: PersistedTimerState): number => {
  const liveMs = isRunning && startTimestamp !== null ? Math.max(0, Date.now() - startTimestamp) : 0;
  return Math.floor((accumulatedMs + liveMs) / 1000);
};

const isPersistedState = (value: unknown): value is PersistedTimerState => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.sessionActive === 'boolean'
    && typeof v.isRunning === 'boolean'
    && (v.startTimestamp === null || typeof v.startTimestamp === 'number')
    && typeof v.accumulatedMs === 'number';
};

export const formatTime = (totalSecs: number): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(Math.floor(totalSecs / 3600))}:${pad(Math.floor((totalSecs % 3600) / 60))}:${pad(totalSecs % 60)}`;
};

export const useWorkoutTimer = () => {
  const stateRef = useRef<PersistedTimerState>(INITIAL_STATE);
  const [timerState, setTimerState] = useState<PersistedTimerState>(INITIAL_STATE);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);

  const sync = useCallback(() => setElapsedSeconds(computeSeconds(stateRef.current)), []);

  const commit = useCallback(async (next: PersistedTimerState) => {
    stateRef.current = next;
    setTimerState(next);
    setElapsedSeconds(computeSeconds(next));
    try {
      if (next.sessionActive) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error al persistir el estado del cronómetro:', error);
    }
  }, []);

  // 1. Restaurar la sesión al abrir la app (aunque el SO haya matado el proceso)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (!cancelled && isPersistedState(parsed)) {
          stateRef.current = parsed;
          setTimerState(parsed);
          setElapsedSeconds(computeSeconds(parsed));
        }
      } catch (error) {
        console.error('Error al cargar el cronómetro:', error);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2. Recalcular de inmediato al volver de segundo plano
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    return () => subscription.remove();
  }, [sync]);

  // 3. Refrescar la UI cada segundo solo mientras corre (el valor sale del reloj del sistema)
  useEffect(() => {
    if (!timerState.isRunning) return undefined;
    const interval = setInterval(sync, 1000);
    return () => clearInterval(interval);
  }, [timerState.isRunning, sync]);

  // 4. Mantener la pantalla encendida mientras el entrenamiento corre
  useEffect(() => {
    if (!timerState.isRunning) return undefined;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => { void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined); };
  }, [timerState.isRunning]);

  /** Inicia la sesión o la reanuda si estaba pausada. */
  const start = useCallback(async () => {
    const current = stateRef.current;
    if (current.isRunning) return;
    await commit({ ...current, sessionActive: true, isRunning: true, startTimestamp: Date.now() });
  }, [commit]);

  /** Pausa consolidando el tiempo transcurrido en accumulatedMs. */
  const pause = useCallback(async () => {
    const current = stateRef.current;
    if (!current.isRunning || current.startTimestamp === null) return;
    const accumulatedMs = current.accumulatedMs + Math.max(0, Date.now() - current.startTimestamp);
    await commit({ ...current, isRunning: false, startTimestamp: null, accumulatedMs });
  }, [commit]);

  const toggle = useCallback(async () => {
    if (stateRef.current.isRunning) await pause();
    else await start();
  }, [pause, start]);

  /** Lee el total exacto sin detener el cronómetro (útil para guardar antes de resetear). */
  const getElapsedSeconds = useCallback(() => computeSeconds(stateRef.current), []);

  /** Detiene, limpia el almacenamiento y vuelve a cero. */
  const reset = useCallback(async () => { await commit(INITIAL_STATE); }, [commit]);

  return {
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    isRunning: timerState.isRunning,
    sessionActive: timerState.sessionActive,
    isHydrated,
    start,
    pause,
    toggle,
    reset,
    getElapsedSeconds,
  };
};
