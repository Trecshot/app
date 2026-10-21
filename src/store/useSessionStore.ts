import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@gym_session_timer_state';

interface PersistedSessionTimer {
  isActive: boolean;
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedMs: number;
}

const isPersistedSessionTimer = (value: unknown): value is PersistedSessionTimer => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.isActive === 'boolean' &&
    typeof v.isRunning === 'boolean' &&
    (v.startTimestamp === null || typeof v.startTimestamp === 'number') &&
    typeof v.accumulatedMs === 'number'
  );
};

const persistState = (state: PersistedSessionTimer): void => {
  if (state.isActive) {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) => {
      console.error('Error al persistir el estado de la sesión:', error);
    });
  } else {
    void AsyncStorage.removeItem(STORAGE_KEY).catch((error) => {
      console.error('Error al limpiar el estado de la sesión:', error);
    });
  }
};

export interface SessionState {
  isActive: boolean;
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedMs: number;
  isHydrated: boolean;
  startSession: () => void;
  pauseSession: () => void;
  toggleSession: () => void;
  endSession: () => void;
  hydrateSession: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  isRunning: false,
  startTimestamp: null,
  accumulatedMs: 0,
  isHydrated: false,

  startSession: () => {
    const current = get();
    if (current.isRunning) return;
    const next: PersistedSessionTimer = {
      isActive: true,
      isRunning: true,
      startTimestamp: Date.now(),
      accumulatedMs: current.accumulatedMs,
    };
    set(next);
    persistState(next);
  },

  pauseSession: () => {
    const current = get();
    if (!current.isRunning || current.startTimestamp === null) return;
    const accumulatedMs = current.accumulatedMs + Math.max(0, Date.now() - current.startTimestamp);
    const next: PersistedSessionTimer = {
      isActive: true,
      isRunning: false,
      startTimestamp: null,
      accumulatedMs,
    };
    set(next);
    persistState(next);
  },

  toggleSession: () => {
    if (get().isRunning) {
      get().pauseSession();
    } else {
      get().startSession();
    }
  },

  endSession: () => {
    const next: PersistedSessionTimer = {
      isActive: false,
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,
    };
    set(next);
    persistState(next);
  },

  hydrateSession: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isPersistedSessionTimer(parsed)) {
        set({ ...parsed, isHydrated: true });
        return;
      }
    } catch (error) {
      console.error('Error al hidratar la sesión:', error);
    }
    set({ isHydrated: true });
  },
}));
