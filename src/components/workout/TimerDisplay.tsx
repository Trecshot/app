import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { COLORS } from '../../theme';

interface TimerDisplayProps {
  style?: StyleProp<TextStyle>;
}

export const TimerDisplay = ({ style }: TimerDisplayProps) => {
  const elapsedSeconds = useWorkoutTimer();

  // Formateo estandarizado HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return <Text style={[styles.timerText, style]}>{formatTime(elapsedSeconds)}</Text>;
};

const styles = StyleSheet.create({
  timerText: {
    color: COLORS.textInverted,
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
