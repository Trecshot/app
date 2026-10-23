import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WorkoutRepository } from '../src/db/repositories/WorkoutRepository';
import { NewBlockModal } from '../src/components/workout/NewBlockModal';
import { useSessionStore } from '../src/store/useSessionStore';

// Retener la pantalla de inicio del sistema operativo hasta que la base de datos se inicialice
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Inicialización temprana de la base de datos y migraciones seguras
        await WorkoutRepository.initSchema();
        // Evaluar la fecha actual contra el último bloque de 7 días
        await useSessionStore.getState().initBlock();
      } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
      } finally {
        setAppIsReady(true);
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

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <NewBlockModal />
      </View>
    </SafeAreaProvider>
  );
}
