import {
  createTrainingBlock,
  deleteWorkoutById as deleteWorkoutByIdDb,
  findTrainingBlockForDate,
  getCardioBlocksByWorkoutId,
  getDatabase,
  getHistoricalMaxWeights,
  getIsoWeekNumber,
  getLatestTrainingBlock,
  getMonthlyCardioDistance,
  getWeeklySummary,
  getWorkoutDetails,
  guardarSesion,
  initDatabase,
  obtenerSesiones,
  TRAINING_BLOCK_SESSIONS,
  updateTrainingBlockTargetSessions,
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
  WorkoutSet,
} from '../../../types';
import {
  countPRsForActiveWorkoutBlocks,
  toStrictIntegerReps,
  toStrictRealWeight,
} from '../../utils/prEngine';

export class WorkoutRepository {
  private static isInitialized = false;

  /**
   * Inicialización estandarizada de tablas relacionales y migraciones en SQLite (Expo SDK 58).
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
    await guardarSesion(sesion);
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
   * Se ejecuta en una transacción atómica actualizando contadores de bloques y PRs históricos.
   */
  static async deleteWorkoutById(id: string): Promise<void> {
    await deleteWorkoutByIdDb(id);
  }

  // ─── Bloques de entrenamiento (7 días) ─────────────────────────────────────

  static async getLatestBlock(): Promise<TrainingBlock | null> {
    return getLatestTrainingBlock();
  }

  static async findBlockForDate(date: Date = new Date()): Promise<TrainingBlock | null> {
    return findTrainingBlockForDate(date);
  }

  static async createBlock(
    type: WeekType,
    targetSessions: number = TRAINING_BLOCK_SESSIONS,
  ): Promise<TrainingBlock> {
    return createTrainingBlock(type, new Date(), targetSessions);
  }

  static async updateBlockType(blockId: string, type: WeekType): Promise<void> {
    await updateTrainingBlockType(blockId, type);
  }

  static async updateBlockTargetSessions(
    blockId: string,
    targetSessions: number,
  ): Promise<void> {
    await updateTrainingBlockTargetSessions(blockId, targetSessions);
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

  /**
   * Persiste una serie individual con su tipificación (`NORMAL` | `DROP_SET` | `WARMUP`) en `workout_sets`.
   */
  static async addSet(exerciseId: string, set: WorkoutSet): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_sets (id, exercise_id, weight, reps, is_completed, set_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        set.id,
        exerciseId,
        toStrictRealWeight(set.weight),
        toStrictIntegerReps(set.reps),
        set.isCompleted ? 1 : 0,
        set.setType ?? 'NORMAL',
      ],
    );
  }

  async addSet(exerciseId: string, set: WorkoutSet): Promise<void> {
    await WorkoutRepository.addSet(exerciseId, set);
  }
}
