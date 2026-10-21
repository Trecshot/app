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

  const fetchHistoryData = useCallback(async () => {
    try {
      await WorkoutRepository.initSchema();
      const [sessions, summary] = await Promise.all([
        WorkoutRepository.getSessions(),
        WorkoutRepository.getWeeklySummary(),
      ]);
      setHistory(sessions);
      setWeeklySummary(summary);
    } catch {
      Alert.alert('No se pudo abrir el historial', 'La base de datos local no respondió.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    await fetchHistoryData();
  }, [fetchHistoryData]);

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
    async function load() {
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
      } catch {
        if (!cancelled) {
          setLoading(false);
          Alert.alert('No se pudo abrir el historial', 'La base de datos local no respondió.');
        }
      }
    }
    void load();
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
