import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Estructura de una serie
export interface WorkoutSet {
  id: string;
  reps: string;
  weight: string;
  isCompleted: boolean;
}

// Estructura de un ejercicio
export interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: WorkoutSet[];
}

export interface WorkoutStore {
  exercises: WorkoutExercise[];
  addExercise: () => void;
  removeExercise: (exerciseId: string) => void;
  updateExercise: (exerciseId: string, name: string) => void;
  updateMuscleGroup: (exerciseId: string, muscleGroup: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  resetWorkout: () => void;
}

// Generador de IDs únicos cortos
const generateId = () => Math.random().toString(36).substring(2, 9);

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      exercises: [],

      addExercise: () =>
        set((state) => ({
          exercises: [
            ...state.exercises,
            {
              id: generateId(),
              name: 'Nuevo Ejercicio',
              muscleGroup: 'General',
              sets: [{ id: generateId(), reps: '', weight: '', isCompleted: false }],
            },
          ],
        })),

      removeExercise: (exerciseId) =>
        set((state) => ({
          exercises: state.exercises.filter((ex) => ex.id !== exerciseId),
        })),

      updateExercise: (exerciseId, name) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId ? { ...ex, name } : ex,
          ),
        })),

      updateMuscleGroup: (exerciseId, muscleGroup) =>
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === exerciseId ? { ...ex, muscleGroup } : ex,
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
                    reps: '', // Forzar valores limpios en cero/vacío
                    weight: '', // Nunca hereda valores de la serie previa
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

      resetWorkout: () =>
        set({
          exercises: [],
        }),
    }),
    {
      name: 'workout-exercises-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
