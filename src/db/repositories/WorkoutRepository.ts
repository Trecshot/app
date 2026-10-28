import {
  createTrainingBlock,
  deleteWorkoutById,
  findTrainingBlockForDate,
  getCardioBlocksByWorkoutId,
  getIsoWeekNumber,
  getLatestTrainingBlock,
  getMonthlyCardioDistance,
  getWeeklySummary,
  getWorkoutDetails,
  guardarSesion,
  initDatabase,
  obtenerSesiones,
  updateTrainingBlockType,
} from '../../../database';
import type {
  CardioBlock,
  SesionEntrenamiento,
  TrainingBlock,
  WeekType,
  WeeklySummary,
  WorkoutDetails,
} from '../../../types';

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
   * Guarda una sesión completa de entrenamiento.
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
}
