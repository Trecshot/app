import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SessionState {
  isActive: boolean;
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedMs: number;
  startSession: () => void;
  pauseSession: () => void;
  toggleSession: () => void;
  endSession: () => void;
  getElapsedSeconds: () => number;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,

      startSession: () => {
        const current = get();
        if (current.isRunning) return;
        set({
          isActive: true,
          isRunning: true,
          startTimestamp: Date.now(),
        });
      },

      pauseSession: () => {
        const current = get();
        if (!current.isRunning || current.startTimestamp === null) return;
        const accumulatedMs =
          current.accumulatedMs + Math.max(0, Date.now() - current.startTimestamp);
        set({
          isActive: true,
          isRunning: false,
          startTimestamp: null,
          accumulatedMs,
        });
      },

      toggleSession: () => {
        if (get().isRunning) {
          get().pauseSession();
        } else {
          get().startSession();
        }
      },

      endSession: () =>
        set({
          isActive: false,
          isRunning: false,
          startTimestamp: null,
          accumulatedMs: 0,
        }),

      getElapsedSeconds: () => {
        const { isActive, isRunning, startTimestamp, accumulatedMs } = get();
        if (!isActive) return 0;
        const liveMs =
          isRunning && startTimestamp !== null ? Math.max(0, Date.now() - startTimestamp) : 0;
        return Math.floor((accumulatedMs + liveMs) / 1000);
      },
    }),
    {
      name: 'workout-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
