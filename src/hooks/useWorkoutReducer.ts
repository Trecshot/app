import { useReducer } from 'react';
import type { WorkoutDraft } from '../storage/workoutDraft';
import type { Cardio, Ejercicio, Serie } from '../../types';

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

export const fechaHoyLocal = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export interface WorkoutState {
  week: 'carga' | 'descarga';
  sessionDate: string;
  notes: string;
  exercises: Ejercicio[];
  cardio: Cardio | null;
}

export const createInitialWorkoutState = (): WorkoutState => ({
  week: 'carga',
  sessionDate: fechaHoyLocal(),
  notes: '',
  exercises: [createEjercicio()],
  cardio: null,
});

export type WorkoutAction =
  | { type: 'ADD_EXERCISE' }
  | { type: 'UPDATE_EXERCISE'; payload: { exerciseId: string; name?: string; muscleGroup?: string } }
  | { type: 'REMOVE_EXERCISE'; payload: { exerciseId: string } }
  | { type: 'ADD_SET'; payload: { exerciseId: string } }
  | { type: 'UPDATE_SET'; payload: { exerciseId: string; setId: string; field: 'reps' | 'pesoKg'; value: number } }
  | { type: 'REMOVE_SET'; payload: { exerciseId: string; setId: string } }
  | { type: 'SET_CARDIO'; payload: Cardio | null }
  | { type: 'SET_METADATA'; payload: { week?: 'carga' | 'descarga'; date?: string; notes?: string } }
  | { type: 'HYDRATE_DRAFT'; payload: WorkoutDraft }
  | { type: 'RESET' };

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'ADD_EXERCISE':
      return {
        ...state,
        exercises: [...state.exercises, createEjercicio()],
      };

    case 'UPDATE_EXERCISE':
      return {
        ...state,
        exercises: state.exercises.map((exercise) => {
          if (exercise.id !== action.payload.exerciseId) return exercise;
          return {
            ...exercise,
            ...(action.payload.name !== undefined ? { nombre: action.payload.name } : {}),
            ...(action.payload.muscleGroup !== undefined ? { grupoMuscular: action.payload.muscleGroup } : {}),
          };
        }),
      };

    case 'REMOVE_EXERCISE':
      return {
        ...state,
        exercises:
          state.exercises.length > 1
            ? state.exercises.filter((exercise) => exercise.id !== action.payload.exerciseId)
            : state.exercises,
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

    case 'UPDATE_SET':
      return {
        ...state,
        exercises: state.exercises.map((exercise) => {
          if (exercise.id !== action.payload.exerciseId) return exercise;
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

    case 'SET_CARDIO':
      return {
        ...state,
        cardio: action.payload,
      };

    case 'SET_METADATA':
      return {
        ...state,
        ...(action.payload.week !== undefined ? { week: action.payload.week } : {}),
        ...(action.payload.date !== undefined ? { sessionDate: action.payload.date } : {}),
        ...(action.payload.notes !== undefined ? { notes: action.payload.notes } : {}),
      };

    case 'HYDRATE_DRAFT':
      return {
        ...state,
        week: action.payload.week,
        sessionDate: action.payload.sessionDate,
        notes: action.payload.notes,
        exercises:
          action.payload.exercises && action.payload.exercises.length > 0
            ? action.payload.exercises
            : state.exercises,
        cardio: action.payload.cardio,
      };

    case 'RESET':
      return createInitialWorkoutState();

    default:
      return state;
  }
}

export function useWorkoutReducer(initialState: WorkoutState = createInitialWorkoutState()) {
  return useReducer(workoutReducer, initialState);
}
