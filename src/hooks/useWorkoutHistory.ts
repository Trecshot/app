import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { WorkoutRepository } from '../db/repositories/WorkoutRepository';
import type { SesionEntrenamiento, WeeklySummary } from '../../types';

export interface UseWorkoutHistoryResult {
  readonly history: readonly SesionEntrenamiento[];
  readonly weeklySummary: readonly WeeklySummary[];
  readonly loading: boolean;
  readonly refreshHistory: () => Promise<void>;
  readonly deleteWorkout: (workoutId: string) => Promise<void>;
}

export function useWorkoutHistory(): UseWorkoutHistoryResult {
  const [history, setHistory] = useState<SesionEntrenamiento[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    try {
      setLoading(true);
      await WorkoutRepository.initSchema();
      const [sessions, summary] = await Promise.all([
        WorkoutRepository.getSessions(),
        WorkoutRepository.getWeeklySummary(),
      ]);
      setHistory(sessions);
      setWeeklySummary(summary);
    } catch (error) {
      console.error('Error al actualizar historial:', error);
      Alert.alert('No se pudo abrir el historial', 'La base de datos local no respondió.');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteWorkout = useCallback(async (workoutId: string) => {
    try {
      await WorkoutRepository.deleteSession(workoutId);
      setHistory((items) => items.filter((item) => item.id !== workoutId));
      setWeeklySummary(await WorkoutRepository.getWeeklySummary());
    } catch {
      Alert.alert('No se pudo eliminar', 'Inténtalo de nuevo.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        await WorkoutRepository.initSchema();
        const [sessions, summary] = await Promise.all([
          WorkoutRepository.getSessions(),
          WorkoutRepository.getWeeklySummary(),
        ]);
        if (!cancelled) {
          setHistory(sessions);
          setWeeklySummary(summary);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error al cargar historial inicial:', error);
        if (!cancelled) {
          setLoading(false);
          Alert.alert('No se pudo abrir el historial', 'La base de datos local no respondió.');
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    history,
    weeklySummary,
    loading,
    refreshHistory,
    deleteWorkout,
  };
}
