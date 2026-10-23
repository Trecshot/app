import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { WorkoutRepository } from '../db/repositories/WorkoutRepository';
import type { TrainingBlock, WeekType } from '../../types';

/**
 * Estado del bloque semanal:
 * - `idle`: aún no se evaluó contra la base de datos.
 * - `active`: hay un bloque vigente (Date.now() < end_date).
 * - `needs_new`: no existe bloque o el último expiró; el usuario debe elegir carga/descarga.
 */
export type BlockStatus = 'idle' | 'active' | 'needs_new';

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

  // Bloques de entrenamiento (fuente de verdad: SQLite, no se persisten en AsyncStorage)
  currentBlock: TrainingBlock | null;
  lastBlock: TrainingBlock | null;
  blockStatus: BlockStatus;
  /** Evalúa la fecha actual contra el último bloque registrado. */
  initBlock: () => Promise<void>;
  /** Crea un nuevo bloque de 7 días desde hoy con el tipo elegido. */
  startNewBlock: (type: WeekType) => Promise<void>;
  /** Selector manual de carga/descarga abierto desde el indicador. */
  isBlockPickerOpen: boolean;
  openBlockPicker: () => void;
  closeBlockPicker: () => void;
  /** Cambia el tipo del bloque vigente (y de sus sesiones ya registradas). */
  changeCurrentBlockType: (type: WeekType) => Promise<void>;
}

export function isBlockExpired(block: TrainingBlock, now: number = Date.now()): boolean {
  return now >= new Date(block.endDate).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Día actual dentro del bloque (1..7). */
export function getBlockDay(block: TrainingBlock, now: number = Date.now()): number {
  const elapsed = now - new Date(block.startDate).getTime();
  return Math.min(7, Math.max(1, Math.floor(elapsed / DAY_MS) + 1));
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,

      currentBlock: null,
      lastBlock: null,
      blockStatus: 'idle',

      startSession: () => {
        const current = get();
        if (current.isRunning) return;
        set({
          isActive: true,
          isRunning: true,
          startTimestamp: Date.now(),
          accumulatedMs: current.isActive ? current.accumulatedMs : 0,
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

      initBlock: async () => {
        try {
          const latest = await WorkoutRepository.getLatestBlock();
          if (latest && !isBlockExpired(latest)) {
            set({ currentBlock: latest, lastBlock: latest, blockStatus: 'active' });
          } else {
            set({ currentBlock: null, lastBlock: latest, blockStatus: 'needs_new', isBlockPickerOpen: false });
          }
        } catch (error) {
          console.error('Error al evaluar el bloque de entrenamiento:', error);
        }
      },

      startNewBlock: async (type) => {
        const block = await WorkoutRepository.createBlock(type);
        set({ currentBlock: block, lastBlock: block, blockStatus: 'active', isBlockPickerOpen: false });
      },

      isBlockPickerOpen: false,
      openBlockPicker: () => set({ isBlockPickerOpen: true }),
      closeBlockPicker: () => set({ isBlockPickerOpen: false }),

      changeCurrentBlockType: async (type) => {
        const { currentBlock } = get();
        if (!currentBlock || isBlockExpired(currentBlock)) {
          await get().startNewBlock(type);
          return;
        }
        if (currentBlock.type !== type) {
          await WorkoutRepository.updateBlockType(currentBlock.id, type);
        }
        const updated = { ...currentBlock, type };
        set({ currentBlock: updated, lastBlock: updated, blockStatus: 'active', isBlockPickerOpen: false });
      },
    }),
    {
      name: 'workout-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo se persiste el cronómetro; el bloque se rehidrata desde SQLite en cada arranque.
      partialize: (state) => ({
        isActive: state.isActive,
        isRunning: state.isRunning,
        startTimestamp: state.startTimestamp,
        accumulatedMs: state.accumulatedMs,
      }),
    },
  ),
);
