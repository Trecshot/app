import { useReducer } from 'react';
import type { Ejercicio, Serie } from '../../types';

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createSerie = (): Serie => ({
  id: generateId(),
  reps: 10,
  pesoKg: 0,
});

export const createEjercicio = (): Ejercicio => ({
  id: generateId(),
  nombre: '',
  grupoMuscular: '',
  series: [createSerie()],
});

export interface WorkoutState {
  exercises: Ejercicio[];
}

export type WorkoutAction =
  | { type: 'ADD_EXERCISE' }
  | {
      type: 'UPDATE_SET';
      payload: {
        exerciseId: string;
        setId: string;
        field: 'reps' | 'pesoKg';
        value: number;
      };
    }
  | { type: 'REMOVE_EXERCISE'; payload: { exerciseId: string } }
  | { type: 'ADD_SET'; payload: { exerciseId: string } }
  | { type: 'REMOVE_SET'; payload: { exerciseId: string; setId: string } }
  | { type: 'UPDATE_EXERCISE_NAME'; payload: { exerciseId: string; name: string } }
  | { type: 'UPDATE_MUSCLE_GROUP'; payload: { exerciseId: string; muscleGroup: string } }
  | { type: 'SET_EXERCISES'; payload: Ejercicio[] }
  | { type: 'RESET_EXERCISES' };

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'ADD_EXERCISE':
      return {
        ...state,
        exercises: [...state.exercises, createEjercicio()],
      };

    case 'REMOVE_EXERCISE':
      return {
        ...state,
        exercises:
          state.exercises.length > 1
            ? state.exercises.filter((exercise) => exercise.id !== action.payload.exerciseId)
            : state.exercises,
      };

    case 'UPDATE_EXERCISE_NAME':
      return {
        ...state,
        exercises: state.exercises.map((exercise) =>
          exercise.id === action.payload.exerciseId
            ? { ...exercise, nombre: action.payload.name }
            : exercise,
        ),
      };

    case 'UPDATE_MUSCLE_GROUP':
      return {
        ...state,
        exercises: state.exercises.map((exercise) =>
          exercise.id === action.payload.exerciseId
            ? { ...exercise, grupoMuscular: action.payload.muscleGroup }
            : exercise,
        ),
      };

    case 'ADD_SET':
      return {
        ...state,
        exercises: state.exercises.map((exercise) =>
          exercise.id === action.payload.exerciseId
            ? { ...exercise, series: [...exercise.series, createSerie()] }
            : exercise,
        ),
      };

    case 'REMOVE_SET':
      return {
        ...state,
        exercises: state.exercises.map((exercise) => {
          if (exercise.id !== action.payload.exerciseId || exercise.series.length <= 1) {
            return exercise;
          }
          return {
            ...exercise,
            series: exercise.series.filter((set) => set.id !== action.payload.setId),
          };
        }),
      };

    case 'UPDATE_SET':
      return {
        ...state,
        exercises: state.exercises.map((exercise) => {
          if (exercise.id !== action.payload.exerciseId) {
            return exercise;
          }
          return {
            ...exercise,
            series: exercise.series.map((set) =>
              set.id === action.payload.setId
                ? { ...set, [action.payload.field]: action.payload.value }
                : set,
            ),
          };
        }),
      };

    case 'SET_EXERCISES':
      return {
        ...state,
        exercises: action.payload,
      };

    case 'RESET_EXERCISES':
      return {
        ...state,
        exercises: [createEjercicio()],
      };

    default:
      return state;
  }
}

export function useWorkoutReducer(initialExercises?: Ejercicio[]) {
  const [state, dispatch] = useReducer(workoutReducer, {
    exercises: initialExercises && initialExercises.length > 0 ? initialExercises : [createEjercicio()],
  });

  return {
    state,
    exercises: state.exercises,
    dispatch,
  };
}
