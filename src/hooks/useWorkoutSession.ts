import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import { workoutReducer, type WorkoutState } from './useWorkoutReducer';
import { loadDraft, saveDraft, clearDraft } from '../storage/workoutDraft';
import { getIsoWeekNumber, guardarSesion } from '../../database';
import type { Ejercicio, Serie, SesionEntrenamiento } from '../../types';

// Utilidades estáticas
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const createEmptySet = (): Serie => ({ id: generateId(), reps: 10, pesoKg: 0 });
export const createEmptyExercise = (): Ejercicio => ({ id: generateId(), nombre: '', grupoMuscular: '', series: [createEmptySet()] });

export const getLocalTodayDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

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

export const INITIAL_STATE: WorkoutState = {
  week: 'carga',
  sessionDate: getLocalTodayDate(),
  notes: '',
  exercises: [createEmptyExercise()],
  cardio: null,
};

export function useWorkoutSession() {
  const [state, dispatch] = useReducer(workoutReducer, INITIAL_STATE);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const stateRef = useRef(state);

  // Sincronizar referencia estática para el listener de AppState
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Recuperación del borrador temporal
  useEffect(() => {
    let isCancelled = false;
    void loadDraft().then((draft) => {
      if (isCancelled) return;
      if (draft) {
        dispatch({ type: 'HYDRATE', payload: draft });
      }
      setIsDraftHydrated(true);
    });
    return () => { isCancelled = true; };
  }, []);

  // Motor de Autoguardado (Debouncing)
  useEffect(() => {
    if (!isDraftHydrated) return;
    const timeoutId = setTimeout(() => {
      void saveDraft(state);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [state, isDraftHydrated]);

  // Serialización en plano secundario ante suspensión del SO
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && isDraftHydrated) {
        void saveDraft(stateRef.current);
      }
    });
    return () => subscription.remove();
  }, [isDraftHydrated]);

  const resetSession = useCallback(() => {
    const freshState = { ...INITIAL_STATE, sessionDate: getLocalTodayDate() };
    dispatch({ type: 'RESET', payload: freshState });
    void clearDraft();
  }, []);

  const finishWorkout = useCallback(
    async (timerElapsedSeconds: number): Promise<boolean> => {
      if (!esFechaValida(state.sessionDate)) {
        Alert.alert('Fecha no válida', 'Escribe la fecha con el formato AAAA-MM-DD.');
        return false;
      }
      const validExercises = state.exercises.filter((item) => item.nombre.trim());
      if (!validExercises.length) {
        Alert.alert('Agrega un ejercicio', 'Escribe al menos un nombre antes de guardar.');
        return false;
      }

      const workout: SesionEntrenamiento = {
        id: generateId(),
        fecha: state.sessionDate,
        ...(state.notes.trim() ? { notas: state.notes.trim() } : {}),
        duracionSegundos: timerElapsedSeconds,
        tipoSemana: state.week,
        cycleWeek: getIsoWeekNumber(state.sessionDate),
        ejercicios: validExercises,
        cardio: state.cardio,
      };

      try {
        await guardarSesion(workout);
        resetSession();
        Alert.alert('¡Entrenamiento finalizado!', 'La sesión se guardó correctamente.');
        return true;
      } catch (error) {
        console.error('Error al guardar la sesión:', error);
        Alert.alert('No se pudo guardar', 'Comprueba la base de datos local.');
        return false;
      }
    },
    [state, resetSession],
  );

  return {
    state,
    dispatch,
    isDraftHydrated,
    resetSession,
    finishWorkout,
  };
}
