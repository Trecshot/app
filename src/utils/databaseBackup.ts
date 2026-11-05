import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { getDatabase } from '../../database';

export interface BackupResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

/**
 * Realiza un volcado seguro de la base de datos SQLite (WAL checkpoint)
 * y permite al usuario exportarla o compartirla (guardar en Drive, enviar por correo, etc.)
 */
export async function exportDatabaseBackup(): Promise<BackupResult> {
  try {
    const db = await getDatabase();

    // 1. Forzar a SQLite a volcar todas las transacciones pendientes del WAL al archivo principal .db
    try {
      await db.execAsync('PRAGMA wal_checkpoint(FULL);');
    } catch (err) {
      console.warn('Aviso al ejecutar wal_checkpoint:', err);
    }

    // 2. Localizar el archivo principal gym_tracker.db
    const rawPath = db.databasePath;
    const normalizedRawPath = rawPath
      ? rawPath.startsWith('file://')
        ? rawPath
        : `file://${rawPath}`
      : null;

    const candidates = [
      normalizedRawPath,
      `${FileSystem.documentDirectory}SQLite/gym_tracker.db`,
      `${FileSystem.documentDirectory}gym_tracker.db`,
    ].filter((p): p is string => Boolean(p));

    let sourceUri: string | null = null;
    for (const uri of candidates) {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
          sourceUri = uri;
          break;
        }
      } catch {
        // Continuar al siguiente candidato
      }
    }

    if (!sourceUri) {
      const msg = 'No se encontró el archivo de base de datos en el almacenamiento interno.';
      Alert.alert('Error de Respaldo', msg);
      return { success: false, error: msg };
    }

    // 3. Crear archivo de respaldo temporal con fecha y hora en el directorio caché
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `gym_tracker_backup_${dateStr}_${timeStr}.db`;
    const targetUri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    });

    // 4. Compartir / Exportar mediante la sábana del sistema operativo
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      const msg = `La función de compartir no está disponible. Respaldo creado en:\n${targetUri}`;
      Alert.alert('Copia Creada', msg);
      return { success: true, fileName };
    }

    await Sharing.shareAsync(targetUri, {
      mimeType: 'application/x-sqlite3',
      dialogTitle: 'Exportar copia de seguridad de Gym Tracker',
      UTI: Platform.OS === 'ios' ? 'public.database' : undefined,
    });

    return { success: true, fileName };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido al exportar';
    console.error('Error al exportar base de datos:', error);
    Alert.alert('Error', `No se pudo generar la copia de seguridad: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
