import React, { useEffect, useState } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Timer, ChevronDown, ChevronUp, X, Play } from 'lucide-react-native';
import {
  useWorkoutTimer,
  useSessionElapsedTimer,
  REST_TIMER_OPTIONS,
  formatRestDuration,
} from '../../hooks/useWorkoutTimer';
import { COLORS, SPACING } from '../../theme';

export interface TimerDisplayProps {
  setId?: string;
  selectedSeconds?: number;
  isSetCompleted?: boolean;
  onSelectDuration?: (seconds: number) => void;
  timeLeft?: number;
  isActive?: boolean;
  onStop?: () => void;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  setId,
  selectedSeconds = 120,
  isSetCompleted = false,
  onSelectDuration,
  timeLeft: timeLeftProp,
  isActive: isActiveProp,
  onStop,
}) => {
  const timerHook = useWorkoutTimer();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isRunningForThisSet = setId
    ? timerHook.isActive &&
      timerHook.activeSetId === setId &&
      timerHook.timeLeft > 0
    : Boolean(
        (isActiveProp ?? timerHook.isActive) &&
          (timeLeftProp ?? timerHook.timeLeft) > 0,
      );

  const activeTimeLeft = setId
    ? timerHook.timeLeft
    : (timeLeftProp ?? timerHook.timeLeft);

  const [dropdownAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(dropdownAnim, {
      toValue: isDropdownOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isDropdownOpen, dropdownAnim]);

  const dropdownAnimatedStyle = {
    maxHeight: dropdownAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 130],
    }),
    opacity: dropdownAnim,
    overflow: 'hidden' as const,
  };

  const handleSelectOption = (seconds: number) => {
    onSelectDuration?.(seconds);
    setIsDropdownOpen(false);

    // Si el temporizador ya está activo en esta serie o la serie ya fue completada,
    // actualizar/iniciar inmediatamente la cuenta regresiva con el nuevo tiempo elegido.
    if (isRunningForThisSet || isSetCompleted) {
      void timerHook.startTimer(seconds, setId);
    }
  };

  const handleManualStart = () => {
    setIsDropdownOpen(false);
    void timerHook.startTimer(selectedSeconds, setId);
  };

  const handleStop = () => {
    setIsDropdownOpen(false);
    if (onStop) {
      onStop();
    } else {
      void timerHook.stopTimer();
    }
  };

  return (
    <View style={styles.interSeriesContainer}>
      {/* Línea conectora y botón de Temporizador entre series */}
      <View
        style={[
          styles.timerBar,
          isRunningForThisSet && styles.timerBarActive,
          isDropdownOpen && !isRunningForThisSet && styles.timerBarExpanded,
        ]}
      >
        <TouchableOpacity
          style={styles.timerMainButton}
          onPress={() => setIsDropdownOpen((prev) => !prev)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Configurar tiempo del temporizador de descanso entre series"
        >
          <Timer
            size={15}
            color={isRunningForThisSet ? COLORS.primary : COLORS.primaryDark}
          />

          {isRunningForThisSet ? (
            <View style={styles.activeCountdownRow}>
              <Text style={styles.activeLabelText}>DESCANSO</Text>
              <Text style={styles.activeCountdownText}>
                {formatRestDuration(activeTimeLeft)}
              </Text>
              <View style={styles.changePresetBadge}>
                <Text style={styles.changePresetText}>
                  {formatRestDuration(selectedSeconds)}
                </Text>
                {isDropdownOpen ? (
                  <ChevronUp size={12} color={COLORS.primary} />
                ) : (
                  <ChevronDown size={12} color={COLORS.primary} />
                )}
              </View>
            </View>
          ) : (
            <View style={styles.idleTimerRow}>
              <Text style={styles.idleTimerLabel}>Temporizador</Text>
              <View style={styles.selectedTimePill}>
                <Text style={styles.selectedTimePillText}>
                  {formatRestDuration(selectedSeconds)}
                </Text>
                {isDropdownOpen ? (
                  <ChevronUp size={12} color={COLORS.primaryDark} />
                ) : (
                  <ChevronDown size={12} color={COLORS.primaryDark} />
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Acción rápida a la derecha: Detener si está activo, o Iniciar manualmente si está inactivo */}
        {isRunningForThisSet ? (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStop}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Detener temporizador de descanso"
          >
            <X size={14} color={COLORS.textInverted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.playManualButton}
            onPress={handleManualStart}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Iniciar temporizador de ${formatRestDuration(selectedSeconds)}`}
          >
            <Play size={12} color={COLORS.primaryDark} />
          </TouchableOpacity>
        )}
      </View>

      {/* Despliegue de opciones: 1:00, 2:00, 2:30, 3:00, 3:30, 4:00, 4:30, 5:00 */}
      <Animated.View style={[styles.dropdownContainer, dropdownAnimatedStyle]}>
        <View style={styles.optionsGrid}>
          {REST_TIMER_OPTIONS.map((option) => {
            const isSelected = selectedSeconds === option.seconds;
            return (
              <TouchableOpacity
                key={option.seconds}
                style={[
                  styles.optionChip,
                  isSelected && styles.optionChipSelected,
                ]}
                onPress={() => handleSelectOption(option.seconds)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar descanso de ${option.label}`}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    isSelected && styles.optionChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};

export interface SessionStopwatchDisplayProps {
  style?: StyleProp<TextStyle>;
}

export const SessionStopwatchDisplay: React.FC<SessionStopwatchDisplayProps> = ({
  style,
}) => {
  const elapsedSeconds = useSessionElapsedTimer();

  const formatElapsed = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Text style={[styles.stopwatchText, style]}>
      {formatElapsed(elapsedSeconds)}
    </Text>
  );
};

const styles = StyleSheet.create({
  interSeriesContainer: {
    marginTop: 2,
    marginBottom: 6,
    paddingHorizontal: SPACING.xs,
  },
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  timerBarExpanded: {
    borderColor: COLORS.primaryDark,
    backgroundColor: 'rgba(143, 155, 122, 0.12)',
  },
  timerBarActive: {
    backgroundColor: COLORS.timerSurface,
    borderColor: COLORS.primary,
    paddingVertical: 8,
  },
  timerMainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  idleTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idleTimerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  selectedTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedTimePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  activeCountdownRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeLabelText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activeCountdownText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  changePresetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(193, 225, 79, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(193, 225, 79, 0.35)',
  },
  changePresetText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stopButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.28)',
    padding: 5,
    borderRadius: 6,
    marginLeft: 6,
  },
  playManualButton: {
    backgroundColor: 'rgba(143, 155, 122, 0.18)',
    padding: 5,
    borderRadius: 6,
    marginLeft: 6,
  },
  dropdownContainer: {
    marginTop: 4,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 8,
  },
  optionChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 54,
    alignItems: 'center',
  },
  optionChipSelected: {
    backgroundColor: COLORS.timerSurface,
    borderColor: COLORS.primary,
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  optionChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  stopwatchText: {
    color: COLORS.textInverted,
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
