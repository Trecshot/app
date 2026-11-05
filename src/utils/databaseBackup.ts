import { File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { getDatabase } from '../../database';

export interface BackupResult {
  success: boolean;
  fileName?: string;
  error?: string;
}

/**
 * Convierte un Uint8Array a cadena Base64 pura de forma eficiente y portable.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    const c0 = b0 >> 2;
    const c1 = ((b0 & 3) << 4) | (b1 >> 4);
    const c2 = ((b1 & 15) << 2) | (b2 >> 6);
    const c3 = b2 & 63;

    base64 += chars[c0] + chars[c1];
    base64 += i + 1 < len ? chars[c2] : '=';
    base64 += i + 2 < len ? chars[c3] : '=';
  }
  return base64;
}

/**
 * Realiza un volcado seguro de la base de datos SQLite (WAL checkpoint)
 * y permite al usuario exportarla o compartirla (guardar en Drive, enviar por correo, etc.).
 *
 * En Expo Go y Android sandboxed storage, las rutas internas de SQLite no son legibles
 * directamente por copyAsync de FileSystem. Por ello, se prioriza serializeAsync() nativo
 * de SQLite que extrae los bytes íntegros de la base de datos y los escribe en la caché pública.
 */
export async function exportDatabaseBackup(): Promise<BackupResult> {
  try {
    const db = await getDatabase();

    // 1. Forzar a SQLite a volcar todas las transacciones pendientes del WAL al archivo principal
    try {
      await db.execAsync('PRAGMA wal_checkpoint(FULL);');
    } catch (err) {
      console.warn('Aviso al ejecutar wal_checkpoint:', err);
    }

    // 2. Nombre del archivo con marca temporal
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `gym_tracker_backup_${dateStr}_${timeStr}.db`;

    let targetUri: string | null = null;

    // 3. Método Primario: Serialización nativa directa desde el motor SQLite
    try {
      const serializedData = await db.serializeAsync('main');
      if (serializedData && serializedData.byteLength > 0) {
        try {
          const targetFile = new File(Paths.cache, fileName);
          if (targetFile.exists) {
            targetFile.delete();
          }
          await targetFile.write(serializedData);
          targetUri = targetFile.uri;
        } catch {
          // Fallback de escritura mediante FileSystem legacy con base64
          const cacheDir = FileSystemLegacy.cacheDirectory ?? '';
          const fallbackUri = `${cacheDir}${fileName}`;
          const base64Data = uint8ArrayToBase64(serializedData);
          await FileSystemLegacy.writeAsStringAsync(fallbackUri, base64Data, {
            encoding: FileSystemLegacy.EncodingType.Base64,
          });
          targetUri = fallbackUri;
        }
      }
    } catch (serializeError) {
      console.warn('serializeAsync falló o no está soportado, recurriendo a búsqueda de archivo:', serializeError);
    }

    // 4. Método Secundario (Fallback): Búsqueda de archivo físico y copia si serializeAsync no estuvo disponible
    if (!targetUri) {
      const rawPath = db.databasePath;
      const normalizedRawPath = rawPath
        ? rawPath.startsWith('file://')
          ? rawPath
          : `file://${rawPath}`
        : null;

      const candidates = [
        normalizedRawPath,
        `${FileSystemLegacy.documentDirectory}SQLite/gym_tracker.db`,
        `${FileSystemLegacy.documentDirectory}gym_tracker.db`,
      ].filter((p): p is string => Boolean(p));

      let sourceUri: string | null = null;
      for (const uri of candidates) {
        try {
          const info = await FileSystemLegacy.getInfoAsync(uri);
          if (info.exists) {
            sourceUri = uri;
            break;
          }
        } catch {
          // Continuar al siguiente candidato
        }
      }

      if (!sourceUri) {
        const msg = 'No se pudo generar la copia de seguridad de la base de datos.';
        Alert.alert('Error de Respaldo', msg);
        return { success: false, error: msg };
      }

      const cacheDir = FileSystemLegacy.cacheDirectory ?? '';
      const fallbackTargetUri = `${cacheDir}${fileName}`;
      await FileSystemLegacy.copyAsync({
        from: sourceUri,
        to: fallbackTargetUri,
      });
      targetUri = fallbackTargetUri;
    }

    // 5. Compartir / Exportar mediante la sábana del sistema operativo
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      const msg = `La función de compartir no está disponible en este dispositivo.\nRespaldo creado en:\n${targetUri}`;
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
