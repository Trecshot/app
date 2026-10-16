import { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { workoutReducer, type WorkoutState } from './useWorkoutReducer';
import { loadDraft, saveDraft, clearDraft } from '../storage/workoutDraft';
import type { Ejercicio, Serie } from '../../types';

// Utilidades estáticas
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const createEmptySet = (): Serie => ({ id: generateId(), reps: 10, pesoKg: 0 });
export const createEmptyExercise = (): Ejercicio => ({ id: generateId(), nombre: '', grupoMuscular: '', series: [createEmptySet()] });

export const getLocalTodayDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

  return {
    state,
    dispatch,
    isDraftHydrated,
    resetSession,
  };
}
