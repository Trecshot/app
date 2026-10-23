import * as Crypto from 'expo-crypto';
import {
  eliminarSesion,
  getCardioBlocksByWorkoutId,
  getDatabase,
  getIsoWeekNumber,
  getMonthlyCardioDistance,
  getWeeklySummary,
  getWorkoutDetails,
  guardarSesion,
  initDatabase,
  obtenerSesiones,
} from '../../../database';
import type { CardioBlock, SesionEntrenamiento, WeeklySummary, WorkoutDetails } from '../../../types';

export interface SetRecord {
  exerciseName: string;
  weightKg: number;
  reps: number;
}

export type SetLogInput = SetRecord;

export class WorkoutRepository {
  private static isInitialized = false;

  /**
   * Inicialización estandarizada de tablas relacionales y migraciones en SQLite (Expo SDK 57).
   */
  static async initSchema(): Promise<void> {
    if (WorkoutRepository.isInitialized) return;

    try {
      await initDatabase();
      const db = await getDatabase();
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS session (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_time INTEGER NOT NULL,
          end_time INTEGER,
          total_duration_seconds INTEGER
        );
        CREATE TABLE IF NOT EXISTS set_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER,
          exercise_name TEXT,
          weight_kg REAL,
          reps INTEGER,
          FOREIGN KEY(session_id) REFERENCES session(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS cardio_blocks (
          id TEXT PRIMARY KEY,
          workout_id INTEGER,
          session_id INTEGER,
          cardio_type TEXT NOT NULL,
          minutos REAL NOT NULL,
          velocidad REAL,
          kilometros REAL,
          saltos INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES session (id) ON DELETE CASCADE
        );
      `);
      WorkoutRepository.isInitialized = true;
    } catch (error) {
      console.error('Error al inicializar el esquema de SQLite:', error);
      throw error;
    }
  }

  /**
   * Inserta la sesión principal y todas sus series vinculadas en una única transacción atómica (Batching).
   * Si cualquier inserción falla, SQLite realiza rollback automático de toda la transacción.
   */
  static async saveFullWorkout(
    startTime: number,
    endTime: number,
    duration: number,
    sets: SetRecord[],
    cardioBlocks?: CardioBlock[],
  ): Promise<void> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      // 1. Insertar la sesión principal
      const result = await db.runAsync(
        'INSERT INTO session (start_time, end_time, total_duration_seconds) VALUES (?, ?, ?);',
        [startTime, endTime, duration],
      );
      const sessionId = result.lastInsertRowId;

      // 2. Inserción en Bloque (Bulk Insert) de series
      if (sets.length > 0) {
        const placeholders = sets.map(() => '(?, ?, ?, ?)').join(', ');
        const values = sets.flatMap((set) => [sessionId, set.exerciseName, set.weightKg, set.reps]);
        await db.runAsync(
          `INSERT INTO set_log (session_id, exercise_name, weight_kg, reps) VALUES ${placeholders};`,
          values,
        );
      }

      // 3. Inserción en Bloque (Bulk Insert) de bloques de cardio
      if (cardioBlocks && cardioBlocks.length > 0) {
        await db.runAsync('DELETE FROM cardio_blocks WHERE session_id = ?;', [sessionId]);
        const placeholders = cardioBlocks.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = cardioBlocks.flatMap((block) => [
          Crypto.randomUUID(),
          sessionId,
          block.type,
          block.minutos,
          block.velocidad ?? null,
          block.kilometros ?? null,
          block.saltos ?? null,
        ]);
        await db.runAsync(
          `INSERT INTO cardio_blocks (
            id, session_id, cardio_type, minutos, velocidad, kilometros, saltos
          ) VALUES ${placeholders};`,
          values,
        );
      }
    });
  }

  /**
   * Persiste la sesión completada y retorna su ID.
   */
  static async saveCompletedSession(
    startTime: number,
    endTime: number,
    duration: number,
    sets: SetRecord[] = [],
    cardioBlocks?: CardioBlock[],
  ): Promise<number> {
    const db = await getDatabase();
    let insertedSessionId = 0;

    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        'INSERT INTO session (start_time, end_time, total_duration_seconds) VALUES (?, ?, ?);',
        [startTime, endTime, duration],
      );
      insertedSessionId = result.lastInsertRowId;

      if (sets.length > 0) {
        const placeholders = sets.map(() => '(?, ?, ?, ?)').join(', ');
        const values = sets.flatMap((setItem) => [insertedSessionId, setItem.exerciseName, setItem.weightKg, setItem.reps]);
        await db.runAsync(
          `INSERT INTO set_log (session_id, exercise_name, weight_kg, reps) VALUES ${placeholders};`,
          values,
        );
      }

      if (cardioBlocks && cardioBlocks.length > 0) {
        await db.runAsync('DELETE FROM cardio_blocks WHERE session_id = ?;', [insertedSessionId]);
        const placeholders = cardioBlocks.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = cardioBlocks.flatMap((block) => [
          Crypto.randomUUID(),
          insertedSessionId,
          block.type,
          block.minutos,
          block.velocidad ?? null,
          block.kilometros ?? null,
          block.saltos ?? null,
        ]);
        await db.runAsync(
          `INSERT INTO cardio_blocks (
            id, session_id, cardio_type, minutos, velocidad, kilometros, saltos
          ) VALUES ${placeholders};`,
          values,
        );
      }
    });

    return insertedSessionId;
  }

  /**
   * Guarda una sesión completa de entrenamiento junto con el registro por lotes de sobrecarga.
   */
  static async saveSession(
    sesion: SesionEntrenamiento,
    startTimestamp?: number | null,
  ): Promise<void> {
    await guardarSesion(sesion);

    const endTime = Date.now();
    const startTime = startTimestamp ?? endTime - sesion.duracionSegundos * 1000;
    const granularSets: SetRecord[] = sesion.ejercicios.flatMap((exercise) =>
      exercise.series.map((set) => ({
        exerciseName: exercise.nombre,
        weightKg: set.pesoKg,
        reps: set.reps,
      })),
    );

    await WorkoutRepository.saveFullWorkout(
      startTime,
      endTime,
      sesion.duracionSegundos,
      granularSets,
      sesion.cardioBlocks,
    );
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
    await eliminarSesion(workoutId);
  }

  static getIsoWeekNumber(dateValue: string): number {
    return getIsoWeekNumber(dateValue);
  }
}
