import { getDatabase } from '../../../database';
import type {
  MesocycleWeek,
  PlannedSessionConfig,
  SessionNote,
  WeekType as PlannedWeekType,
} from '../../../types/mesocycle';
import type { MuscleGroup } from '../../../types/workout';
import { sanitizeTacticalNote } from '../../utils/textSanitizer';

function parseJsonArray<T>(val: unknown): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface RawSessionNoteRow {
  id: number;
  week_id: number;
  session_index: number;
  session_note: string;
  target_muscles?: string | null;
  preset_exercise_ids?: string | null;
}

interface MesocycleWeekRow {
  id: number;
  week_number: number;
  type: PlannedWeekType;
  total_planned_sessions: number;
  week_comment: string | null;
  is_current: number | boolean;
}

function mapRowToMesocycleWeek(row: MesocycleWeekRow): MesocycleWeek {
  return {
    id: Number(row.id),
    week_number: Number(row.week_number),
    type: row.type === 'DESCARGA' ? 'DESCARGA' : 'CARGA',
    total_planned_sessions: Math.max(1, Number(row.total_planned_sessions) || 7),
    week_comment: row.week_comment ?? null,
    is_current: Boolean(row.is_current),
  };
}

export class MesocycleRepository {
  static async getAllWeeks(): Promise<MesocycleWeek[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<MesocycleWeekRow>(
      `SELECT id, week_number, type, total_planned_sessions, week_comment, is_current
       FROM mesocycle_weeks
       ORDER BY week_number ASC, id ASC;`,
    );
    return rows.map(mapRowToMesocycleWeek);
  }

  static async getActiveWeek(): Promise<MesocycleWeek | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<MesocycleWeekRow>(
      `SELECT id, week_number, type, total_planned_sessions, week_comment, is_current
       FROM mesocycle_weeks
       WHERE is_current = 1
       LIMIT 1;`,
    );
    return result ? mapRowToMesocycleWeek(result) : null;
  }

  static async getSessionConfig(
    weekId: number,
    sessionIndex: number,
  ): Promise<PlannedSessionConfig | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<RawSessionNoteRow>(
      `SELECT id, week_id, session_index, session_note, target_muscles, preset_exercise_ids
       FROM planned_session_notes
       WHERE week_id = ? AND session_index = ?
       LIMIT 1;`,
      [weekId, sessionIndex],
    );
    if (!result) return null;
    return {
      session_note: sanitizeTacticalNote(result.session_note ?? ''),
      target_muscles: parseJsonArray<MuscleGroup>(result.target_muscles),
      preset_exercise_ids: parseJsonArray<string>(result.preset_exercise_ids),
    };
  }

  static async getAllSessionConfigsByWeek(): Promise<
    Record<number, Record<number, PlannedSessionConfig>>
  > {
    const db = await getDatabase();
    const rows = await db.getAllAsync<RawSessionNoteRow>(
      `SELECT id, week_id, session_index, session_note, target_muscles, preset_exercise_ids
       FROM planned_session_notes
       ORDER BY week_id ASC, session_index ASC;`,
    );
    const map: Record<number, Record<number, PlannedSessionConfig>> = {};
    for (const row of rows) {
      if (!map[row.week_id]) {
        map[row.week_id] = {};
      }
      map[row.week_id][row.session_index] = {
        session_note: sanitizeTacticalNote(row.session_note ?? ''),
        target_muscles: parseJsonArray<MuscleGroup>(row.target_muscles),
        preset_exercise_ids: parseJsonArray<string>(row.preset_exercise_ids),
      };
    }
    return map;
  }

  static async getNoteForSession(
    weekId: number,
    sessionIndex: number,
  ): Promise<string | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<RawSessionNoteRow>(
      `SELECT id, week_id, session_index, session_note
       FROM planned_session_notes
       WHERE week_id = ? AND session_index = ?
       LIMIT 1;`,
      [weekId, sessionIndex],
    );
    const trimmed = result?.session_note?.trim();
    return trimmed ? sanitizeTacticalNote(trimmed) : null;
  }

  static async getNotesForWeek(weekId: number): Promise<SessionNote[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<RawSessionNoteRow>(
      `SELECT id, week_id, session_index, session_note, target_muscles, preset_exercise_ids
       FROM planned_session_notes
       WHERE week_id = ?
       ORDER BY session_index ASC;`,
      [weekId],
    );
    return rows.map((r) => ({
      id: r.id,
      week_id: r.week_id,
      session_index: r.session_index,
      session_note: sanitizeTacticalNote(r.session_note),
      target_muscles: parseJsonArray<MuscleGroup>(r.target_muscles),
      preset_exercise_ids: parseJsonArray<string>(r.preset_exercise_ids),
    }));
  }

  static async getAllNotesByWeek(): Promise<Record<number, Record<number, string>>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<RawSessionNoteRow>(
      `SELECT id, week_id, session_index, session_note
       FROM planned_session_notes
       ORDER BY week_id ASC, session_index ASC;`,
    );
    const map: Record<number, Record<number, string>> = {};
    for (const row of rows) {
      if (!map[row.week_id]) {
        map[row.week_id] = {};
      }
      map[row.week_id][row.session_index] = sanitizeTacticalNote(row.session_note);
    }
    return map;
  }

  static async advanceToNextWeek(
    currentWeekId: number,
    currentWeekNumber: number,
  ): Promise<MesocycleWeek | null> {
    const db = await getDatabase();
    let nextActive: MesocycleWeek | null = null;

    await db.withTransactionAsync(async () => {
      // Remover flag de semana actual
      await db.runAsync(
        `UPDATE mesocycle_weeks SET is_current = 0 WHERE id = ?;`,
        [currentWeekId],
      );
      // Asignar flag a la siguiente semana si existe
      await db.runAsync(
        `UPDATE mesocycle_weeks SET is_current = 1 WHERE week_number = ?;`,
        [currentWeekNumber + 1],
      );
      const nextRow = await db.getFirstAsync<MesocycleWeekRow>(
        `SELECT id, week_number, type, total_planned_sessions, week_comment, is_current
         FROM mesocycle_weeks
         WHERE is_current = 1
         LIMIT 1;`,
      );
      nextActive = nextRow ? mapRowToMesocycleWeek(nextRow) : null;
    });

    return nextActive;
  }

  static async addWeek(
    type: PlannedWeekType = 'CARGA',
    totalPlannedSessions = 7,
    weekComment: string | null = null,
  ): Promise<MesocycleWeek | null> {
    const db = await getDatabase();
    const existing = await MesocycleRepository.getAllWeeks();
    if (existing.length >= 10) {
      return null;
    }

    const nextWeekNumber = existing.length + 1;
    const hasCurrent = existing.some((w) => w.is_current);
    const isCurrent = hasCurrent ? 0 : 1;
    const cleanSessions = Math.max(1, Math.min(10, Math.round(totalPlannedSessions || 7)));

    const result = await db.runAsync(
      `INSERT INTO mesocycle_weeks (week_number, type, total_planned_sessions, week_comment, is_current)
       VALUES (?, ?, ?, ?, ?);`,
      [nextWeekNumber, type, cleanSessions, weekComment, isCurrent],
    );

    return {
      id: result.lastInsertRowId,
      week_number: nextWeekNumber,
      type,
      total_planned_sessions: cleanSessions,
      week_comment: weekComment,
      is_current: Boolean(isCurrent),
    };
  }

  static async updateWeekType(
    weekId: number,
    type: PlannedWeekType,
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE mesocycle_weeks SET type = ? WHERE id = ?;`,
      [type, weekId],
    );
  }

  static async updateWeekComment(
    weekId: number,
    weekComment: string | null,
  ): Promise<void> {
    const db = await getDatabase();
    const cleaned = weekComment ? sanitizeTacticalNote(weekComment) : null;
    await db.runAsync(
      `UPDATE mesocycle_weeks SET week_comment = ? WHERE id = ?;`,
      [cleaned || null, weekId],
    );
  }

  static async updateWeekPlannedSessions(
    weekId: number,
    totalSessions: number,
  ): Promise<void> {
    const db = await getDatabase();
    const cleanSessions = Math.max(1, Math.min(10, Math.round(totalSessions || 7)));
    await db.runAsync(
      `UPDATE mesocycle_weeks SET total_planned_sessions = ? WHERE id = ?;`,
      [cleanSessions, weekId],
    );
  }

  static async setActiveWeek(weekId: number): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE mesocycle_weeks SET is_current = 0;`);
      await db.runAsync(
        `UPDATE mesocycle_weeks SET is_current = 1 WHERE id = ?;`,
        [weekId],
      );
    });
  }

  static async upsertSessionConfig(
    weekId: number,
    sessionIndex: number,
    config: {
      session_note?: string | null;
      target_muscles?: MuscleGroup[];
      preset_exercise_ids?: string[];
    },
  ): Promise<void> {
    const db = await getDatabase();
    const cleanNote = sanitizeTacticalNote(config.session_note ?? '');
    const targetMuscles = config.target_muscles ?? [];
    const presetExerciseIds = config.preset_exercise_ids ?? [];
    const targetMusclesJson = JSON.stringify(targetMuscles);
    const presetExerciseIdsJson = JSON.stringify(presetExerciseIds);

    const isEmpty =
      !cleanNote && targetMuscles.length === 0 && presetExerciseIds.length === 0;

    if (isEmpty) {
      await db.runAsync(
        `DELETE FROM planned_session_notes WHERE week_id = ? AND session_index = ?;`,
        [weekId, sessionIndex],
      );
      return;
    }

    const existing = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM planned_session_notes WHERE week_id = ? AND session_index = ? LIMIT 1;`,
      [weekId, sessionIndex],
    );

    if (existing) {
      await db.runAsync(
        `UPDATE planned_session_notes
         SET session_note = ?, target_muscles = ?, preset_exercise_ids = ?
         WHERE id = ?;`,
        [cleanNote, targetMusclesJson, presetExerciseIdsJson, existing.id],
      );
    } else {
      await db.runAsync(
        `INSERT INTO planned_session_notes (week_id, session_index, session_note, target_muscles, preset_exercise_ids)
         VALUES (?, ?, ?, ?, ?);`,
        [weekId, sessionIndex, cleanNote, targetMusclesJson, presetExerciseIdsJson],
      );
    }
  }

  static async upsertSessionNote(
    weekId: number,
    sessionIndex: number,
    noteText: string,
  ): Promise<void> {
    const existing = await MesocycleRepository.getSessionConfig(weekId, sessionIndex);
    await MesocycleRepository.upsertSessionConfig(weekId, sessionIndex, {
      session_note: noteText,
      target_muscles: existing?.target_muscles ?? [],
      preset_exercise_ids: existing?.preset_exercise_ids ?? [],
    });
  }

  static async deleteWeek(weekId: number): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      const target = await db.getFirstAsync<MesocycleWeekRow>(
        `SELECT id, week_number, type, total_planned_sessions, week_comment, is_current
         FROM mesocycle_weeks WHERE id = ?;`,
        [weekId],
      );
      await db.runAsync(
        `DELETE FROM planned_session_notes WHERE week_id = ?;`,
        [weekId],
      );
      await db.runAsync(`DELETE FROM mesocycle_weeks WHERE id = ?;`, [weekId]);

      const remaining = await db.getAllAsync<MesocycleWeekRow>(
        `SELECT id, week_number, type, total_planned_sessions, week_comment, is_current
         FROM mesocycle_weeks ORDER BY week_number ASC, id ASC;`,
      );

      for (let i = 0; i < remaining.length; i++) {
        await db.runAsync(
          `UPDATE mesocycle_weeks SET week_number = ? WHERE id = ?;`,
          [i + 1, remaining[i].id],
        );
      }

      if (target?.is_current && remaining.length > 0) {
        const nextIdx = Math.min(
          Math.max(0, Number(target.week_number) - 1),
          remaining.length - 1,
        );
        await db.runAsync(
          `UPDATE mesocycle_weeks SET is_current = 1 WHERE id = ?;`,
          [remaining[nextIdx].id],
        );
      }
    });
  }

  static async clearMesocycle(): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM planned_session_notes;`);
      await db.runAsync(`DELETE FROM mesocycle_weeks;`);
    });
  }

  /**
   * Opción A: Borrado Total de la Planificación.
   * Vacía la estructura de semanas y notas de planificación sin tocar el historial (workouts/exercise_logs).
   */
  static async clearCurrentPlanning(): Promise<void> {
    return this.clearMesocycle();
  }

  /**
   * Crea una plantilla rápida de mesociclo (ej. 5 semanas de Carga + 1 semana de Descarga).
   */
  static async createPresetMesocycle(
    pattern: PlannedWeekType[] = [
      'CARGA',
      'CARGA',
      'CARGA',
      'CARGA',
      'CARGA',
      'DESCARGA',
    ],
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM planned_session_notes;`);
      await db.runAsync(`DELETE FROM mesocycle_weeks;`);

      const capped = pattern.slice(0, 10);
      for (let i = 0; i < capped.length; i++) {
        await db.runAsync(
          `INSERT INTO mesocycle_weeks (week_number, type, total_planned_sessions, week_comment, is_current)
           VALUES (?, ?, 7, NULL, ?);`,
          [i + 1, capped[i], i === 0 ? 1 : 0],
        );
      }
    });
  }
}
