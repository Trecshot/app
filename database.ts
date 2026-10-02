import * as SQLite from 'expo-sqlite';
import type { Cardio, CardioLog, Ejercicio, ExerciseLog, SesionEntrenamiento, WeeklySummary, Workout, WorkoutDetails } from './types';

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

export async function initDatabase(): Promise<void> {
  await getDatabase();
}

export function getIsoWeekNumber(dateValue: string): number {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
        cycle_week INTEGER NOT NULL DEFAULT 1 CHECK (cycle_week >= 1),
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
    await migrateCycleWeekColumn(db);
    await migrateAutomaticCycleWeeks(db);
    await migrateLegacySessions(db);
    dbInstance = db;
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function migrateCycleWeekColumn(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(workouts);');
  if (!columns.some((column) => column.name === 'cycle_week')) {
    await db.execAsync('ALTER TABLE workouts ADD COLUMN cycle_week INTEGER NOT NULL DEFAULT 1;');
  }
}

async function migrateAutomaticCycleWeeks(db: SQLite.SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if ((version?.user_version ?? 0) >= 1) return;

  const workouts = await db.getAllAsync<{ id: number; date: string }>('SELECT id, date FROM workouts;');
  await db.withTransactionAsync(async () => {
    for (const workout of workouts) {
      const cycleWeek = getIsoWeekNumber(workout.date);
      if (Number.isInteger(cycleWeek) && cycleWeek > 0) {
        await db.runAsync('UPDATE workouts SET cycle_week = ? WHERE id = ?;', [cycleWeek, workout.id]);
      }
    }
    await db.execAsync('PRAGMA user_version = 1;');
  });
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
        `INSERT OR IGNORE INTO workouts (client_id, date, week_type, cycle_week, notes, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [session.id, session.fecha, session.tipoSemana, getIsoWeekNumber(session.fecha), session.notas ?? null, session.duracionSegundos],
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
  await saveWorkout(
    {
      clientId: sesion.id,
      date: sesion.fecha,
      weekType: sesion.tipoSemana,
      notes: sesion.notas,
      durationSeconds: sesion.duracionSegundos,
    },
    sesion.ejercicios.flatMap((exercise, exerciseOrder) =>
      exercise.series.map((set, setIndex) => ({
        exerciseId: exercise.id,
        exerciseOrder,
        setId: set.id,
        exerciseName: exercise.nombre,
        muscleGroup: exercise.grupoMuscular?.trim() || 'General',
        setNumber: setIndex + 1,
        reps: set.reps,
        weight: set.pesoKg,
      })),
    ),
    sesion.cardio
      ? {
          cardioType: sesion.cardio.modalidad,
          level: sesion.cardio.velocidadNivel,
          distanceKm: sesion.cardio.distanciaKm,
          durationMinutes: sesion.cardio.tiempoMin,
        }
      : undefined,
  );
}

export async function saveWorkout(
  workout: Omit<Workout, 'id' | 'cycleWeek'>,
  exercises: Omit<ExerciseLog, 'id' | 'workoutId'>[],
  cardio?: Omit<CardioLog, 'id' | 'workoutId'>,
): Promise<number> {
  const db = await getDatabase();
  let workoutId = 0;
  try {
    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        `INSERT INTO workouts (client_id, date, week_type, cycle_week, notes, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [workout.clientId ?? createClientId(), workout.date, workout.weekType, getIsoWeekNumber(workout.date), workout.notes ?? null, workout.durationSeconds ?? 0],
      );
      workoutId = result.lastInsertRowId;
      for (const [index, exercise] of exercises.entries()) {
        await db.runAsync(
          `INSERT INTO exercise_logs (
            workout_id, exercise_id, exercise_order, exercise_name,
            muscle_group, set_id, set_number, reps, weight
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            workoutId,
            exercise.exerciseId ?? `exercise-${index}`,
            exercise.exerciseOrder ?? index,
            exercise.exerciseName,
            exercise.muscleGroup,
            exercise.setId ?? `${index}-${exercise.setNumber}`,
            exercise.setNumber,
            exercise.reps,
            exercise.weight,
          ],
        );
      }
      if (cardio) {
        await db.runAsync(
          `INSERT INTO cardio_logs (workout_id, cardio_type, level, distance_km, duration_minutes)
           VALUES (?, ?, ?, ?, ?);`,
          [workoutId, cardio.cardioType, cardio.level ?? null, cardio.distanceKm ?? null, cardio.durationMinutes],
        );
      }
    });
    return workoutId;
  } catch (error) {
    console.error('Error al guardar el entrenamiento:', error);
    throw error;
  }
}

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getWorkoutsHistory(): Promise<(Workout & { id: number })[]> {
  try {
    const db = await getDatabase();
    const workouts = await db.getAllAsync<{
      id: number;
      clientId: string;
      date: string;
      weekType: Workout['weekType'];
      cycleWeek: number;
      notes: string | null;
      durationSeconds: number;
    }>(
          `SELECT id, client_id AS clientId, date,
              week_type AS weekType, cycle_week AS cycleWeek,
              notes, duration_seconds AS durationSeconds
       FROM workouts ORDER BY date DESC, id DESC;`,
    );
    return workouts.map(({ notes, ...workout }) => ({
      ...workout,
      cycleWeek: getIsoWeekNumber(workout.date),
      ...(notes === null ? {} : { notes }),
    }));
  } catch (error) {
    console.error('Error al obtener el historial:', error);
    return [];
  }
}

export async function getWeeklySummary(): Promise<WeeklySummary[]> {
  try {
    const db = await getDatabase();
    return await db.getAllAsync<WeeklySummary>(
      `WITH dated_workouts AS (
         SELECT date, week_type AS weekType, cycle_week AS cycleWeek,
                date(date, '-' || ((CAST(strftime('%w', date) AS INTEGER) + 6) % 7) || ' days') AS weekStart
         FROM workouts
       ), daily_workouts AS (
         SELECT DISTINCT date, weekType, cycleWeek, weekStart
         FROM dated_workouts
       )
       SELECT CAST(strftime('%Y', date(weekStart, '+3 days')) AS INTEGER) AS weekYear,
              cycleWeek,
              weekType,
              COUNT(*) AS trainingDays,
              GROUP_CONCAT(date, ', ') AS dates
       FROM daily_workouts
       GROUP BY weekStart, cycleWeek, weekType
       ORDER BY weekStart DESC, weekType ASC;`,
    );
  } catch (error) {
    console.error('Error al obtener el resumen semanal:', error);
    return [];
  }
}

export async function getWorkoutDetails(workoutId: number | string): Promise<WorkoutDetails> {
  try {
    const db = await getDatabase();
    const workout = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM workouts WHERE id = ? OR client_id = ? LIMIT 1;',
      [typeof workoutId === 'number' ? workoutId : -1, String(workoutId)],
    );
    if (!workout) return { exercises: [], cardio: [] };

    const exercises = await db.getAllAsync<ExerciseLog>(
      `SELECT workout_id AS workoutId, exercise_id AS exerciseId,
              exercise_order AS exerciseOrder, exercise_name AS exerciseName,
              muscle_group AS muscleGroup, set_id AS setId,
              set_number AS setNumber, reps, weight
       FROM exercise_logs WHERE workout_id = ?
       ORDER BY exercise_order, set_number;`,
      [workout.id],
    );
    const cardio = await db.getAllAsync<CardioLog>(
      `SELECT workout_id AS workoutId, cardio_type AS cardioType,
              level, distance_km AS distanceKm,
              duration_minutes AS durationMinutes
       FROM cardio_logs WHERE workout_id = ?;`,
      [workout.id],
    );

    return { exercises, cardio };
  } catch (error) {
    console.error('Error al obtener el detalle del entrenamiento:', error);
    return { exercises: [], cardio: [] };
  }
}

export async function obtenerSesiones(): Promise<SesionEntrenamiento[]> {
  const db = await getDatabase();
  const workouts = await getWorkoutsHistory();
  const exerciseRows = await db.getAllAsync<{
    id: number;
    workout_id: number;
    exercise_id: string;
    exercise_order: number;
    exercise_name: string;
    muscle_group: string;
    set_id: string;
    set_number: number;
    reps: number;
    weight: number;
  }>(
    'SELECT id, workout_id, exercise_id, exercise_order, exercise_name, muscle_group, set_id, set_number, reps, weight FROM exercise_logs ORDER BY workout_id, exercise_order, set_number;',
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
      exercise = { id: row.exercise_id, nombre: row.exercise_name, grupoMuscular: row.muscle_group, series: [] };
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
    const workoutId = workout.id;
    const workoutExercises = [...(exercisesByWorkout.get(workoutId)?.values() ?? [])];
    return {
      id: workout.clientId ?? String(workoutId),
      fecha: workout.date,
      ...(workout.notes ? { notas: workout.notes } : {}),
      duracionSegundos: workout.durationSeconds ?? 0,
      tipoSemana: workout.weekType,
      cycleWeek: workout.cycleWeek,
      ejercicios: workoutExercises,
      cardio: cardioByWorkout.get(workoutId) ?? null,
    };
  });
}

export async function eliminarSesion(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workouts WHERE client_id = ?;', [id]);
}