import { Alert } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase, TRAINING_BLOCK_DAYS } from '../../database';
import { Crypto } from '../utils/uuid';

export interface FinishWorkoutParams {
  currentWeek: number;
  totalWeeks: number;
  currentSession: number;
  totalSessionsInWeek: number;
}

/**
 * Mutación Atómica en SQLite:
 * Sincroniza el total de sesiones (3 a 7) de una semana planificada y sus sesiones ordinales.
 */
export async function updateWeekFrequency(
  db: SQLiteDatabase,
  weekId: number,
  newTotal: number,
): Promise<void> {
  const cleanTotal = Math.max(3, Math.min(7, Math.round(newTotal || 7)));
  await db.withTransactionAsync(async () => {
    // 1. Actualizar el valor total en la semana
    await db.runAsync(
      'UPDATE mesocycle_weeks SET total_planned_sessions = ? WHERE id = ?;',
      [cleanTotal, weekId],
    );

    // 2. Si se reduce a 3 (o menor que antes), eliminar de planned_session_notes los ordinales sobrantes (> newTotal)
    await db.runAsync(
      'DELETE FROM planned_session_notes WHERE week_id = ? AND session_index > ?;',
      [weekId, cleanTotal],
    );

    // 3. Si se incrementa, insertar las filas ordinales faltantes vacías
    const currentSessions = await db.getAllAsync<{ session_index: number }>(
      'SELECT session_index FROM planned_session_notes WHERE week_id = ?;',
      [weekId],
    );
    const existingOrdinals = new Set(currentSessions.map((s) => s.session_index));

    for (let ord = 1; ord <= cleanTotal; ord++) {
      if (!existingOrdinals.has(ord)) {
        await db.runAsync(
          'INSERT INTO planned_session_notes (week_id, session_index, session_note, target_muscles, preset_exercise_ids) VALUES (?, ?, "", "[]", "[]");',
          [weekId, ord],
        );
      }
    }
  });
}

/**
 * Diálogo de confirmación al forzar el cierre y avance de la semana activa incompleta.
 */
export function promptForceCloseWeek(
  currentWeekNum: number,
  completedSessions: number,
  totalSessions: number,
  onConfirm: () => void,
): void {
  const pending = Math.max(0, totalSessions - completedSessions);

  Alert.alert(
    'Concluir Semana Activa',
    pending > 0
      ? `Tienes ${pending} sesión(es) pendiente(s) en esta semana (${completedSessions}/${totalSessions}). ¿Deseas cerrar el bloque actual y avanzar a la siguiente semana?`
      : `¿Deseas dar por concluida la Semana ${currentWeekNum} y pasar a la siguiente?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Avanzar de Semana',
        style: 'destructive',
        onPress: onConfirm,
      },
    ],
  );
}

/**
 * Transición de Estado en SQLite al forzar el avance de semana:
 * 1. Marca la semana actual como completada e inactiva.
 * 2. Si existe la siguiente semana (N + 1), la activa y crea un nuevo bloque en `training_blocks` con contador en 0 (Sesión 1/N).
 * 3. Si no existe siguiente semana, desactiva la planificación activa e inicializa bloque limpio en Sesión 1.
 */
export async function forceAdvanceWeek(
  db: SQLiteDatabase,
  currentWeekId: number,
): Promise<{ nextWeekId: number | null; planFinished: boolean }> {
  let nextWeekId: number | null = null;
  let planFinished = false;

  await db.withTransactionAsync(async () => {
    // 1. Marcar la semana actual como completada formalmente
    await db.runAsync(
      'UPDATE mesocycle_weeks SET is_current = 0, is_completed = 1 WHERE id = ?;',
      [currentWeekId],
    );

    // 2. Buscar si ya existe la siguiente semana (Semana N + 1)
    const nextWeek = await db.getFirstAsync<{
      id: number;
      type: string;
      total_planned_sessions: number;
    }>(
      'SELECT id, type, total_planned_sessions FROM mesocycle_weeks WHERE week_number = (SELECT week_number + 1 FROM mesocycle_weeks WHERE id = ?) LIMIT 1;',
      [currentWeekId],
    );

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + TRAINING_BLOCK_DAYS);

    if (nextWeek) {
      nextWeekId = nextWeek.id;
      // Activar la siguiente semana
      await db.runAsync('UPDATE mesocycle_weeks SET is_current = 1 WHERE id = ?;', [
        nextWeek.id,
      ]);

      // Crear bloque nuevo en training_blocks para reiniciar current_session_ordinal a 1 (sessions_count = 0)
      const blockType = nextWeek.type === 'DESCARGA' ? 'descarga' : 'carga';
      const targetSessions = Math.max(
        3,
        Math.min(7, Math.round(nextWeek.total_planned_sessions || 7)),
      );
      await db.runAsync(
        'INSERT INTO training_blocks (id, type, start_date, end_date, sessions_count, target_sessions) VALUES (?, ?, ?, ?, 0, ?);',
        [
          Crypto.randomUUID(),
          blockType,
          start.toISOString(),
          end.toISOString(),
          targetSessions,
        ],
      );
    } else {
      planFinished = true;
      // Si no existe la siguiente, se desactiva la planificación activa (fin del ciclo)
      await db.runAsync('UPDATE mesocycle_weeks SET is_current = 0;');
      await db.runAsync(
        'INSERT INTO training_blocks (id, type, start_date, end_date, sessions_count, target_sessions) VALUES (?, ?, ?, ?, 0, 7);',
        [Crypto.randomUUID(), 'carga', start.toISOString(), end.toISOString()],
      );
    }
  });

  return { nextWeekId, planFinished };
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
