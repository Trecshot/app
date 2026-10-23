import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { Cardio, CardioLog, Ejercicio, ExerciseLog, MuscleGroup, SesionEntrenamiento, WeeklySummary, Workout, WorkoutDetails } from './types';
import { EXERCISE_CATALOG, getCatalogExerciseName } from './types';

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
      CREATE TABLE IF NOT EXISTS exercise_catalog (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        muscle_group TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL UNIQUE,
        date TEXT NOT NULL,
        week_type TEXT NOT NULL CHECK (week_type IN ('carga', 'descarga')),
        cycle_week INTEGER NOT NULL DEFAULT 1 CHECK (cycle_week >= 1),
        notes TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        session_focus TEXT
      );
      CREATE TABLE IF NOT EXISTS exercise_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        catalog_exercise_id TEXT,
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
    await seedExerciseCatalog(db);
    await migrateCycleWeekColumn(db);
    await migrateSessionFocusColumn(db);
    await migrateCatalogExerciseIdColumn(db);
    await migrateAutomaticCycleWeeks(db);
    await migrateLegacyExerciseCatalogLinks(db);
    await migrateLegacySessions(db);
    dbInstance = db;
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function seedExerciseCatalog(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const stmt = await db.prepareAsync(
      'INSERT OR REPLACE INTO exercise_catalog (id, name, muscle_group) VALUES ($id, $name, $muscleGroup);',
    );
    try {
      for (const ex of EXERCISE_CATALOG) {
        await stmt.executeAsync({ $id: ex.id, $name: ex.name, $muscleGroup: ex.muscleGroup });
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

async function migrateSessionFocusColumn(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(workouts);');
  if (!columns.some((column) => column.name === 'session_focus')) {
    await db.execAsync('ALTER TABLE workouts ADD COLUMN session_focus TEXT;');
  }
}

async function migrateCatalogExerciseIdColumn(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(exercise_logs);');
  if (!columns.some((column) => column.name === 'catalog_exercise_id')) {
    await db.execAsync('ALTER TABLE exercise_logs ADD COLUMN catalog_exercise_id TEXT;');
  }
}

async function migrateLegacyExerciseCatalogLinks(db: SQLite.SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if ((version?.user_version ?? 0) >= 2) return;

  const unlinkedLogs = await db.getAllAsync<{ id: number; exercise_name: string }>(
    "SELECT id, exercise_name FROM exercise_logs WHERE catalog_exercise_id IS NULL OR catalog_exercise_id = '';",
  );

  if (unlinkedLogs.length > 0) {
    const catalogRows = await db.getAllAsync<{ id: string; name: string }>(
      'SELECT id, name FROM exercise_catalog;',
    );

    await db.withTransactionAsync(async () => {
      const updateStmt = await db.prepareAsync(
        'UPDATE exercise_logs SET catalog_exercise_id = $catId WHERE id = $logId;',
      );
      try {
        for (const log of unlinkedLogs) {
          const normLogName = log.exercise_name.toLowerCase().trim();
          const match = catalogRows.find(
            (c) =>
              c.name.toLowerCase().trim() === normLogName ||
              normLogName.includes(c.name.toLowerCase().trim()) ||
              c.name.toLowerCase().trim().includes(normLogName),
          );
          if (match) {
            await updateStmt.executeAsync({ $catId: match.id, $logId: log.id });
          }
        }
      } finally {
        await updateStmt.finalizeAsync();
      }
    });
  }

  await db.execAsync('PRAGMA user_version = 2;');
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
    const statement = await db.prepareAsync('UPDATE workouts SET cycle_week = $cycleWeek WHERE id = $id;');
    try {
      for (const workout of workouts) {
        const cycleWeek = getIsoWeekNumber(workout.date);
        if (Number.isInteger(cycleWeek) && cycleWeek > 0) {
          await statement.executeAsync({ $cycleWeek: cycleWeek, $id: workout.id });
        }
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
  await db.execAsync('PRAGMA user_version = 1;');
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
      sessionFocus: sesion.sessionFocus,
    },
    sesion.ejercicios.flatMap((exercise, exerciseOrder) =>
      exercise.series.map((set, setIndex) => ({
        exerciseId: exercise.id,
        catalogExerciseId: exercise.catalogExerciseId,
        exerciseOrder,
        setId: set.id,
        exerciseName: exercise.nombre,
        muscleGroup: exercise.grupoMuscular?.trim() || exercise.selectedMuscleGroup || 'General',
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
        `INSERT INTO workouts (client_id, date, week_type, cycle_week, notes, duration_seconds, session_focus)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          workout.clientId ?? createClientId(),
          workout.date,
          workout.weekType,
          getIsoWeekNumber(workout.date),
          workout.notes ?? null,
          workout.durationSeconds ?? 0,
          workout.sessionFocus ? JSON.stringify(workout.sessionFocus) : null,
        ],
      );
      workoutId = result.lastInsertRowId;
      for (const [index, exercise] of exercises.entries()) {
        await db.runAsync(
          `INSERT INTO exercise_logs (
            workout_id, exercise_id, catalog_exercise_id, exercise_order, exercise_name,
            muscle_group, set_id, set_number, reps, weight
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            workoutId,
            exercise.exerciseId ?? Crypto.randomUUID(),
            exercise.catalogExerciseId ?? null,
            exercise.exerciseOrder ?? index,
            exercise.exerciseName,
            exercise.muscleGroup,
            exercise.setId ?? Crypto.randomUUID(),
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
  return Crypto.randomUUID();
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
        weekStart,
        date(weekStart, '+6 days') AS weekEnd,
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

export async function obtenerSesiones(limit = 50, offset = 0): Promise<SesionEntrenamiento[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: number;
      clientId: string;
      fecha: string;
      tipoSemana: Workout['weekType'];
      cycleWeek: number;
      notas: string | null;
      duracionSegundos: number;
      sessionFocusJson: string | null;
      ejercicios_json: string | null;
      cardio_json: string | null;
    }>(
      `SELECT 
        w.id,
        w.client_id AS clientId,
        w.date AS fecha,
        w.week_type AS tipoSemana,
        w.cycle_week AS cycleWeek,
        w.notes AS notas,
        w.duration_seconds AS duracionSegundos,
        w.session_focus AS sessionFocusJson,
        (
          SELECT json_group_array(
            json_object(
              'id', e.exercise_id, 
              'catalogExerciseId', e.catalog_exercise_id,
              'nombre', COALESCE(cat.name, e.exercise_name),
              'grupoMuscular', COALESCE(cat.muscle_group, e.muscle_group),
              'series', (
                SELECT json_group_array(
                  json_object(
                    'id', s.set_id,
                    'reps', s.reps,
                    'pesoKg', s.weight
                  )
                )
                FROM exercise_logs s 
                WHERE s.workout_id = w.id AND s.exercise_id = e.exercise_id
                ORDER BY s.set_number ASC
              )
            )
          )
          FROM (
            SELECT 
              exercise_id, 
              catalog_exercise_id,
              exercise_name, 
              muscle_group, 
              MIN(exercise_order) AS min_order
            FROM exercise_logs 
            WHERE workout_id = w.id 
            GROUP BY exercise_id, catalog_exercise_id, exercise_name, muscle_group
            ORDER BY min_order ASC
          ) e
          LEFT JOIN exercise_catalog cat ON cat.id = e.catalog_exercise_id
        ) AS ejercicios_json,
        (
          SELECT json_object(
            'realizado', 1,
            'modalidad', c.cardio_type,
            'tiempoMin', c.duration_minutes,
            'velocidadNivel', c.level,
            'distanciaKm', c.distance_km
          )
          FROM cardio_logs c
          WHERE c.workout_id = w.id
          LIMIT 1
        ) AS cardio_json
      FROM workouts w
      ORDER BY w.date DESC, w.id DESC
      LIMIT ? OFFSET ?;`,
      [limit, offset],
    );

    return rows.map((row) => {
      let sessionFocus: MuscleGroup[] | undefined;
      if (row.sessionFocusJson) {
        try {
          sessionFocus = JSON.parse(row.sessionFocusJson) as MuscleGroup[];
        } catch {
          sessionFocus = undefined;
        }
      }

      let ejercicios: Ejercicio[] = [];
      if (row.ejercicios_json) {
        try {
          const parsed = JSON.parse(row.ejercicios_json) as unknown[];
          if (Array.isArray(parsed)) {
            ejercicios = parsed.map((e: any) => ({
              id: String(e.id ?? Crypto.randomUUID()),
              catalogExerciseId: e.catalogExerciseId ? String(e.catalogExerciseId) : undefined,
              nombre: String(e.nombre ?? ''),
              ...(e.grupoMuscular ? { grupoMuscular: String(e.grupoMuscular) } : {}),
              series: Array.isArray(e.series)
                ? e.series.map((s: any) => ({
                    id: String(s.id ?? Crypto.randomUUID()),
                    reps: Number(s.reps ?? 0),
                    pesoKg: Number(s.pesoKg ?? 0),
                  }))
                : [],
            }));
          }
        } catch (err) {
          console.error('Error al deserializar ejercicios JSON:', err);
        }
      }

      let cardio: Cardio | null = null;
      if (row.cardio_json) {
        try {
          const parsed = JSON.parse(row.cardio_json) as {
            modalidad: Cardio['modalidad'];
            tiempoMin: number;
            velocidadNivel?: number | null;
            distanciaKm?: number | null;
          };
          cardio = {
            realizado: true,
            modalidad: parsed.modalidad,
            tiempoMin: Number(parsed.tiempoMin ?? 0),
            ...(parsed.velocidadNivel !== null && parsed.velocidadNivel !== undefined
              ? { velocidadNivel: Number(parsed.velocidadNivel) }
              : {}),
            ...(parsed.distanciaKm !== null && parsed.distanciaKm !== undefined
              ? { distanciaKm: Number(parsed.distanciaKm) }
              : {}),
          };
        } catch (err) {
          console.error('Error al deserializar cardio JSON:', err);
        }
      }

      return {
        id: row.clientId || String(row.id),
        fecha: row.fecha,
        ...(row.notas ? { notas: row.notas } : {}),
        duracionSegundos: row.duracionSegundos ?? 0,
        tipoSemana: row.tipoSemana,
        cycleWeek: row.cycleWeek || getIsoWeekNumber(row.fecha),
        sessionFocus,
        ejercicios,
        cardio,
      };
    });
  } catch (error) {
    console.error('Error al obtener sesiones:', error);
    return [];
  }
}

export async function eliminarSesion(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workouts WHERE client_id = ?;', [id]);
}