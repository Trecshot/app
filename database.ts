import * as SQLite from 'expo-sqlite';
import type { Cardio, Ejercicio, SesionEntrenamiento } from './types';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitialization: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (!dbInitialization) {
    dbInitialization = initializeDatabase();
    void dbInitialization.catch(() => { dbInitialization = null; });
  }
  return dbInitialization;
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('gym_tracker.db');
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL UNIQUE,
        date TEXT NOT NULL,
        week_type TEXT NOT NULL CHECK (week_type IN ('carga', 'descarga')),
        notes TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS exercise_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        exercise_order INTEGER NOT NULL,
        exercise_name TEXT NOT NULL,
        muscle_group TEXT NOT NULL DEFAULT 'General',
        set_id TEXT NOT NULL,
        set_number INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        weight REAL NOT NULL,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
        UNIQUE (workout_id, exercise_id, set_number)
      );
      CREATE TABLE IF NOT EXISTS cardio_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL UNIQUE,
        cardio_type TEXT NOT NULL,
        level INTEGER,
        distance_km REAL,
        duration_minutes REAL NOT NULL,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
      );
    `);
    await migrateLegacySessions(db);
    dbInstance = db;
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function migrateLegacySessions(db: SQLite.SQLiteDatabase): Promise<void> {
  const legacyTable = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sesiones';",
  );
  if (!legacyTable) return;

  const legacyRows = await db.getAllAsync<{ datos_json: string }>(
    'SELECT datos_json FROM sesiones ORDER BY rowid ASC;',
  );
  await db.withTransactionAsync(async () => {
    const transaction = db;
    for (const row of legacyRows) {
      let session: SesionEntrenamiento;
      try {
        session = JSON.parse(row.datos_json) as SesionEntrenamiento;
      } catch {
        continue;
      }
      if (!session.id || !Array.isArray(session.ejercicios)) continue;

      const inserted = await transaction.runAsync(
        `INSERT OR IGNORE INTO workouts (client_id, date, week_type, duration_seconds)
         VALUES (?, ?, ?, ?);`,
        [session.id, session.fecha, session.tipoSemana, session.duracionSegundos],
      );
      if (inserted.changes === 0) continue;

      const workoutId = inserted.lastInsertRowId;
      for (const [exerciseOrder, exercise] of session.ejercicios.entries()) {
        for (const [setIndex, set] of exercise.series.entries()) {
          await transaction.runAsync(
            `INSERT INTO exercise_logs (
              workout_id, exercise_id, exercise_order, exercise_name,
              muscle_group, set_id, set_number, reps, weight
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [workoutId, exercise.id, exerciseOrder, exercise.nombre, 'General', set.id, setIndex + 1, set.reps, set.pesoKg],
          );
        }
      }
      if (session.cardio) {
        await insertCardio(transaction, workoutId, session.cardio);
      }
    }
  });
}

async function insertCardio(
  db: SQLite.SQLiteDatabase,
  workoutId: number,
  cardio: Cardio,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO cardio_logs (workout_id, cardio_type, level, distance_km, duration_minutes)
     VALUES (?, ?, ?, ?, ?);`,
    [workoutId, cardio.modalidad, cardio.velocidadNivel ?? null, cardio.distanciaKm ?? null, cardio.tiempoMin],
  );
}

export async function guardarSesion(sesion: SesionEntrenamiento): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const transaction = db;
    const result = await transaction.runAsync(
      `INSERT INTO workouts (client_id, date, week_type, duration_seconds)
       VALUES (?, ?, ?, ?);`,
      [sesion.id, sesion.fecha, sesion.tipoSemana, sesion.duracionSegundos],
    );
    const workoutId = result.lastInsertRowId;
    for (const [exerciseOrder, exercise] of sesion.ejercicios.entries()) {
      for (const [setIndex, set] of exercise.series.entries()) {
        await transaction.runAsync(
          `INSERT INTO exercise_logs (
            workout_id, exercise_id, exercise_order, exercise_name,
            muscle_group, set_id, set_number, reps, weight
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [workoutId, exercise.id, exerciseOrder, exercise.nombre, 'General', set.id, setIndex + 1, set.reps, set.pesoKg],
        );
      }
    }
    if (sesion.cardio) await insertCardio(transaction, workoutId, sesion.cardio);
  });
}

export async function obtenerSesiones(): Promise<SesionEntrenamiento[]> {
  const db = await getDatabase();
  const workouts = await db.getAllAsync<{
    id: number;
    client_id: string;
    date: string;
    week_type: 'carga' | 'descarga';
    duration_seconds: number;
  }>(
    'SELECT id, client_id, date, week_type, duration_seconds FROM workouts ORDER BY date DESC, id DESC;',
  );
  const exerciseRows = await db.getAllAsync<{
    id: number;
    workout_id: number;
    exercise_id: string;
    exercise_order: number;
    exercise_name: string;
    set_id: string;
    set_number: number;
    reps: number;
    weight: number;
  }>(
    'SELECT id, workout_id, exercise_id, exercise_order, exercise_name, set_id, set_number, reps, weight FROM exercise_logs ORDER BY workout_id, exercise_order, set_number;',
  );
  const cardioRows = await db.getAllAsync<{
    workout_id: number;
    cardio_type: string;
    level: number | null;
    distance_km: number | null;
    duration_minutes: number;
  }>('SELECT workout_id, cardio_type, level, distance_km, duration_minutes FROM cardio_logs;');

  const exercisesByWorkout = new Map<number, Map<string, Ejercicio>>();
  for (const row of exerciseRows) {
    let exercises = exercisesByWorkout.get(row.workout_id);
    if (!exercises) {
      exercises = new Map<string, Ejercicio>();
      exercisesByWorkout.set(row.workout_id, exercises);
    }
    let exercise = exercises.get(row.exercise_id);
    if (!exercise) {
      exercise = { id: row.exercise_id, nombre: row.exercise_name, series: [] };
      exercises.set(row.exercise_id, exercise);
    }
    exercise.series.push({ id: row.set_id || String(row.id), reps: row.reps, pesoKg: row.weight });
  }

  const cardioByWorkout = new Map<number, Cardio>();
  for (const row of cardioRows) {
    const cardio: Cardio = {
      realizado: true,
      modalidad: row.cardio_type as Cardio['modalidad'],
      tiempoMin: row.duration_minutes,
    };
    if (row.level !== null) cardio.velocidadNivel = row.level;
    if (row.distance_km !== null) cardio.distanciaKm = row.distance_km;
    cardioByWorkout.set(row.workout_id, cardio);
  }

  return workouts.map((workout) => {
    const workoutExercises = [...(exercisesByWorkout.get(workout.id)?.values() ?? [])];
    return {
      id: workout.client_id,
      fecha: workout.date,
      duracionSegundos: workout.duration_seconds,
      tipoSemana: workout.week_type,
      ejercicios: workoutExercises,
      cardio: cardioByWorkout.get(workout.id) ?? null,
    };
  });
}

export async function eliminarSesion(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workouts WHERE client_id = ?;', [id]);
}