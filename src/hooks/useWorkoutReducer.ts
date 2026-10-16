import type { Cardio, Ejercicio, Serie } from '../../types';

export interface WorkoutState {
  week: 'carga' | 'descarga';
  sessionDate: string;
  notes: string;
  exercises: Ejercicio[];
  cardio: Cardio | null;
}

export type WorkoutAction =
  | { type: 'HYDRATE'; payload: Partial<WorkoutState> }
  | { type: 'SET_METADATA'; payload: { week?: 'carga' | 'descarga'; sessionDate?: string; notes?: string } }
  | { type: 'ADD_EXERCISE'; payload: Ejercicio }
  | { type: 'REMOVE_EXERCISE'; payload: { exerciseId: string } }
  | { type: 'UPDATE_EXERCISE'; payload: { exerciseId: string; nombre?: string; grupoMuscular?: string } }
  | { type: 'ADD_SET'; payload: { exerciseId: string; set: Serie } }
  | { type: 'REMOVE_SET'; payload: { exerciseId: string; setId: string } }
  | { type: 'UPDATE_SET'; payload: { exerciseId: string; setId: string; field: 'reps' | 'pesoKg'; value: number } }
  | { type: 'SET_CARDIO'; payload: Cardio | null }
  | { type: 'RESET'; payload: WorkoutState };

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload };

    case 'SET_METADATA':
      return { ...state, ...action.payload };

    case 'ADD_EXERCISE':
      return { ...state, exercises: [...state.exercises, action.payload] };

    case 'REMOVE_EXERCISE':
      return {
        ...state,
        exercises:
          state.exercises.length > 1
            ? state.exercises.filter((e) => e.id !== action.payload.exerciseId)
            : state.exercises,
      };

    case 'UPDATE_EXERCISE':
      return {
        ...state,
        exercises: state.exercises.map((exercise) =>
          exercise.id === action.payload.exerciseId
            ? { ...exercise, ...action.payload }
            : exercise,
        ),
      };

    case 'ADD_SET':
      return {
        ...state,
        exercises: state.exercises.map((exercise) =>
          exercise.id === action.payload.exerciseId
            ? { ...exercise, series: [...exercise.series, action.payload.set] }
            : exercise,
        ),
      };

    case 'REMOVE_SET':
      return {
        ...state,
        exercises: state.exercises.map((exercise) =>
          exercise.id === action.payload.exerciseId && exercise.series.length > 1
            ? { ...exercise, series: exercise.series.filter((s) => s.id !== action.payload.setId) }
            : exercise,
        ),
      };

    case 'UPDATE_SET':
      return {
        ...state,
        exercises: state.exercises.map((exercise) =>
          exercise.id === action.payload.exerciseId
            ? {
                ...exercise,
                series: exercise.series.map((set) =>
                  set.id === action.payload.setId
                    ? { ...set, [action.payload.field]: action.payload.value }
                    : set,
                ),
              }
            : exercise,
        ),
      };

    case 'SET_CARDIO':
      return { ...state, cardio: action.payload };

    case 'RESET':
      return { ...action.payload };

    default:
      return state;
  }
}
