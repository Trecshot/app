import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../../database';

export interface FinishWorkoutParams {
  currentWeek: number;
  totalWeeks: number;
  currentSession: number;
  totalSessionsInWeek: number;
}

/**
 * Opción A: Borrado Total de la Planificación.
 * Vacía la estructura de semanas y notas de planificación sin tocar el historial (workouts/exercise_logs).
 *
 * Se ejecuta dentro de una transacción atómica para garantizar consistencia total en SQLite.
 */
export async function clearCurrentPlanning(customDb?: SQLiteDatabase): Promise<void> {
  const db = customDb ?? (await getDatabase());
  await db.withTransactionAsync(async () => {
    // 1. Elimina las notas tácticas ordinales planificadas
    await db.runAsync('DELETE FROM planned_session_notes;');

    // 2. Elimina los bloques de semanas (S1 a SN, Carga y Descarga)
    await db.runAsync('DELETE FROM mesocycle_weeks;');
  });
}

/**
 * Evalúa si los parámetros de la sesión corresponden al cierre definitivo
 * de la última sesión de la última semana del mesociclo programado.
 */
export function isPlanComplete(params: FinishWorkoutParams): boolean {
  const { currentWeek, totalWeeks, currentSession, totalSessionsInWeek } = params;
  const isLastSession = currentSession >= totalSessionsInWeek;
  const isLastWeek = currentWeek >= totalWeeks;
  return isLastWeek && isLastSession;
}
