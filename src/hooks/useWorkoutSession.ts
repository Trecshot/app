import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { getIsoWeekNumber, guardarSesion } from '../../database';
import { clearDraft, loadDraft, saveDraft, type WorkoutDraft } from '../storage/workoutDraft';
import {
  useWorkoutReducer,
  type WorkoutAction,
  type WorkoutState,
} from './useWorkoutReducer';
import type { SesionEntrenamiento } from '../../types';

const DRAFT_SAVE_DELAY_MS = 400;

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const esFechaValida = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export interface UseWorkoutSessionResult {
  state: WorkoutState;
  dispatch: React.Dispatch<WorkoutAction>;
  finishWorkout: (options: {
    sessionActive: boolean;
    getElapsedSeconds: () => number;
    resetTimer: () => Promise<void>;
  }) => Promise<boolean>;
  draftHydrated: boolean;
  loading: boolean;
}

export function useWorkoutSession(): UseWorkoutSessionResult {
  const [state, dispatch] = useWorkoutReducer();
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. Restaurar el borrador persistido al montar
  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((draft) => {
      if (cancelled) return;
      if (draft) {
        dispatch({ type: 'HYDRATE_DRAFT', payload: draft });
      }
      setDraftHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // 2. Persistir borrador en segundo plano con debounce de 400ms
  const latestDraftRef = useRef<WorkoutDraft | null>(null);
  useEffect(() => {
    if (!draftHydrated) return undefined;
    const draft: WorkoutDraft = {
      week: state.week,
      sessionDate: state.sessionDate,
      notes: state.notes,
      exercises: state.exercises,
      cardio: state.cardio,
    };
    latestDraftRef.current = draft;
    const handle = setTimeout(() => {
      void saveDraft(draft);
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(handle);
  }, [draftHydrated, state]);

  // Asegurar persistencia forzada al pasar a segundo plano
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && latestDraftRef.current) {
        void saveDraft(latestDraftRef.current);
      }
    });
    return () => subscription.remove();
  }, []);

  // 3. Persistencia en SQLite al finalizar entrenamiento
  const finishWorkout = useCallback(
    async (options: {
      sessionActive: boolean;
      getElapsedSeconds: () => number;
      resetTimer: () => Promise<void>;
    }): Promise<boolean> => {
      if (!options.sessionActive) {
        Alert.alert(
          'Sesión no iniciada',
          'Pulsa Comenzar para iniciar el entrenamiento antes de finalizarlo.',
        );
        return false;
      }
      if (!esFechaValida(state.sessionDate)) {
        Alert.alert('Fecha no válida', 'Escribe la fecha con el formato AAAA-MM-DD.');
        return false;
      }
      const validExercises = state.exercises.filter((item) => item.nombre.trim());
      if (!validExercises.length) {
        Alert.alert(
          'Agrega un ejercicio',
          'Escribe al menos un nombre antes de guardar.',
        );
        return false;
      }

      setLoading(true);
      const duracionSegundos = options.getElapsedSeconds();
      const workout: SesionEntrenamiento = {
        id: generateId(),
        fecha: state.sessionDate,
        ...(state.notes.trim() ? { notas: state.notes.trim() } : {}),
        duracionSegundos,
        tipoSemana: state.week,
        cycleWeek: getIsoWeekNumber(state.sessionDate),
        ejercicios: validExercises,
        cardio: state.cardio,
      };

      try {
        await guardarSesion(workout);
        await options.resetTimer();
        dispatch({ type: 'RESET' });
        await clearDraft();
        Alert.alert(
          '¡Entrenamiento finalizado!',
          'La sesión se guardó correctamente.',
        );
        return true;
      } catch {
        Alert.alert('No se pudo guardar', 'Comprueba la base de datos local.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [state, dispatch],
  );

  return {
    state,
    dispatch,
    finishWorkout,
    draftHydrated,
    loading,
  };
}
