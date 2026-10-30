import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { WorkoutRepository } from '../db/repositories/WorkoutRepository';
import { MesocycleRepository } from '../db/repositories/MesocycleRepository';
import type { MesocycleWeek, PlannedWeekType, TrainingBlock, WeekType } from '../../types';

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

export function plannedTypeToBlockType(type: PlannedWeekType): WeekType {
  return type === 'DESCARGA' ? 'descarga' : 'carga';
}

export function blockTypeToPlannedType(type: WeekType): PlannedWeekType {
  return type === 'descarga' ? 'DESCARGA' : 'CARGA';
}

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

  // Bloques de entrenamiento por N sesiones efectivas (fuente de verdad: SQLite)
  currentBlock: TrainingBlock | null;
  lastBlock: TrainingBlock | null;
  blockStatus: BlockStatus;
  /** Muestra el aviso no bloqueante al alcanzar la sesión 7/7 de sobrecarga (modo manual). */
  showDeloadSuggestion: boolean;
  dismissedBlockSuggestionId: string | null;
  dismissDeloadSuggestion: () => void;
  /** Evalúa el último bloque registrado, su contador de sesiones y el contexto de planificación. */
  initBlock: () => Promise<void>;
  /** Crea un nuevo bloque de sesiones efectivas con el tipo elegido. */
  startNewBlock: (type: WeekType, targetSessions?: number) => Promise<void>;
  /** Selector manual de carga/descarga abierto desde el indicador. */
  isBlockPickerOpen: boolean;
  openBlockPicker: () => void;
  closeBlockPicker: () => void;
  /** Cambia el tipo del bloque vigente (y sincroniza la semana activa si existe planificación). */
  changeCurrentBlockType: (type: WeekType) => Promise<void>;

  // Contexto opcional de Planificación de Mesociclo (Hasta 10 semanas)
  activeWeek: MesocycleWeek | null;
  currentSessionIndex: number;
  activeSessionNote: string | null;
  loadPlanningContext: () => Promise<void>;
  evaluateBlockCompletion: () => Promise<void>;
}

/** Determina si el bloque ya completó su cuota de sesiones efectivas. */
export function isBlockExpired(block: TrainingBlock, _now: number = Date.now()): boolean {
  const target = block.targetSessions ?? BLOCK_TARGET_SESSIONS;
  return (block.sessionCount ?? 0) >= target;
}

/** Número de sesión actual dentro del bloque (1..target), calculado dinámicamente de las sesiones del bloque. */
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

      activeWeek: null,
      currentSessionIndex: 1,
      activeSessionNote: null,

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

      loadPlanningContext: async () => {
        try {
          const activeWeek = await MesocycleRepository.getActiveWeek();
          if (!activeWeek) {
            set({ activeWeek: null, activeSessionNote: null });
            return;
          }

          let currentBlock = get().currentBlock;
          const desiredType = plannedTypeToBlockType(activeWeek.type);
          const desiredTarget = activeWeek.total_planned_sessions || BLOCK_TARGET_SESSIONS;

          // Si no hay bloque aún, crear uno alineado con la semana activa planificada
          if (!currentBlock) {
            currentBlock = await WorkoutRepository.createBlock(desiredType, desiredTarget);
            set({
              currentBlock,
              lastBlock: currentBlock,
              blockStatus: 'active',
            });
          } else {
            // Sincronizar cuota de sesiones del bloque con la semana planificada
            if (currentBlock.targetSessions !== desiredTarget) {
              await WorkoutRepository.updateBlockTargetSessions(
                currentBlock.id,
                desiredTarget,
              );
              currentBlock = { ...currentBlock, targetSessions: desiredTarget };
              set({ currentBlock, lastBlock: currentBlock });
            }
          }

          const completedInBlock = Math.max(0, currentBlock.sessionCount ?? 0);
          const sessionIndex = Math.min(desiredTarget, completedInBlock + 1);
          const note = await MesocycleRepository.getNoteForSession(
            activeWeek.id,
            sessionIndex,
          );

          set({
            activeWeek,
            currentSessionIndex: sessionIndex,
            activeSessionNote: note,
          });
        } catch (error) {
          console.error('Error al cargar el contexto de planificación:', error);
        }
      },

      evaluateBlockCompletion: async () => {
        try {
          const [latest, history, activeWeek] = await Promise.all([
            WorkoutRepository.getLatestBlock(),
            WorkoutRepository.getSessions(),
            MesocycleRepository.getActiveWeek(),
          ]);

          if (!latest || !activeWeek) {
            return;
          }

          const sesionesEnBloque = history.filter((s) => s.blockId === latest.id).length;
          const target = activeWeek.total_planned_sessions || BLOCK_TARGET_SESSIONS;

          if (sesionesEnBloque >= target) {
            // El bloque actual completó su cuota (ej. 7/7): avanzar puntero a la siguiente semana planificada
            const nextWeek = await MesocycleRepository.advanceToNextWeek(
              activeWeek.id,
              activeWeek.week_number,
            );

            if (nextWeek) {
              const nextBlockType = plannedTypeToBlockType(nextWeek.type);
              const nextTarget = nextWeek.total_planned_sessions || BLOCK_TARGET_SESSIONS;
              const newBlock = await WorkoutRepository.createBlock(nextBlockType, nextTarget);
              const firstNote = await MesocycleRepository.getNoteForSession(nextWeek.id, 1);

              set({
                currentBlock: newBlock,
                lastBlock: newBlock,
                blockStatus: 'active',
                showDeloadSuggestion: false,
                activeWeek: nextWeek,
                currentSessionIndex: 1,
                activeSessionNote: firstNote,
              });
              return;
            }
          }
        } catch (error) {
          console.error('Error al evaluar la transición del mesociclo:', error);
        }
      },

      initBlock: async () => {
        try {
          const [latest, history, activeWeek] = await Promise.all([
            WorkoutRepository.getLatestBlock(),
            WorkoutRepository.getSessions(),
            MesocycleRepository.getActiveWeek(),
          ]);

          if (latest) {
            const sesionesEnBloque = history.filter((s) => s.blockId === latest.id).length;
            const target = activeWeek
              ? activeWeek.total_planned_sessions || BLOCK_TARGET_SESSIONS
              : latest.targetSessions ?? BLOCK_TARGET_SESSIONS;

            // Si existe planificación activa y el bloque alcanzó la cuota, transicionar automáticamente a la siguiente semana
            if (activeWeek && sesionesEnBloque >= target) {
              const nextWeek = await MesocycleRepository.advanceToNextWeek(
                activeWeek.id,
                activeWeek.week_number,
              );
              if (nextWeek) {
                const nextBlockType = plannedTypeToBlockType(nextWeek.type);
                const nextTarget = nextWeek.total_planned_sessions || BLOCK_TARGET_SESSIONS;
                const newBlock = await WorkoutRepository.createBlock(
                  nextBlockType,
                  nextTarget,
                );
                const firstNote = await MesocycleRepository.getNoteForSession(
                  nextWeek.id,
                  1,
                );
                set({
                  currentBlock: newBlock,
                  lastBlock: newBlock,
                  blockStatus: 'active',
                  showDeloadSuggestion: false,
                  activeWeek: nextWeek,
                  currentSessionIndex: 1,
                  activeSessionNote: firstNote,
                });
                return;
              }
            }

            const syncedBlock: TrainingBlock = {
              ...latest,
              sessionCount: sesionesEnBloque,
              targetSessions: target,
            };

            const reachedTarget = sesionesEnBloque >= target;
            // Solo mostrar sugerencia manual si no hay semana de planificación activa
            const shouldSuggestDeload =
              !activeWeek &&
              reachedTarget &&
              syncedBlock.type === 'carga' &&
              get().dismissedBlockSuggestionId !== syncedBlock.id;

            const sessionIndex = Math.min(target, sesionesEnBloque + 1);
            const note = activeWeek
              ? await MesocycleRepository.getNoteForSession(activeWeek.id, sessionIndex)
              : null;

            set({
              currentBlock: syncedBlock,
              lastBlock: syncedBlock,
              blockStatus: 'active',
              showDeloadSuggestion: shouldSuggestDeload,
              activeWeek: activeWeek ?? null,
              currentSessionIndex: sessionIndex,
              activeSessionNote: note,
            });
          } else if (activeWeek) {
            // Si el usuario creó una planificación antes de tener bloques, inicializar el bloque según la Semana Activa
            const initialType = plannedTypeToBlockType(activeWeek.type);
            const target = activeWeek.total_planned_sessions || BLOCK_TARGET_SESSIONS;
            const block = await WorkoutRepository.createBlock(initialType, target);
            const firstNote = await MesocycleRepository.getNoteForSession(activeWeek.id, 1);

            set({
              currentBlock: block,
              lastBlock: block,
              blockStatus: 'active',
              isBlockPickerOpen: false,
              showDeloadSuggestion: false,
              activeWeek,
              currentSessionIndex: 1,
              activeSessionNote: firstNote,
            });
          } else {
            set({
              currentBlock: null,
              lastBlock: null,
              blockStatus: 'needs_new',
              isBlockPickerOpen: false,
              showDeloadSuggestion: false,
              activeWeek: null,
              currentSessionIndex: 1,
              activeSessionNote: null,
            });
          }
        } catch (error) {
          console.error('Error al evaluar el bloque de entrenamiento:', error);
        }
      },

      startNewBlock: async (type, targetSessions) => {
        const { activeWeek } = get();
        const target =
          targetSessions ??
          activeWeek?.total_planned_sessions ??
          BLOCK_TARGET_SESSIONS;
        const block = await WorkoutRepository.createBlock(type, target);

        if (activeWeek) {
          const plannedType = blockTypeToPlannedType(type);
          await MesocycleRepository.updateWeekType(activeWeek.id, plannedType);
          const updatedWeek: MesocycleWeek = { ...activeWeek, type: plannedType };
          const firstNote = await MesocycleRepository.getNoteForSession(
            activeWeek.id,
            1,
          );
          set({
            currentBlock: block,
            lastBlock: block,
            blockStatus: 'active',
            isBlockPickerOpen: false,
            showDeloadSuggestion: false,
            dismissedBlockSuggestionId: null,
            activeWeek: updatedWeek,
            currentSessionIndex: 1,
            activeSessionNote: firstNote,
          });
          return;
        }

        set({
          currentBlock: block,
          lastBlock: block,
          blockStatus: 'active',
          isBlockPickerOpen: false,
          showDeloadSuggestion: false,
          dismissedBlockSuggestionId: null,
          currentSessionIndex: 1,
        });
      },

      isBlockPickerOpen: false,
      openBlockPicker: () => set({ isBlockPickerOpen: true }),
      closeBlockPicker: () => set({ isBlockPickerOpen: false }),

      changeCurrentBlockType: async (type) => {
        const { currentBlock, activeWeek } = get();
        if (!currentBlock || isBlockExpired(currentBlock)) {
          await get().startNewBlock(type);
          return;
        }
        if (currentBlock.type !== type) {
          await WorkoutRepository.updateBlockType(currentBlock.id, type);
        }
        let updatedActiveWeek = activeWeek;
        if (activeWeek) {
          const plannedType = blockTypeToPlannedType(type);
          await MesocycleRepository.updateWeekType(activeWeek.id, plannedType);
          updatedActiveWeek = { ...activeWeek, type: plannedType };
        }
        const updated = { ...currentBlock, type };
        set({
          currentBlock: updated,
          lastBlock: updated,
          blockStatus: 'active',
          isBlockPickerOpen: false,
          showDeloadSuggestion: false,
          activeWeek: updatedActiveWeek,
        });
      },
    }),
    {
      name: 'workout-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo se persiste el cronómetro; el bloque y la planificación se rehidratan desde SQLite.
      partialize: (state) => ({
        isActive: state.isActive,
        isRunning: state.isRunning,
        startTimestamp: state.startTimestamp,
        accumulatedMs: state.accumulatedMs,
      }),
    },
  ),
);
