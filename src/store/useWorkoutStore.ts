import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import {
  CatalogExercise,
  getCatalogExerciseById,
  MuscleGroup,
  MUSCLE_GROUPS,
  SetType,
  WorkoutExerciseBlock,
  WorkoutSet,
  CardioBlock,
} from '../../types';

export type { SetType, WorkoutExerciseBlock, WorkoutSet };
// Alias para compatibilidad hacia atrás
export type WorkoutExercise = WorkoutExerciseBlock;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const debouncedAsyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await AsyncStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      void AsyncStorage.setItem(name, value);
    }, 400);
  },
  removeItem: async (name: string): Promise<void> => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    await AsyncStorage.removeItem(name);
  },
};

export interface WorkoutStore {
  sessionFocus: MuscleGroup[];
  exercises: WorkoutExerciseBlock[];
  cardio: CardioBlock[];
  notes: string;
  defaultRestSeconds: number;

  // Acciones de Enfoque de Sesión y Notas
  setSessionFocus: (focus: MuscleGroup[]) => void;
  toggleSessionFocus: (group: MuscleGroup) => void;
  setNotes: (notes: string) => void;
  setDefaultRestSeconds: (seconds: number) => void;

  // Acciones de Ejercicio
  addExercise: (catalogExerciseId?: string, muscleGroup?: MuscleGroup) => void;
  removeExercise: (exerciseId: string) => void;
  selectExercise: (exerciseId: string, exercise: CatalogExercise) => void;
  updateMuscleGroup: (exerciseId: string, muscleGroup: MuscleGroup) => void;
  // Soporte legacy / compatibilidad
  updateExercise: (exerciseId: string, name: string) => void;

  // Acciones de Series
  addSet: (exerciseId: string, setType?: SetType) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => void;
  updateSetType: (exerciseId: string, setId: string, setType: SetType) => void;
  updateSetRestSeconds: (exerciseId: string, setId: string, restSeconds: number) => void;
  updateSetStatus: (setId: string, isCompleted: boolean, exerciseId?: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  completeAllSetsInBlock: (blockId: string) => void;

  // Acciones de Cardio
  addCardioBlock: () => void;
  updateCardioBlock: (id: string, field: keyof CardioBlock, value: any) => void;
  removeCardioBlock: (id: string) => void;

  // Reiniciar
  resetWorkout: () => void;
}

// Generador de IDs únicos criptográficamente seguros
const generateId = () => Crypto.randomUUID();

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      sessionFocus: [],
      exercises: [],
      cardio: [],
      notes: '',
      defaultRestSeconds: 120,

      setSessionFocus: (focus: MuscleGroup[]) => set({ sessionFocus: focus }),

      setNotes: (notes: string) => set({ notes }),

      setDefaultRestSeconds: (seconds: number) =>
        set({ defaultRestSeconds: Math.max(60, seconds) }),

      toggleSessionFocus: (group: MuscleGroup) =>
        set((state) => {
          const exists = state.sessionFocus.includes(group);
          const newFocus = exists
            ? state.sessionFocus.filter((g) => g !== group)
            : [...state.sessionFocus, group];
          return { sessionFocus: newFocus };
        }),

      addExercise: (catalogExerciseId = '', muscleGroup?: MuscleGroup) => {
        const state = get();
        // Si no se especifica grupo, tomar el primer grupo del enfoque o por defecto 'Pecho'
        const initialGroup: MuscleGroup =
          muscleGroup ??
          (state.sessionFocus.length > 0 ? state.sessionFocus[0] : MUSCLE_GROUPS[0]);

        const catalogExercise = catalogExerciseId ? getCatalogExerciseById(catalogExerciseId) : undefined;
        const resolvedGroup = catalogExercise?.muscleGroup ?? initialGroup;

        set((state) => ({
          exercises: [
            ...state.exercises,
            {
              id: generateId(),
              catalogExerciseId: catalogExercise?.id ?? catalogExerciseId,
              selectedMuscleGroup: resolvedGroup,
              name: catalogExercise?.name,
              sets: [
                {
                  id: generateId(),
                  reps: '',
                  weight: '',
                  isCompleted: false,
                  setType: 'NORMAL',
                  restSeconds: state.defaultRestSeconds || 120,
                },
              ],
            },
          ],
        }));
      },

      removeExercise: (exerciseId) =>
        set((state) => ({
          exercises: state.exercises.filter((ex) => ex.id !== exerciseId),
        })),

      selectExercise: (exerciseId, catalogExercise) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId
              ? {
                  ...ex,
                  catalogExerciseId: catalogExercise.id,
                  selectedMuscleGroup: catalogExercise.muscleGroup,
                  name: catalogExercise.name,
                }
              : ex,
          ),
        })),

      updateMuscleGroup: (exerciseId, muscleGroup) =>
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            // Si el ejercicio actual ya no pertenece al nuevo grupo muscular, se limpia el ID
            const currentCatalog = ex.catalogExerciseId
              ? getCatalogExerciseById(ex.catalogExerciseId)
              : null;
            const keepsExercise = currentCatalog && currentCatalog.muscleGroup === muscleGroup;
            return {
              ...ex,
              selectedMuscleGroup: muscleGroup,
              catalogExerciseId: keepsExercise ? ex.catalogExerciseId : '',
              name: keepsExercise ? ex.name : '',
            };
          }),
        })),

      updateExercise: (exerciseId, name) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId ? { ...ex, name } : ex,
          ),
        })),

      addSet: (exerciseId, setType: SetType = 'NORMAL') =>
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.id === exerciseId) {
              const lastSetRest =
                ex.sets.length > 0
                  ? ex.sets[ex.sets.length - 1].restSeconds
                  : undefined;
              return {
                ...ex,
                sets: [
                  ...ex.sets,
                  {
                    id: generateId(),
                    reps: '',
                    weight: '',
                    isCompleted: false,
                    setType,
                    restSeconds: lastSetRest ?? (state.defaultRestSeconds || 120),
                  },
                ],
              };
            }
            return ex;
          }),
        })),

      removeSet: (exerciseId, setId) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId
              ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
              : ex,
          ),
        })),

      updateSet: (exerciseId, setId, field, value) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId
              ? {
                  ...ex,
                  sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
                }
              : ex,
          ),
        })),

      updateSetType: (exerciseId, setId, setType) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId
              ? {
                  ...ex,
                  sets: ex.sets.map((s) => (s.id === setId ? { ...s, setType } : s)),
                }
              : ex,
          ),
        })),

      updateSetRestSeconds: (exerciseId, setId, restSeconds) =>
        set((state) => ({
          defaultRestSeconds: restSeconds,
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId
              ? {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.id === setId ? { ...s, restSeconds } : s,
                  ),
                }
              : ex,
          ),
        })),

      updateSetStatus: (setId, isCompleted, exerciseId) =>
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (exerciseId && ex.id !== exerciseId) return ex;
            if (!ex.sets.some((s) => s.id === setId)) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, isCompleted } : s)),
            };
          }),
        })),

      toggleSetComplete: (exerciseId, setId) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId
              ? {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.id === setId ? { ...s, isCompleted: !s.isCompleted } : s,
                  ),
                }
              : ex,
          ),
        })),

      // Validación masiva: marca todas las series del bloque como completadas
      completeAllSetsInBlock: (blockId) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === blockId
              ? { ...ex, sets: ex.sets.map((s) => ({ ...s, isCompleted: true })) }
              : ex,
          ),
        })),

      // Acciones de Cardio
      addCardioBlock: () =>
        set((state) => ({
          cardio: [
            ...(state.cardio || []),
            { id: Crypto.randomUUID(), type: 'Trote', minutos: 0 },
          ],
        })),

      updateCardioBlock: (id, field, value) =>
        set((state) => ({
          cardio: (state.cardio || []).map((item) =>
            item.id === id ? { ...item, [field]: value } : item,
          ),
        })),

      removeCardioBlock: (id) =>
        set((state) => ({
          cardio: (state.cardio || []).filter((item) => item.id !== id),
        })),

      resetWorkout: () =>
        set({
          sessionFocus: [],
          exercises: [],
          cardio: [],
          notes: '',
        }),
    }),
    {
      name: 'workout-exercises-storage',
      storage: createJSONStorage(() => debouncedAsyncStorage),
    },
  ),
);
