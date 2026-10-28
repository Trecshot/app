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

export const BLOCK_TARGET_SESSIONS = 7;

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Formatea la fecha de inicio de la Sesión 1/7 (ej. "Iniciado el 23 de octubre"). */
export function formatBlockStartDate(isoDate: string): string {
  if (!isoDate) return '';
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    const [, month, day] = parts;
    const monthName = MONTHS_ES[month - 1];
    if (monthName) {
      return `Iniciado el ${day} de ${monthName}`;
    }
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return `Iniciado el ${date.getDate()} de ${MONTHS_ES[date.getMonth()]}`;
}

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

  // Bloques de entrenamiento por 7 sesiones efectivas (fuente de verdad: SQLite)
  currentBlock: TrainingBlock | null;
  lastBlock: TrainingBlock | null;
  blockStatus: BlockStatus;
  /** Muestra el aviso no bloqueante al alcanzar la sesión 7/7 de sobrecarga. */
  showDeloadSuggestion: boolean;
  dismissedBlockSuggestionId: string | null;
  dismissDeloadSuggestion: () => void;
  /** Evalúa el último bloque registrado y su contador de sesiones (1 a 7). */
  initBlock: () => Promise<void>;
  /** Crea un nuevo bloque de 7 sesiones efectivas con el tipo elegido. */
  startNewBlock: (type: WeekType) => Promise<void>;
  /** Selector manual de carga/descarga abierto desde el indicador. */
  isBlockPickerOpen: boolean;
  openBlockPicker: () => void;
  closeBlockPicker: () => void;
  /** Cambia el tipo del bloque vigente (y de sus sesiones ya registradas). */
  changeCurrentBlockType: (type: WeekType) => Promise<void>;
}

/** Determina si el bloque ya completó sus 7 sesiones efectivas. */
export function isBlockExpired(block: TrainingBlock, _now: number = Date.now()): boolean {
  const target = block.targetSessions ?? BLOCK_TARGET_SESSIONS;
  return (block.sessionCount ?? 0) >= target;
}

/** Número de sesión actual dentro del bloque (1..7), calculado dinámicamente de las sesiones del bloque. */
export function getBlockDay(block: TrainingBlock, _now: number = Date.now()): number {
  const target = block.targetSessions ?? BLOCK_TARGET_SESSIONS;
  const sesionesEnBloque = Math.max(0, block.sessionCount ?? 0);
  const numeroSesionActual = Math.min(target, sesionesEnBloque + 1);
  return numeroSesionActual;
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
      showDeloadSuggestion: false,
      dismissedBlockSuggestionId: null,

      dismissDeloadSuggestion: () => {
        const currentId = get().currentBlock?.id ?? null;
        set({
          showDeloadSuggestion: false,
          dismissedBlockSuggestionId: currentId,
        });
      },

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
          const [latest, history] = await Promise.all([
            WorkoutRepository.getLatestBlock(),
            WorkoutRepository.getSessions(),
          ]);
          if (latest) {
            // Conteo dinámico de sesiones reales registradas con el block_id del bloque activo
            const sesionesEnBloque = history.filter((s) => s.blockId === latest.id).length;
            const syncedBlock: TrainingBlock = {
              ...latest,
              sessionCount: sesionesEnBloque,
            };

            const target = syncedBlock.targetSessions ?? BLOCK_TARGET_SESSIONS;
            const reachedSeven = sesionesEnBloque >= target;
            const shouldSuggestDeload =
              reachedSeven &&
              syncedBlock.type === 'carga' &&
              get().dismissedBlockSuggestionId !== syncedBlock.id;

            set({
              currentBlock: syncedBlock,
              lastBlock: syncedBlock,
              blockStatus: 'active',
              showDeloadSuggestion: shouldSuggestDeload,
            });
          } else {
            set({
              currentBlock: null,
              lastBlock: null,
              blockStatus: 'needs_new',
              isBlockPickerOpen: false,
              showDeloadSuggestion: false,
            });
          }
        } catch (error) {
          console.error('Error al evaluar el bloque de entrenamiento:', error);
        }
      },

      startNewBlock: async (type) => {
        const block = await WorkoutRepository.createBlock(type);
        set({
          currentBlock: block,
          lastBlock: block,
          blockStatus: 'active',
          isBlockPickerOpen: false,
          showDeloadSuggestion: false,
          dismissedBlockSuggestionId: null,
        });
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
        set({
          currentBlock: updated,
          lastBlock: updated,
          blockStatus: 'active',
          isBlockPickerOpen: false,
          showDeloadSuggestion: false,
        });
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
