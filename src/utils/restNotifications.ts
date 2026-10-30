import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export const REST_NOTIFICATION_CHANNEL_ID = 'descanso-series';

let handlerConfigured = false;
let channelReadyPromise: Promise<void> | null = null;

/**
 * Obtiene el módulo nativo de `expo-notifications` de forma segura (evita RedBox si falta el módulo nativo).
 */
function getNotificationsModule(): typeof import('expo-notifications') | null {
  try {
    if (!requireOptionalNativeModule('ExpoNotificationScheduler')) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');

    if (!handlerConfigured && Notifications?.setNotificationHandler) {
      handlerConfigured = true;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    }

    return Notifications;
  } catch {
    return null;
  }
}

/**
 * 2. Configura el canal de notificaciones con Máxima Importancia (Android 8.0+)
 * y solicita permisos de notificaciones al montar la aplicación (`app/_layout.tsx`).
 */
export async function configurarCanalNotificaciones(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  if (!channelReadyPromise) {
    channelReadyPromise = (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(REST_NOTIFICATION_CHANNEL_ID, {
            name: 'Temporizador de Descanso',
            importance: Notifications.AndroidImportance.MAX, // Permite banner flotante y sonido con pantalla apagada
            vibrationPattern: [0, 500, 250, 500],
            sound: 'default',
            enableVibrate: true,
            bypassDnd: false,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            audioAttributes: {
              usage: Notifications.AndroidAudioUsage.ALARM,
              contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            },
          });
        }

        const perms = await Notifications.getPermissionsAsync();
        if (perms.status !== 'granted') {
          await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: false,
              allowSound: true,
            },
          });
        }
      } catch {
        // Ignorar en entornos sin soporte nativo de notificaciones (ej. web)
      }
    })();
  }

  await channelReadyPromise;
}

/**
 * 1. Delega el disparo de la notificación directamente al sistema de alarmas del SO
 * (`AlarmManager` en Android / `UNUserNotificationCenter` en iOS) al iniciar el descanso,
 * sin depender de temporizadores JS (`setTimeout` / `setInterval`) en segundo plano.
 */
export async function programarAlarmaDescanso(segundos: number): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  const cleanSeconds = Math.max(1, Math.round(segundos));

  try {
    // Asegurar que el canal 'descanso-series' exista antes de agendar
    await configurarCanalNotificaciones();

    // Cancelar alarmas previas activas del temporizador si las hubiera
    await Notifications.cancelAllScheduledNotificationsAsync();

    const content = {
      title: '¡Descanso terminado!',
      body: 'Hora de la siguiente serie.',
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
    };

    if (Platform.OS === 'android') {
      try {
        // En Android SDK 58+, DATE con delivery: 'alarmClock' invoca AlarmManager.setAlarmClock(),
        // que despierta el hardware incluso en reposo profundo (Doze / HyperOS / MIUI).
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: Date.now() + cleanSeconds * 1000,
            channelId: REST_NOTIFICATION_CHANNEL_ID,
            delivery: 'alarmClock',
          },
        });
        return;
      } catch {
        // Fallback inmediato a TIME_INTERVAL si el binario actual (ej. versión previa de Expo Go)
        // no soporta el parámetro delivery: 'alarmClock'.
      }
    }

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: cleanSeconds,
        channelId: Platform.OS === 'android' ? REST_NOTIFICATION_CHANNEL_ID : undefined,
      },
    });
  } catch {
    // Continuar de forma segura si el sistema bloquea el agendamiento
  }
}

/**
 * Cancela cualquier alarma nativa de descanso pendiente cuando el usuario detiene
 * o desmarca la serie antes de que termine el tiempo.
 */
export async function cancelarAlarmaDescanso(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignorar error de cancelación
  }
}
