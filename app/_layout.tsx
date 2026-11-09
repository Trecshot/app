import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WorkoutRepository } from '../src/db/repositories/WorkoutRepository';
import { NewBlockModal } from '../src/components/workout/NewBlockModal';
import { useSessionStore } from '../src/store/useSessionStore';
import { configurarCanalNotificaciones } from '../src/utils/restNotifications';
import AnimatedSplashScreen from '../src/components/AnimatedSplashScreen';

// Retener la pantalla de inicio del sistema operativo hasta que la base de datos se inicialice
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Inicialización temprana de la base de datos y migraciones seguras
        await WorkoutRepository.initSchema();
        // Configurar canal de notificaciones 'descanso-series' con prioridad MAX en el montaje inicial
        void configurarCanalNotificaciones();
        // Evaluar la fecha actual contra el último bloque de 7 días
        await useSessionStore.getState().initBlock();
      } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
      } finally {
        setAppIsReady(true);
        // Ocultar el splash nativo estático de Expo para dar paso a la animación neón
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    }

    void prepare();
  }, []);

  // Re-evaluar el bloque al volver a primer plano (puede haber expirado con la app abierta)
  useEffect(() => {
    if (!appIsReady) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void useSessionStore.getState().initBlock();
      }
    });
    return () => subscription.remove();
  }, [appIsReady]);

  if (!appIsReady || !animationFinished) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar style="light" />
        <AnimatedSplashScreen
          onAnimationFinish={() => {
            setAnimationFinished(true);
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#000000' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <NewBlockModal />
      </View>
    </SafeAreaProvider>
  );
}
