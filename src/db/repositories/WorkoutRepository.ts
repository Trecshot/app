import * as Crypto from 'expo-crypto';
import {
  createTrainingBlock,
  deleteWorkoutById,
  findTrainingBlockForDate,
  getCardioBlocksByWorkoutId,
  getDatabase,
  getHistoricalMaxWeights,
  getIsoWeekNumber,
  getLatestTrainingBlock,
  getMonthlyCardioDistance,
  getWeeklySummary,
  getWorkoutDetails,
  initDatabase,
  obtenerSesiones,
  TRAINING_BLOCK_DAYS,
  TRAINING_BLOCK_SESSIONS,
  updateTrainingBlockType,
} from '../../../database';
import type {
  CardioBlock,
  SesionEntrenamiento,
  TrainingBlock,
  WeekType,
  WeeklySummary,
  WorkoutDetails,
  WorkoutExerciseBlock,
} from '../../../types';
import {
  countPRsForActiveWorkoutBlocks,
  evaluateSessionPRs,
  toStrictIntegerReps,
  toStrictRealWeight,
} from '../../utils/prEngine';

export class WorkoutRepository {
  private static isInitialized = false;

  /**
   * Inicialización estandarizada de tablas relacionales y migraciones en SQLite (Expo SDK 57).
   */
  static async initSchema(): Promise<void> {
    if (WorkoutRepository.isInitialized) return;

    try {
      await initDatabase();
      WorkoutRepository.isInitialized = true;
    } catch (error) {
      console.error('Error al inicializar el esquema de SQLite:', error);
      throw error;
    }
  }

  /**
   * Guarda una sesión completa de entrenamiento en una única transacción atómica en SQLite.
   */
  static async saveSession(
    sesion: SesionEntrenamiento,
    _startTimestamp?: number | null,
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      // Resolver el bloque activo de 7 sesiones efectivas
      let block = sesion.blockId
        ? await db.getFirstAsync<{
            id: string;
            type: WeekType;
            startDate: string;
            endDate: string;
            sessionCount: number;
            targetSessions: number;
          }>(
            `SELECT id, type, start_date AS startDate, end_date AS endDate,
                    (SELECT COUNT(*) FROM workouts w WHERE w.block_id = training_blocks.id) AS sessionCount,
                    COALESCE(target_sessions, ?) AS targetSessions
             FROM training_blocks WHERE id = ?;`,
            [TRAINING_BLOCK_SESSIONS, sesion.blockId],
          )
        : await db.getFirstAsync<{
            id: string;
            type: WeekType;
            startDate: string;
            endDate: string;
            sessionCount: number;
            targetSessions: number;
          }>(
            `SELECT id, type, start_date AS startDate, end_date AS endDate,
                    (SELECT COUNT(*) FROM workouts w WHERE w.block_id = training_blocks.id) AS sessionCount,
                    COALESCE(target_sessions, ?) AS targetSessions
             FROM training_blocks ORDER BY start_date DESC, rowid DESC LIMIT 1;`,
            [TRAINING_BLOCK_SESSIONS],
          );

      const [year, month, day] = sesion.fecha.split('-').map(Number);
      const parsedDate = new Date(year, month - 1, day);
      const startDay = Number.isNaN(parsedDate.getTime())
        ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
        : parsedDate;
      const endDay = new Date(startDay);
      endDay.setDate(endDay.getDate() + TRAINING_BLOCK_DAYS);

      if (!block || (block.sessionCount ?? 0) >= (block.targetSessions ?? TRAINING_BLOCK_SESSIONS)) {
        // Si el bloque anterior ya completó sus 7/7 sesiones (o no existe), iniciar un nuevo bloque sin bloquear al usuario
        const newBlockId = Crypto.randomUUID();
        const newBlockType: WeekType = block?.type ?? sesion.tipoSemana ?? 'carga';
        const startIso = startDay.toISOString();
        const endIso = endDay.toISOString();
        await db.runAsync(
          'INSERT INTO training_blocks (id, type, start_date, end_date, sessions_count, target_sessions) VALUES (?, ?, ?, ?, 0, ?);',
          [newBlockId, newBlockType, startIso, endIso, TRAINING_BLOCK_SESSIONS],
        );
        block = {
          id: newBlockId,
          type: newBlockType,
          startDate: startIso,
          endDate: endIso,
          sessionCount: 0,
          targetSessions: TRAINING_BLOCK_SESSIONS,
        };
      } else if ((block.sessionCount ?? 0) === 0) {
        // Sesión 1/7: almacenar la fecha exacta de inicio de la primera sesión del bloque
        const startIso = startDay.toISOString();
        const endIso = endDay.toISOString();
        await db.runAsync(
          'UPDATE training_blocks SET start_date = ?, end_date = ? WHERE id = ?;',
          [startIso, endIso, block.id],
        );
      }

      const clientId = sesion.id || Crypto.randomUUID();
      const date = sesion.fecha;
      const weekType: WeekType = block?.type ?? sesion.tipoSemana;
      const duration = sesion.duracionSegundos ?? 0;
      const notes = sesion.notas?.trim() ? sesion.notas.trim() : null;
      const blockId = block?.id ?? null;
      const cycleWeek = getIsoWeekNumber(date);
      const sessionFocusJson =
        sesion.sessionFocus && sesion.sessionFocus.length > 0
          ? JSON.stringify(sesion.sessionFocus)
          : null;

      // 0. Validar PRs Absolutos (solo en semana de 'carga', 1 a 5 reps y > MAX(weight) histórico)
      const historicalMaxWeights = await getHistoricalMaxWeights(db);
      const prEvaluation = evaluateSessionPRs(
        sesion.ejercicios,
        historicalMaxWeights,
        weekType,
      );

      // 1. Insertar cabecera de la sesión en 'workouts'
      const workoutResult = await db.runAsync(
        'INSERT INTO workouts (client_id, date, week_type, cycle_week, duration_seconds, notes, session_focus, block_id, prs_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [
          clientId,
          date,
          weekType,
          cycleWeek,
          duration,
          notes,
          sessionFocusJson,
          blockId,
          prEvaluation.totalPrs,
        ],
      );
      const workoutId = workoutResult.lastInsertRowId;

      // 2. Inserción masiva (Bulk Insert) de ejercicios y series en 'exercise_logs' con tipos blindados (INTEGER y REAL)
      const exerciseLogs = prEvaluation.exercises.flatMap((exercise, exerciseOrder) =>
        exercise.series
          .filter((set) => toStrictIntegerReps(set.reps) > 0 && toStrictRealWeight(set.pesoKg) >= 0)
          .map((set, setIndex) => ({
            exerciseId: exercise.id || Crypto.randomUUID(),
            catalogExerciseId: exercise.catalogExerciseId ?? null,
            exerciseOrder,
            setId: set.id || Crypto.randomUUID(),
            exerciseName: exercise.nombre,
            muscleGroup:
              exercise.grupoMuscular?.trim() || exercise.selectedMuscleGroup || 'General',
            setNumber: setIndex + 1,
            reps: toStrictIntegerReps(set.reps),
            weight: toStrictRealWeight(set.pesoKg),
            isPr: set.isPr ? 1 : 0,
          })),
      );

      if (exerciseLogs.length > 0) {
        const placeholders = exerciseLogs
          .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .join(', ');
        const values = exerciseLogs.flatMap((log) => [
          workoutId,
          log.exerciseId,
          log.catalogExerciseId,
          log.exerciseOrder,
          log.exerciseName,
          log.muscleGroup,
          log.setId,
          log.setNumber,
          log.reps,
          log.weight,
          log.isPr,
        ]);
        await db.runAsync(
          `INSERT INTO exercise_logs (
            workout_id, exercise_id, catalog_exercise_id, exercise_order, exercise_name,
            muscle_group, set_id, set_number, reps, weight, is_pr
          ) VALUES ${placeholders};`,
          values,
        );
      }

      if (sesion.cardio) {
        await db.runAsync(
          `INSERT INTO cardio_logs (workout_id, cardio_type, level, distance_km, duration_minutes)
           VALUES (?, ?, ?, ?, ?);`,
          [
            workoutId,
            sesion.cardio.modalidad,
            sesion.cardio.velocidadNivel ?? null,
            sesion.cardio.distanciaKm ?? null,
            sesion.cardio.tiempoMin,
          ],
        );
      }

      // 3. Inserción de bloques de cardio en 'cardio_blocks'
      if (sesion.cardioBlocks && sesion.cardioBlocks.length > 0) {
        await db.runAsync('DELETE FROM cardio_blocks WHERE workout_id = ?;', [workoutId]);
        const placeholders = sesion.cardioBlocks.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = sesion.cardioBlocks.flatMap((cBlock) => [
          Crypto.randomUUID(),
          workoutId,
          cBlock.type,
          cBlock.minutos,
          cBlock.velocidad ?? null,
          cBlock.kilometros ?? null,
          cBlock.saltos ?? null,
        ]);
        await db.runAsync(
          `INSERT INTO cardio_blocks (
            id, workout_id, cardio_type, minutos, velocidad, kilometros, saltos
          ) VALUES ${placeholders};`,
          values,
        );
      }

      // 4. Sincronizar el contador de sesiones efectivas del bloque
      if (blockId) {
        await db.runAsync(
          `UPDATE training_blocks
           SET sessions_count = (SELECT COUNT(*) FROM workouts WHERE block_id = ?)
           WHERE id = ?;`,
          [blockId, blockId],
        );
      }
    });
  }

  static async getSessions(limit = 50, offset = 0): Promise<SesionEntrenamiento[]> {
    return obtenerSesiones(limit, offset);
  }

  static async getWeeklySummary(): Promise<WeeklySummary[]> {
    return getWeeklySummary();
  }

  static async getDetails(workoutId: number | string): Promise<WorkoutDetails> {
    return getWorkoutDetails(workoutId);
  }

  static async getCardioBlocks(workoutId: number): Promise<CardioBlock[]> {
    return getCardioBlocksByWorkoutId(workoutId);
  }

  static async getMonthlyCardioDistance(year: number, month: number): Promise<number> {
    return getMonthlyCardioDistance(year, month);
  }

  static async deleteSession(workoutId: string): Promise<void> {
    await WorkoutRepository.deleteWorkoutById(workoutId);
  }

  /**
   * Elimina un entrenamiento (DELETE FROM workouts WHERE id = ?) junto con sus series y cardio.
   * Se ejecuta en una transacción; las FK con ON DELETE CASCADE actúan como respaldo.
   */
  static async deleteWorkoutById(id: string): Promise<void> {
    await deleteWorkoutById(id);
  }

  // ─── Bloques de entrenamiento (7 días) ─────────────────────────────────────

  static async getLatestBlock(): Promise<TrainingBlock | null> {
    return getLatestTrainingBlock();
  }

  static async findBlockForDate(date: Date = new Date()): Promise<TrainingBlock | null> {
    return findTrainingBlockForDate(date);
  }

  static async createBlock(type: WeekType): Promise<TrainingBlock> {
    return createTrainingBlock(type);
  }

  static async updateBlockType(blockId: string, type: WeekType): Promise<void> {
    await updateTrainingBlockType(blockId, type);
  }

  static getIsoWeekNumber(dateValue: string): number {
    return getIsoWeekNumber(dateValue);
  }

  /**
   * Obtiene el mapa de marcas personales históricas `MAX(weight)` por ejercicio desde SQLite.
   */
  static async getHistoricalMaxWeights(): Promise<Record<string, number>> {
    return getHistoricalMaxWeights();
  }

  /**
   * Calcula cuántos PRs Absolutos se batieron en los bloques activos antes de guardar.
   */
  static async calculateSessionPRsCount(
    blocks: readonly WorkoutExerciseBlock[],
    tipoSemana: WeekType = 'carga',
  ): Promise<number> {
    const historicalMax = await getHistoricalMaxWeights();
    return countPRsForActiveWorkoutBlocks(blocks, historicalMax, tipoSemana);
  }
}
