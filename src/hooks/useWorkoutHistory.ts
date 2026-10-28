import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { WorkoutRepository } from '../db/repositories/WorkoutRepository';
import { formatBlockStartDate, useSessionStore } from '../store/useSessionStore';
import type { SesionEntrenamiento, TrainingBlock, WeeklySummary } from '../../types';

export interface WorkoutBlockSection {
  /** Ej: "Semana de Carga · Iniciado el 23 de octubre" */
  title: string;
  /** Sesiones pertenecientes al bloque */
  data: SesionEntrenamiento[];
  /** Cantidad de sesiones del bloque */
  sessionCount: number;
  /** Clave estable del bloque (id o 'sin-bloque') */
  key: string;
  block?: TrainingBlock;
}

export function getBlockSectionTitle(block?: TrainingBlock): string {
  if (!block) return 'Sin bloque asignado';
  const label = block.type === 'carga' ? 'Carga' : 'Descarga';
  const initiated = formatBlockStartDate(block.startDate);
  return initiated ? `Semana de ${label} · ${initiated}` : `Semana de ${label}`;
}

/**
 * Reductor: agrupa la lista plana de sesiones (ya ordenada por bloque desde SQLite)
 * en secciones por `training_blocks`, preservando el orden de llegada.
 */
export function groupSessionsByBlock(sessions: readonly SesionEntrenamiento[]): WorkoutBlockSection[] {
  const sections = sessions.reduce<Map<string, WorkoutBlockSection>>((acc, session) => {
    const key = session.blockId ?? 'sin-bloque';
    const section = acc.get(key);
    if (section) {
      section.data.push(session);
      section.sessionCount += 1;
    } else {
      acc.set(key, {
        key,
        block: session.block,
        title: getBlockSectionTitle(session.block),
        data: [session],
        sessionCount: 1,
      });
    }
    return acc;
  }, new Map());
  return Array.from(sections.values());
}

export interface UseWorkoutHistoryResult {
  readonly history: readonly SesionEntrenamiento[];
  readonly sections: readonly WorkoutBlockSection[];
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
      await WorkoutRepository.deleteWorkoutById(workoutId);
      // Actualiza la lista local quitando la sesión borrada
      setHistory((items) => items.filter((item) => item.id !== workoutId));
      setWeeklySummary(await WorkoutRepository.getWeeklySummary());

      // IMPORTANTE: Refrescar el estado del bloque en el store global para actualizar el contador (ej. 2/7 -> 1/7)
      await useSessionStore.getState().initBlock();
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

  const sections = useMemo(() => groupSessionsByBlock(history), [history]);

  return {
    history,
    sections,
    weeklySummary,
    loading,
    refreshHistory,
    deleteWorkout,
  };
}
