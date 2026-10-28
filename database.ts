import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { Cardio, CardioBlock, CardioLog, CardioType, Ejercicio, ExerciseLog, MuscleGroup, SesionEntrenamiento, TrainingBlock, WeekType, WeeklySummary, Workout, WorkoutDetails } from './types';
import { EXERCISE_CATALOG } from './types';

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
      CREATE TABLE IF NOT EXISTS training_blocks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('carga', 'descarga')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_training_blocks_start ON training_blocks (start_date);
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL UNIQUE,
        date TEXT NOT NULL,
        week_type TEXT NOT NULL CHECK (week_type IN ('carga', 'descarga')),
        cycle_week INTEGER NOT NULL DEFAULT 1 CHECK (cycle_week >= 1),
        notes TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        session_focus TEXT,
        block_id TEXT REFERENCES training_blocks (id) ON DELETE SET NULL
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
      CREATE TABLE IF NOT EXISTS cardio_blocks (
        id TEXT PRIMARY KEY,
        workout_id INTEGER,
        cardio_type TEXT NOT NULL,
        minutos REAL NOT NULL,
        velocidad REAL,
        kilometros REAL,
        saltos INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
      );
    `);
    await seedExerciseCatalog(db);
    await migrateCycleWeekColumn(db);
    await migrateSessionFocusColumn(db);
    await migrateCatalogExerciseIdColumn(db);
    await migrateAutomaticCycleWeeks(db);
    await migrateLegacyExerciseCatalogLinks(db);
    await migrateLegacySessions(db);
    await migrateTrainingBlocks(db);
    await migrateDuplicatedSessionCardio(db);
    await migrateDropLegacySessionTables(db);
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

/** Duración fija de un bloque de entrenamiento (7 días naturales). */
export const TRAINING_BLOCK_DAYS = 7;

/** Medianoche local del día de `date`. */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Suma días respetando cambios de horario (DST). */
function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Convierte 'YYYY-MM-DD' a fecha local (medianoche). */
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Migración v3: añade `workouts.block_id` y asigna bloques de 7 días (lunes a domingo)
 * a los entrenamientos que existían antes de introducir `training_blocks`.
 */
async function migrateTrainingBlocks(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(workouts);');
  if (!columns.some((column) => column.name === 'block_id')) {
    // SQLite permite añadir una columna con REFERENCES siempre que su valor por defecto sea NULL.
    await db.execAsync(
      'ALTER TABLE workouts ADD COLUMN block_id TEXT REFERENCES training_blocks (id) ON DELETE SET NULL;',
    );
  }
  await db.execAsync('CREATE INDEX IF NOT EXISTS idx_workouts_block_id ON workouts (block_id);');

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if ((version?.user_version ?? 0) >= 3) return;

  const orphanWorkouts = await db.getAllAsync<{ id: number; date: string; weekType: WeekType }>(
    'SELECT id, date, week_type AS weekType FROM workouts WHERE block_id IS NULL ORDER BY date ASC, id ASC;',
  );

  if (orphanWorkouts.length > 0) {
    await db.withTransactionAsync(async () => {
      const blocksByWeek = new Map<string, string>();
      for (const workout of orphanWorkouts) {
        const day = parseLocalDate(workout.date);
        if (Number.isNaN(day.getTime())) continue;
        const weekStart = addLocalDays(day, -((day.getDay() + 6) % 7));
        const key = weekStart.toISOString();

        let blockId = blocksByWeek.get(key);
        if (!blockId) {
          blockId = Crypto.randomUUID();
          await db.runAsync(
            'INSERT INTO training_blocks (id, type, start_date, end_date) VALUES (?, ?, ?, ?);',
            [blockId, workout.weekType, key, addLocalDays(weekStart, TRAINING_BLOCK_DAYS).toISOString()],
          );
          blocksByWeek.set(key, blockId);
        }
        await db.runAsync('UPDATE workouts SET block_id = ? WHERE id = ?;', [blockId, workout.id]);
      }
    });
  }

  await db.execAsync('PRAGMA user_version = 3;');
}

/**
 * Migración v4: elimina los bloques de cardio duplicados que se guardaban ligados solo a la
 * tabla `session` (sin `workout_id`). La copia válida siempre está ligada a `workouts`.
 * Antes, el historial los cruzaba por `session_id = workouts.id` (IDs de secuencias distintas),
 * mostrando cardio repetido o en la sesión equivocada, y no se borraban al eliminar un entrenamiento.
 */
async function migrateDuplicatedSessionCardio(db: SQLite.SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if ((version?.user_version ?? 0) >= 4) return;

  await db.execAsync(`
    DELETE FROM cardio_blocks WHERE workout_id IS NULL;
    PRAGMA user_version = 4;
  `);
}

/**
 * Migración v5: elimina las tablas huérfanas `session` y `set_log`.
 */
async function migrateDropLegacySessionTables(db: SQLite.SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if ((version?.user_version ?? 0) >= 5) return;

  await db.execAsync(`
    DROP TABLE IF EXISTS set_log;
    DROP TABLE IF EXISTS session;
    PRAGMA user_version = 5;
  `);
}

interface TrainingBlockRow {
  id: string;
  type: WeekType;
  startDate: string;
  endDate: string;
}

const TRAINING_BLOCK_COLUMNS = 'id, type, start_date AS startDate, end_date AS endDate';

/** Último bloque registrado (el de fecha de inicio más reciente). */
export async function getLatestTrainingBlock(): Promise<TrainingBlock | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TrainingBlockRow>(
    `SELECT ${TRAINING_BLOCK_COLUMNS} FROM training_blocks ORDER BY start_date DESC LIMIT 1;`,
  );
  return row ?? null;
}

/** Bloque cuyo rango [start_date, end_date) contiene la fecha indicada. */
export async function findTrainingBlockForDate(date: Date = new Date()): Promise<TrainingBlock | null> {
  const db = await getDatabase();
  const iso = date.toISOString();
  const row = await db.getFirstAsync<TrainingBlockRow>(
    `SELECT ${TRAINING_BLOCK_COLUMNS} FROM training_blocks
     WHERE start_date <= ? AND end_date > ?
     ORDER BY start_date DESC LIMIT 1;`,
    [iso, iso],
  );
  return row ?? null;
}

/** Crea un bloque de 7 días que comienza hoy a medianoche (hora local). */
export async function createTrainingBlock(type: WeekType, from: Date = new Date()): Promise<TrainingBlock> {
  const db = await getDatabase();
  const start = startOfLocalDay(from);
  const block: TrainingBlock = {
    id: Crypto.randomUUID(),
    type,
    startDate: start.toISOString(),
    endDate: addLocalDays(start, TRAINING_BLOCK_DAYS).toISOString(),
  };
  await db.runAsync(
    'INSERT INTO training_blocks (id, type, start_date, end_date) VALUES (?, ?, ?, ?);',
    [block.id, block.type, block.startDate, block.endDate],
  );
  return block;
}

/**
 * Cambia el tipo (carga/descarga) de un bloque existente y lo propaga
 * a todas las sesiones registradas dentro de él.
 */
export async function updateTrainingBlockType(blockId: string, type: WeekType): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE training_blocks SET type = ? WHERE id = ?;', [type, blockId]);
    await db.runAsync('UPDATE workouts SET week_type = ? WHERE block_id = ?;', [type, blockId]);
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
      blockId: sesion.blockId,
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
    sesion.cardioBlocks,
  );
}

export async function saveWorkout(
  workout: Omit<Workout, 'id' | 'cycleWeek'>,
  exercises: Omit<ExerciseLog, 'id' | 'workoutId'>[],
  cardio?: Omit<CardioLog, 'id' | 'workoutId'>,
  cardioBlocks?: CardioBlock[],
): Promise<number> {
  const db = await getDatabase();
  let workoutId = 0;
  try {
    // Hereda el bloque (carga/descarga) vigente: el indicado explícitamente o el que cubre "ahora".
    const block = workout.blockId
      ? await db.getFirstAsync<TrainingBlockRow>(
          `SELECT ${TRAINING_BLOCK_COLUMNS} FROM training_blocks WHERE id = ?;`,
          [workout.blockId],
        )
      : await findTrainingBlockForDate(new Date());
    const weekType: WeekType = block?.type ?? workout.weekType;

    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        `INSERT INTO workouts (client_id, date, week_type, cycle_week, notes, duration_seconds, session_focus, block_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          workout.clientId ?? createClientId(),
          workout.date,
          weekType,
          getIsoWeekNumber(workout.date),
          workout.notes ?? null,
          workout.durationSeconds ?? 0,
          workout.sessionFocus ? JSON.stringify(workout.sessionFocus) : null,
          block?.id ?? null,
        ],
      );
      workoutId = result.lastInsertRowId;

      // 1. Inserción en Bloque (Bulk Insert) de series/ejercicios
      if (exercises.length > 0) {
        const placeholders = exercises.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = exercises.flatMap((exercise, index) => [
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
        ]);
        await db.runAsync(
          `INSERT INTO exercise_logs (
            workout_id, exercise_id, catalog_exercise_id, exercise_order, exercise_name,
            muscle_group, set_id, set_number, reps, weight
          ) VALUES ${placeholders};`,
          values,
        );
      }

      if (cardio) {
        await db.runAsync(
          `INSERT INTO cardio_logs (workout_id, cardio_type, level, distance_km, duration_minutes)
           VALUES (?, ?, ?, ?, ?);`,
          [workoutId, cardio.cardioType, cardio.level ?? null, cardio.distanceKm ?? null, cardio.durationMinutes],
        );
      }

      // 2. Inserción en Bloque (Bulk Insert) de bloques de cardio
      if (cardioBlocks && cardioBlocks.length > 0) {
        await db.runAsync('DELETE FROM cardio_blocks WHERE workout_id = ?;', [workoutId]);
        const placeholders = cardioBlocks.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = cardioBlocks.flatMap((block) => [
          Crypto.randomUUID(),
          workoutId,
          block.type,
          block.minutos,
          block.velocidad ?? null,
          block.kilometros ?? null,
          block.saltos ?? null,
        ]);
        await db.runAsync(
          `INSERT INTO cardio_blocks (
            id, workout_id, cardio_type, minutos, velocidad, kilometros, saltos
          ) VALUES ${placeholders};`,
          values,
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
    const cardioBlocks = await db.getAllAsync<{
      id: string;
      cardio_type: CardioType;
      minutos: number;
      velocidad: number | null;
      kilometros: number | null;
      saltos: number | null;
    }>(
      `SELECT id, cardio_type, minutos, velocidad, kilometros, saltos
       FROM cardio_blocks WHERE workout_id = ?;`,
      [workout.id],
    );

    return {
      exercises,
      cardio,
      cardioBlocks: cardioBlocks.map((cb) => ({
        id: cb.id,
        type: cb.cardio_type,
        minutos: cb.minutos,
        ...(cb.velocidad !== null ? { velocidad: cb.velocidad } : {}),
        ...(cb.kilometros !== null ? { kilometros: cb.kilometros } : {}),
        ...(cb.saltos !== null ? { saltos: cb.saltos } : {}),
      })),
    };
  } catch (error) {
    console.error('Error al obtener el detalle del entrenamiento:', error);
    return { exercises: [], cardio: [], cardioBlocks: [] };
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
      cardio_blocks_json: string | null;
      blockId: string | null;
      blockType: WeekType | null;
      blockStartDate: string | null;
      blockEndDate: string | null;
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
        tb.id AS blockId,
        tb.type AS blockType,
        tb.start_date AS blockStartDate,
        tb.end_date AS blockEndDate,
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
        ) AS cardio_json,
        (
          SELECT json_group_array(
            json_object(
              'id', cb.id,
              'type', cb.cardio_type,
              'minutos', cb.minutos,
              'velocidad', cb.velocidad,
              'kilometros', cb.kilometros,
              'saltos', cb.saltos
            )
          )
          FROM cardio_blocks cb
          WHERE cb.workout_id = w.id
        ) AS cardio_blocks_json
      FROM workouts w
      LEFT JOIN training_blocks tb ON tb.id = w.block_id
      ORDER BY COALESCE(tb.start_date, w.date) DESC, w.date DESC, w.id DESC
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

      let cardioBlocks: CardioBlock[] | undefined;
      if (row.cardio_blocks_json) {
        try {
          const parsed = JSON.parse(row.cardio_blocks_json) as unknown[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            cardioBlocks = parsed.map((cb: any) => ({
              id: String(cb.id ?? Crypto.randomUUID()),
              type: cb.type as CardioType,
              minutos: Number(cb.minutos ?? 0),
              ...(cb.velocidad !== null && cb.velocidad !== undefined ? { velocidad: Number(cb.velocidad) } : {}),
              ...(cb.kilometros !== null && cb.kilometros !== undefined ? { kilometros: Number(cb.kilometros) } : {}),
              ...(cb.saltos !== null && cb.saltos !== undefined ? { saltos: Number(cb.saltos) } : {}),
            }));
          }
        } catch (err) {
          console.error('Error al deserializar cardio blocks JSON:', err);
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
        cardioBlocks,
        ...(row.blockId && row.blockType && row.blockStartDate && row.blockEndDate
          ? {
              blockId: row.blockId,
              block: {
                id: row.blockId,
                type: row.blockType,
                startDate: row.blockStartDate,
                endDate: row.blockEndDate,
              },
            }
          : {}),
      };
    });
  } catch (error) {
    console.error('Error al obtener sesiones:', error);
    return [];
  }
}

export async function getCardioBlocksByWorkoutId(workoutId: number): Promise<CardioBlock[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    cardio_type: CardioType;
    minutos: number;
    velocidad: number | null;
    kilometros: number | null;
    saltos: number | null;
  }>(
    `SELECT id, cardio_type, minutos, velocidad, kilometros, saltos
     FROM cardio_blocks WHERE workout_id = ?;`,
    [workoutId],
  );

  return rows.map((cb) => ({
    id: cb.id,
    type: cb.cardio_type,
    minutos: cb.minutos,
    ...(cb.velocidad !== null ? { velocidad: cb.velocidad } : {}),
    ...(cb.kilometros !== null ? { kilometros: cb.kilometros } : {}),
    ...(cb.saltos !== null ? { saltos: cb.saltos } : {}),
  }));
}

export async function getMonthlyCardioDistance(year: number, month: number): Promise<number> {
  const db = await getDatabase();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const result = await db.getFirstAsync<{ total_km: number | null }>(
    `SELECT SUM(cb.kilometros) AS total_km
     FROM cardio_blocks cb
     LEFT JOIN workouts w ON cb.workout_id = w.id
     WHERE w.date BETWEEN ? AND ?;`,
    [startDate, endDate],
  );

  return result?.total_km ?? 0;
}

export async function eliminarSesion(id: string): Promise<void> {
  await deleteWorkoutById(id);
}

/**
 * Elimina un entrenamiento y todos sus registros dependientes.
 * `exercise_logs`, `cardio_logs` y `cardio_blocks` declaran ON DELETE CASCADE sobre `workouts`
 * (con `PRAGMA foreign_keys = ON`). Aun así se borran explícitamente dentro de una transacción
 * para no dejar huérfanos en bases de datos antiguas donde la cascada no estuviera activa.
 */
export async function deleteWorkoutById(id: string): Promise<void> {
  const db = await getDatabase();
  const numericId = /^\d+$/.test(id) ? Number(id) : -1;
  const workout = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM workouts WHERE client_id = ? OR id = ? LIMIT 1;',
    [id, numericId],
  );
  if (!workout) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM exercise_logs WHERE workout_id = ?;', [workout.id]);
    await db.runAsync('DELETE FROM cardio_logs WHERE workout_id = ?;', [workout.id]);
    await db.runAsync('DELETE FROM cardio_blocks WHERE workout_id = ?;', [workout.id]);
    await db.runAsync('DELETE FROM workouts WHERE id = ?;', [workout.id]);
  });
}