import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useSessionStore } from '../store/useSessionStore';

const KEEP_AWAKE_TAG = 'workout-session';

export const useWorkoutTimer = (): number => {
  const { startTimestamp, isActive, isRunning, accumulatedMs } = useSessionStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive || !isRunning || !startTimestamp) {
      return undefined;
    }

    const updateTime = () => {
      const now = Date.now();
      const currentElapsed = Math.floor(
        (accumulatedMs + Math.max(0, now - startTimestamp)) / 1000,
      );
      setElapsedSeconds(currentElapsed);
    };

    const intervalId = setInterval(updateTime, 1000);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        updateTime();
      }
    });

    return () => {
      clearInterval(intervalId);
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
  return Math.max(Math.floor(accumulatedMs / 1000), elapsedSeconds);
};
