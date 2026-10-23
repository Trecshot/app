import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  CatalogExercise,
  getCatalogExerciseById,
  MuscleGroup,
  MUSCLE_GROUPS,
  WorkoutExerciseBlock,
  WorkoutSet,
} from '../../types';

export type { WorkoutExerciseBlock, WorkoutSet };
// Alias para compatibilidad hacia atrás
export type WorkoutExercise = WorkoutExerciseBlock;

export interface WorkoutStore {
  sessionFocus: MuscleGroup[];
  exercises: WorkoutExerciseBlock[];

  // Acciones de Enfoque de Sesión
  setSessionFocus: (focus: MuscleGroup[]) => void;
  toggleSessionFocus: (group: MuscleGroup) => void;

  // Acciones de Ejercicio
  addExercise: (catalogExerciseId?: string, muscleGroup?: MuscleGroup) => void;
  removeExercise: (exerciseId: string) => void;
  selectExercise: (exerciseId: string, exercise: CatalogExercise) => void;
  updateMuscleGroup: (exerciseId: string, muscleGroup: MuscleGroup) => void;
  // Soporte legacy / compatibilidad
  updateExercise: (exerciseId: string, name: string) => void;

  // Acciones de Series
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  completeAllSetsInBlock: (blockId: string) => void;

  // Reiniciar
  resetWorkout: () => void;
}

// Generador de IDs únicos cortos
const generateId = () => Math.random().toString(36).substring(2, 9);

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      sessionFocus: [],
      exercises: [],

      setSessionFocus: (focus: MuscleGroup[]) => set({ sessionFocus: focus }),

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
              sets: [{ id: generateId(), reps: '', weight: '', isCompleted: false }],
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

      addSet: (exerciseId) =>
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.id === exerciseId) {
              return {
                ...ex,
                sets: [
                  ...ex.sets,
                  {
                    id: generateId(),
                    reps: '',
                    weight: '',
                    isCompleted: false,
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

      resetWorkout: () =>
        set({
          sessionFocus: [],
          exercises: [],
        }),
    }),
    {
      name: 'workout-exercises-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
