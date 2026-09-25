import * as SQLite from 'expo-sqlite';
import { SesionEntrenamiento } from './types';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitialization: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (!dbInitialization) {
    dbInitialization = (async () => {
      const db = await SQLite.openDatabaseAsync('gym_tracker.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sesiones (
          id TEXT PRIMARY KEY NOT NULL,
          fecha TEXT NOT NULL,
          duracion_segundos INTEGER NOT NULL,
          tipo_semana TEXT NOT NULL,
          datos_json TEXT NOT NULL
        );
      `);
      dbInstance = db;
      return db;
    })();
  }
  return dbInitialization;
}

export async function guardarSesion(sesion: SesionEntrenamiento): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sesiones (id, fecha, duracion_segundos, tipo_semana, datos_json)
     VALUES (?, ?, ?, ?, ?);`,
    [sesion.id, sesion.fecha, sesion.duracionSegundos, sesion.tipoSemana, JSON.stringify(sesion)],
  );
}

export async function obtenerSesiones(): Promise<SesionEntrenamiento[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ datos_json: string }>(
    'SELECT datos_json FROM sesiones ORDER BY fecha DESC, rowid DESC;',
  );
  return rows.map((row) => JSON.parse(row.datos_json) as SesionEntrenamiento);
}

export async function eliminarSesion(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sesiones WHERE id = ?;', [id]);
}