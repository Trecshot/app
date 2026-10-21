import {
  eliminarSesion,
  getDatabase,
  getIsoWeekNumber,
  getWeeklySummary,
  getWorkoutDetails,
  guardarSesion,
  initDatabase,
  obtenerSesiones,
} from '../../../database';
import type { SesionEntrenamiento, WeeklySummary, WorkoutDetails } from '../../../types';

export interface SetLogInput {
  exerciseName: string;
  weightKg: number;
  reps: number;
}

export class WorkoutRepository {
  /**
   * Inicialización estandarizada de tablas relacionales y migraciones en SQLite (Expo SDK 57).
   */
  static async initSchema(): Promise<void> {
    await initDatabase();
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
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
      `);
    });
  }

  /**
   * Persiste la sesión completada y sus series granulares en una transacción ACID.
   */
  static async saveCompletedSession(
    startTime: number,
    endTime: number,
    duration: number,
    sets: SetLogInput[] = [],
  ): Promise<number> {
    const db = await getDatabase();
    let insertedSessionId = 0;

    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        'INSERT INTO session (start_time, end_time, total_duration_seconds) VALUES (?, ?, ?);',
        [startTime, endTime, duration],
      );
      insertedSessionId = result.lastInsertRowId;

      for (const setItem of sets) {
        await db.runAsync(
          'INSERT INTO set_log (session_id, exercise_name, weight_kg, reps) VALUES (?, ?, ?, ?);',
          [insertedSessionId, setItem.exerciseName, setItem.weightKg, setItem.reps],
        );
      }
    });

    return insertedSessionId;
  }

  /**
   * Guarda una sesión completa de entrenamiento junto con el registro relacional de sobrecarga.
   */
  static async saveSession(
    sesion: SesionEntrenamiento,
    startTimestamp?: number | null,
  ): Promise<void> {
    await guardarSesion(sesion);

    const endTime = Date.now();
    const startTime = startTimestamp ?? endTime - sesion.duracionSegundos * 1000;
    const granularSets: SetLogInput[] = sesion.ejercicios.flatMap((exercise) =>
      exercise.series.map((set) => ({
        exerciseName: exercise.nombre,
        weightKg: set.pesoKg,
        reps: set.reps,
      })),
    );

    await WorkoutRepository.saveCompletedSession(
      startTime,
      endTime,
      sesion.duracionSegundos,
      granularSets,
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

  static async deleteSession(workoutId: string): Promise<void> {
    await eliminarSesion(workoutId);
  }

  static getIsoWeekNumber(dateValue: string): number {
    return getIsoWeekNumber(dateValue);
  }
}
