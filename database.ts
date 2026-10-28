import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { Cardio, CardioBlock, CardioLog, CardioType, Ejercicio, ExerciseLog, MuscleGroup, SesionEntrenamiento, TrainingBlock, WeekType, WeeklySummary, Workout, WorkoutDetails } from './types';
import { EXERCISE_CATALOG } from './types';
import {
  evaluateSessionPRs,
  getExerciseRecordKey,
  toStrictIntegerReps,
  toStrictRealWeight,
} from './src/utils/prEngine';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitialization: Promise<SQLite.SQLiteDatabase> | null = null;
let prRuleV7Applied = false;
let cardioFkFixed = false;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    if (!cardioFkFixed) {
      cardioFkFixed = true;
      await migrateFixCardioBlocksForeignKey(dbInstance).catch(() => undefined);
    }
    if (!prRuleV7Applied) {
      prRuleV7Applied = true;
      await migrateNumericTypesAndPRColumns(dbInstance).catch(() => undefined);
    }
    return dbInstance;
  }
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
        end_date TEXT NOT NULL,
        sessions_count INTEGER NOT NULL DEFAULT 0,
        target_sessions INTEGER NOT NULL DEFAULT 7
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
        block_id TEXT REFERENCES training_blocks (id) ON DELETE SET NULL,
        prs_count INTEGER NOT NULL DEFAULT 0
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
        reps INTEGER NOT NULL,      -- Forzado a INTEGER
        weight REAL NOT NULL,       -- Forzado a REAL (Evita ordenamiento alfabético con MAX)
        is_pr INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
        UNIQUE (workout_id, exercise_id, set_number)
      );
      CREATE INDEX IF NOT EXISTS idx_exercise_logs_catalog_weight ON exercise_logs (catalog_exercise_id, weight);
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
    await migrateFixCardioBlocksForeignKey(db);
    await migrateTrainingBlocksSessionCounter(db);
    await migrateNumericTypesAndPRColumns(db);
    cardioFkFixed = true;
    prRuleV7Applied = true;
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

/** Meta de sesiones efectivas por bloque de entrenamiento (7 sesiones). */
export const TRAINING_BLOCK_SESSIONS = 7;

/** Duración referencial de un bloque de entrenamiento (7 días). */
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

/**
 * Reconstruye `cardio_blocks` si su esquema heredado aún declara
 * `FOREIGN KEY (session_id) REFERENCES session (id)`, lo cual bloqueaba el borrado
 * tras haberse eliminado la tabla `session`.
 */
async function migrateFixCardioBlocksForeignKey(db: SQLite.SQLiteDatabase): Promise<void> {
  const tableInfo = await db.getFirstAsync<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cardio_blocks';",
  );
  if (!tableInfo?.sql || !tableInfo.sql.includes('session')) {
    return;
  }

  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE IF NOT EXISTS cardio_blocks_clean (
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
    INSERT OR IGNORE INTO cardio_blocks_clean (id, workout_id, cardio_type, minutos, velocidad, kilometros, saltos, created_at)
    SELECT id, workout_id, cardio_type, minutos, velocidad, kilometros, saltos, created_at
    FROM cardio_blocks
    WHERE workout_id IS NOT NULL;
    DROP TABLE cardio_blocks;
    ALTER TABLE cardio_blocks_clean RENAME TO cardio_blocks;
    PRAGMA foreign_keys = ON;
  `);
}

/**
 * Migración v6: añade `sessions_count` y `target_sessions` a `training_blocks`
 * para contabilizar bloques por 7 sesiones efectivas completadas.
 */
async function migrateTrainingBlocksSessionCounter(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(training_blocks);');
  if (!columns.some((col) => col.name === 'sessions_count')) {
    await db.execAsync(
      'ALTER TABLE training_blocks ADD COLUMN sessions_count INTEGER NOT NULL DEFAULT 0;',
    );
  }
  if (!columns.some((col) => col.name === 'target_sessions')) {
    await db.execAsync(
      'ALTER TABLE training_blocks ADD COLUMN target_sessions INTEGER NOT NULL DEFAULT 7;',
    );
  }
  await db.execAsync(`
    UPDATE training_blocks
    SET sessions_count = (
      SELECT COUNT(*) FROM workouts WHERE workouts.block_id = training_blocks.id
    );
  `);
}

/**
 * Migración v7 (Punto 6): Blindaje de afinidad numérica en `exercise_logs` (reps INTEGER, weight REAL)
 * y columnas de persistencia de Récords Personales Absolutos (`is_pr` y `prs_count`).
 */
async function migrateNumericTypesAndPRColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const workoutColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(workouts);');
  if (!workoutColumns.some((col) => col.name === 'prs_count')) {
    await db.execAsync('ALTER TABLE workouts ADD COLUMN prs_count INTEGER NOT NULL DEFAULT 0;');
  }

  const logColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(exercise_logs);');
  if (!logColumns.some((col) => col.name === 'is_pr')) {
    await db.execAsync('ALTER TABLE exercise_logs ADD COLUMN is_pr INTEGER NOT NULL DEFAULT 0;');
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_exercise_logs_catalog_weight
    ON exercise_logs (catalog_exercise_id, weight);
  `);

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if ((version?.user_version ?? 0) >= 7) return;

  // Forzar conversión a INTEGER y REAL sobre registros preexistentes y recalcular PRs históricos
  await db.execAsync(`
    UPDATE exercise_logs
    SET reps = CAST(reps AS INTEGER),
        weight = CAST(weight AS REAL);
  `);
  await recalculateAllHistoricalPRs(db);
  await db.execAsync('PRAGMA user_version = 7;');
}

/**
 * Consulta agregada en SQLite usando `MAX(CAST(weight AS REAL))` para obtener
 * las marcas personales históricas (PR Absoluto) por `catalog_exercise_id`.
 */
export async function getHistoricalMaxWeights(
  customDb?: SQLite.SQLiteDatabase,
  excludeWorkoutId?: number,
): Promise<Record<string, number>> {
  const db = customDb ?? (await getDatabase());
  const rows = await db.getAllAsync<{
    catalogExerciseId: string | null;
    exerciseName: string;
    maxWeight: number;
  }>(
    `SELECT
       catalog_exercise_id AS catalogExerciseId,
       exercise_name AS exerciseName,
       MAX(CAST(weight AS REAL)) AS maxWeight
     FROM exercise_logs
     WHERE CAST(reps AS INTEGER) > 0
       AND CAST(weight AS REAL) > 0
       AND (? IS NULL OR workout_id != ?)
     GROUP BY COALESCE(NULLIF(catalog_exercise_id, ''), LOWER(TRIM(exercise_name)));`,
    [excludeWorkoutId ?? null, excludeWorkoutId ?? null],
  );

  const map: Record<string, number> = {};
  for (const row of rows) {
    const key = getExerciseRecordKey(row.catalogExerciseId, row.exerciseName);
    if (key) {
      map[key] = toStrictRealWeight(row.maxWeight);
    }
  }
  return map;
}

/**
 * Recalcula cronológicamente los PRs Absolutos en la base de datos.
 */
export async function recalculateAllHistoricalPRs(
  customDb?: SQLite.SQLiteDatabase,
): Promise<void> {
  const db = customDb ?? (await getDatabase());
  const workouts = await db.getAllAsync<{ id: number; week_type: WeekType }>(
    'SELECT id, week_type FROM workouts ORDER BY date ASC, id ASC;',
  );

  await db.runAsync('UPDATE exercise_logs SET is_pr = 0;');
  await db.runAsync('UPDATE workouts SET prs_count = 0;');

  const runningMaxByKey: Record<string, number> = {};

  for (const workout of workouts) {
    const logs = await db.getAllAsync<{
      id: number;
      exercise_id: string;
      catalog_exercise_id: string | null;
      exercise_name: string;
      muscle_group: string;
      set_id: string;
      set_number: number;
      reps: number;
      weight: number;
    }>(
      `SELECT id, exercise_id, catalog_exercise_id, exercise_name, muscle_group,
              set_id, set_number, CAST(reps AS INTEGER) AS reps, CAST(weight AS REAL) AS weight
       FROM exercise_logs
       WHERE workout_id = ?
       ORDER BY exercise_order ASC, set_number ASC;`,
      [workout.id],
    );

    if (logs.length === 0) continue;

    // Agrupar por exercise_id preservando el orden
    const exercisesMap = new Map<string, Ejercicio>();
    for (const log of logs) {
      const existing = exercisesMap.get(log.exercise_id);
      if (existing) {
        existing.series.push({
          id: log.set_id || String(log.id),
          reps: toStrictIntegerReps(log.reps),
          pesoKg: toStrictRealWeight(log.weight),
        });
      } else {
        exercisesMap.set(log.exercise_id, {
          id: log.exercise_id,
          catalogExerciseId: log.catalog_exercise_id ?? undefined,
          nombre: log.exercise_name,
          grupoMuscular: log.muscle_group,
          series: [
            {
              id: log.set_id || String(log.id),
              reps: toStrictIntegerReps(log.reps),
              pesoKg: toStrictRealWeight(log.weight),
            },
          ],
        });
      }
    }

    const evaluation = evaluateSessionPRs(
      Array.from(exercisesMap.values()),
      runningMaxByKey,
      workout.week_type ?? 'carga',
    );
    Object.assign(runningMaxByKey, evaluation.updatedMaxWeightsByCatalogId);

    if (evaluation.totalPrs > 0) {
      await db.runAsync('UPDATE workouts SET prs_count = ? WHERE id = ?;', [
        evaluation.totalPrs,
        workout.id,
      ]);

      for (const ex of evaluation.exercises) {
        for (const s of ex.series) {
          if (s.isPr) {
            await db.runAsync(
              'UPDATE exercise_logs SET is_pr = 1 WHERE workout_id = ? AND exercise_id = ? AND set_id = ?;',
              [workout.id, ex.id, s.id],
            );
          }
        }
      }
    }
  }
}

interface TrainingBlockRow {
  id: string;
  type: WeekType;
  startDate: string;
  endDate: string;
  sessionCount: number;
  targetSessions: number;
}

const TRAINING_BLOCK_COLUMNS = `
  id,
  type,
  start_date AS startDate,
  end_date AS endDate,
  (SELECT COUNT(*) FROM workouts w WHERE w.block_id = training_blocks.id) AS sessionCount,
  COALESCE(target_sessions, ${TRAINING_BLOCK_SESSIONS}) AS targetSessions
`;

/** Último bloque registrado (el más reciente). */
export async function getLatestTrainingBlock(): Promise<TrainingBlock | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TrainingBlockRow>(
    `SELECT ${TRAINING_BLOCK_COLUMNS} FROM training_blocks ORDER BY start_date DESC, rowid DESC LIMIT 1;`,
  );
  return row ?? null;
}

/** Bloque activo vigente (con menos de 7 sesiones completadas, o el más reciente). */
export async function findTrainingBlockForDate(_date: Date = new Date()): Promise<TrainingBlock | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TrainingBlockRow>(
    `SELECT ${TRAINING_BLOCK_COLUMNS} FROM training_blocks ORDER BY start_date DESC, rowid DESC LIMIT 1;`,
  );
  if (!row) return null;
  if ((row.sessionCount ?? 0) >= (row.targetSessions ?? TRAINING_BLOCK_SESSIONS)) {
    return null;
  }
  return row;
}

/** Crea un bloque de 7 sesiones efectivas que inicia hoy (Sesión 1/7). */
export async function createTrainingBlock(type: WeekType, from: Date = new Date()): Promise<TrainingBlock> {
  const db = await getDatabase();
  const start = startOfLocalDay(from);
  const block: TrainingBlock = {
    id: Crypto.randomUUID(),
    type,
    startDate: start.toISOString(),
    endDate: addLocalDays(start, TRAINING_BLOCK_DAYS).toISOString(),
    sessionCount: 0,
    targetSessions: TRAINING_BLOCK_SESSIONS,
  };
  await db.runAsync(
    'INSERT INTO training_blocks (id, type, start_date, end_date, sessions_count, target_sessions) VALUES (?, ?, ?, ?, 0, ?);',
    [block.id, block.type, block.startDate, block.endDate, TRAINING_BLOCK_SESSIONS],
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
    await recalculateAllHistoricalPRs(db);
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
      exercise.series
        .filter((set) => Number(set.reps) > 0 && Number(set.pesoKg ?? 0) >= 0)
        .map((set, setIndex) => ({
          exerciseId: exercise.id,
          catalogExerciseId: exercise.catalogExerciseId,
          exerciseOrder,
          setId: set.id,
          exerciseName: exercise.nombre,
          muscleGroup: exercise.grupoMuscular?.trim() || exercise.selectedMuscleGroup || 'General',
          setNumber: setIndex + 1,
          reps: Number(set.reps),
          weight: Math.max(0, Number(set.pesoKg ?? 0)),
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
    await db.withTransactionAsync(async () => {
      // Resolver bloque de 7 sesiones dentro de la misma transacción atómica
      let block: TrainingBlockRow | null = null;
      if (workout.blockId) {
        block = await db.getFirstAsync<TrainingBlockRow>(
          `SELECT ${TRAINING_BLOCK_COLUMNS} FROM training_blocks WHERE id = ?;`,
          [workout.blockId],
        );
      } else {
        block = await db.getFirstAsync<TrainingBlockRow>(
          `SELECT ${TRAINING_BLOCK_COLUMNS} FROM training_blocks ORDER BY start_date DESC, rowid DESC LIMIT 1;`,
        );
      }

      // Si no hay bloque o ya alcanzó las 7/7 sesiones efectivas, crear uno nuevo automáticamente (sin bloqueo forzoso)
      const targetSessions = block?.targetSessions ?? TRAINING_BLOCK_SESSIONS;
      if (!block || (block.sessionCount ?? 0) >= targetSessions) {
        const parsedWorkoutDate = parseLocalDate(workout.date);
        const start = Number.isNaN(parsedWorkoutDate.getTime())
          ? startOfLocalDay(new Date())
          : startOfLocalDay(parsedWorkoutDate);
        const newBlockId = Crypto.randomUUID();
        const newBlockType: WeekType = block?.type ?? workout.weekType ?? 'carga';
        const startIso = start.toISOString();
        const endIso = addLocalDays(start, TRAINING_BLOCK_DAYS).toISOString();
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
        // Sesión 1/7: fijar la fecha exacta de inicio del bloque a la fecha de la primera sesión
        const parsedWorkoutDate = parseLocalDate(workout.date);
        if (!Number.isNaN(parsedWorkoutDate.getTime())) {
          const start = startOfLocalDay(parsedWorkoutDate);
          const startIso = start.toISOString();
          const endIso = addLocalDays(start, TRAINING_BLOCK_DAYS).toISOString();
          await db.runAsync(
            'UPDATE training_blocks SET start_date = ?, end_date = ? WHERE id = ?;',
            [startIso, endIso, block.id],
          );
          block.startDate = startIso;
          block.endDate = endIso;
        }
      }

      const clientId = workout.clientId ?? createClientId();
      const date = workout.date;
      const weekType: WeekType = block?.type ?? workout.weekType;
      const duration = workout.durationSeconds ?? 0;
      const notes = workout.notes?.trim() ? workout.notes.trim() : null;
      const blockId = block?.id ?? null;

      // 0. Consultar marcas históricas MAX(weight) antes de insertar los nuevos exercise_logs
      const historicalMaxWeights = await getHistoricalMaxWeights(db);
      const validExercises = exercises.filter(
        (ex) => toStrictIntegerReps(ex.reps) > 0 && toStrictRealWeight(ex.weight) >= 0,
      );

      // Agrupar series por ejercicio para evaluar PRs Absolutos frente al historial
      const groupedExercises = new Map<string, Ejercicio>();
      for (const ex of validExercises) {
        const exId = ex.exerciseId ?? ex.exerciseName;
        const existing = groupedExercises.get(exId);
        if (existing) {
          existing.series.push({
            id: ex.setId ?? Crypto.randomUUID(),
            reps: toStrictIntegerReps(ex.reps),
            pesoKg: toStrictRealWeight(ex.weight),
          });
        } else {
          groupedExercises.set(exId, {
            id: exId,
            catalogExerciseId: ex.catalogExerciseId,
            nombre: ex.exerciseName,
            grupoMuscular: ex.muscleGroup,
            series: [
              {
                id: ex.setId ?? Crypto.randomUUID(),
                reps: toStrictIntegerReps(ex.reps),
                pesoKg: toStrictRealWeight(ex.weight),
              },
            ],
          });
        }
      }

      const prEvaluation = evaluateSessionPRs(
        Array.from(groupedExercises.values()),
        historicalMaxWeights,
        weekType,
      );
      const prSetIds = new Set<string>();
      for (const evEx of prEvaluation.exercises) {
        for (const evSet of evEx.series) {
          if (evSet.isPr) {
            prSetIds.add(`${evEx.id}::${evSet.id}`);
          }
        }
      }

      // 1. Insertar cabecera de la sesión en 'workouts'
      const workoutResult = await db.runAsync(
        `INSERT INTO workouts (client_id, date, week_type, cycle_week, duration_seconds, notes, session_focus, block_id, prs_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          clientId,
          date,
          weekType,
          getIsoWeekNumber(date),
          duration,
          notes,
          workout.sessionFocus ? JSON.stringify(workout.sessionFocus) : null,
          blockId,
          prEvaluation.totalPrs,
        ],
      );
      workoutId = workoutResult.lastInsertRowId;

      // 2. Inserción masiva (Bulk Insert) de ejercicios y series en 'exercise_logs' con tipos blindados (INTEGER y REAL)
      if (validExercises.length > 0) {
        const placeholders = validExercises
          .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .join(', ');
        const values = validExercises.flatMap((exercise, index) => {
          const exId = exercise.exerciseId ?? Crypto.randomUUID();
          const setId = exercise.setId ?? Crypto.randomUUID();
          const isPr = prSetIds.has(`${exId}::${setId}`) ? 1 : 0;
          return [
            workoutId,
            exId,
            exercise.catalogExerciseId ?? null,
            exercise.exerciseOrder ?? index,
            exercise.exerciseName,
            exercise.muscleGroup,
            setId,
            exercise.setNumber,
            toStrictIntegerReps(exercise.reps),
            toStrictRealWeight(exercise.weight),
            isPr,
          ];
        });
        await db.runAsync(
          `INSERT INTO exercise_logs (
            workout_id, exercise_id, catalog_exercise_id, exercise_order, exercise_name,
            muscle_group, set_id, set_number, reps, weight, is_pr
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

      // 3. Inserción de bloques de cardio en 'cardio_blocks'
      if (cardioBlocks && cardioBlocks.length > 0) {
        await db.runAsync('DELETE FROM cardio_blocks WHERE workout_id = ?;', [workoutId]);
        const placeholders = cardioBlocks.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = cardioBlocks.flatMap((cBlock) => [
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

      // 4. Actualizar el contador de sesiones efectivas del bloque
      if (blockId) {
        await db.runAsync(
          `UPDATE training_blocks
           SET sessions_count = (SELECT COUNT(*) FROM workouts WHERE block_id = ?)
           WHERE id = ?;`,
          [blockId, blockId],
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
      blockSessionCount: number | null;
      blockTargetSessions: number | null;
      prsCount: number | null;
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
        COALESCE(w.prs_count, 0) AS prsCount,
        tb.id AS blockId,
        tb.type AS blockType,
        tb.start_date AS blockStartDate,
        tb.end_date AS blockEndDate,
        (SELECT COUNT(*) FROM workouts bw WHERE bw.block_id = tb.id) AS blockSessionCount,
        COALESCE(tb.target_sessions, 7) AS blockTargetSessions,
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
                    'reps', CAST(s.reps AS INTEGER),
                    'pesoKg', CAST(s.weight AS REAL),
                    'isPr', COALESCE(s.is_pr, 0)
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
                    reps: toStrictIntegerReps(s.reps),
                    pesoKg: toStrictRealWeight(s.pesoKg),
                    isPr: Boolean(s.isPr),
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
        prs: Number(row.prsCount ?? 0),
        ...(row.blockId && row.blockType && row.blockStartDate && row.blockEndDate
          ? {
              blockId: row.blockId,
              block: {
                id: row.blockId,
                type: row.blockType,
                startDate: row.blockStartDate,
                endDate: row.blockEndDate,
                sessionCount: row.blockSessionCount ?? 0,
                targetSessions: row.blockTargetSessions ?? TRAINING_BLOCK_SESSIONS,
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

  // Normalizamos el ID por si llega como texto (UUID) o número
  const numericId = /^\d+$/.test(id) ? Number(id) : -1;

  // Obtenemos el ID numérico interno de la tabla workouts
  const workout = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM workouts WHERE client_id = ? OR id = ? LIMIT 1;',
    [String(id), numericId],
  );

  if (!workout) {
    console.warn(`No se encontró el entrenamiento con ID: ${id}`);
    return;
  }

  // Transacción atómica blindada para evitar bloqueos de llaves foráneas
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM exercise_logs WHERE workout_id = ?;', [workout.id]);
    await db.runAsync('DELETE FROM cardio_logs WHERE workout_id = ?;', [workout.id]);
    await db.runAsync('DELETE FROM cardio_blocks WHERE workout_id = ?;', [workout.id]);
    await db.runAsync('DELETE FROM workouts WHERE id = ?;', [workout.id]);
  });
}