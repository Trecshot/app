import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useSessionStore } from '../store/useSessionStore';

const KEEP_AWAKE_TAG = 'workout-session';

export const useWorkoutTimer = (): number => {
  const { startTimestamp, isActive, isRunning, accumulatedMs } = useSessionStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const syncElapsed = () => {
      if (isActive && isRunning && startTimestamp) {
        const now = Date.now();
        const diffInSeconds = Math.floor((accumulatedMs + Math.max(0, now - startTimestamp)) / 1000);
        setElapsedSeconds(diffInSeconds);
      }
    };

    if (isActive && isRunning && startTimestamp) {
      // Sincronización a 1Hz calculando la diferencia contra el tiempo real absoluto
      intervalId = setInterval(syncElapsed, 1000);
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncElapsed();
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      subscription.remove();
    };
  }, [isActive, isRunning, startTimestamp, accumulatedMs]);

  useEffect(() => {
    if (!isActive || !isRunning) return undefined;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [isActive, isRunning]);

  if (!isActive) return 0;
  if (!isRunning) return Math.floor(accumulatedMs / 1000);
  return elapsedSeconds;
};
