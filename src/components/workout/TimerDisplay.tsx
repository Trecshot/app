import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { c } from '../../theme';

interface TimerDisplayProps {
  style?: StyleProp<TextStyle>;
}

export const TimerDisplay = ({ style }: TimerDisplayProps) => {
  const elapsedSeconds = useWorkoutTimer();

  // Formateo estandarizado HH:MM:SS o MM:SS
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return <Text style={[styles.timerText, style]}>{formatTime(elapsedSeconds)}</Text>;
};

const styles = StyleSheet.create({
  timerText: {
    color: c.white,
    fontSize: 46,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 18,
    fontVariant: ['tabular-nums'], // Evita el salto horizontal de los números
  },
});
