import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Minus, Check, Flame, Zap, Shield, ChevronDown } from 'lucide-react-native';
import { COLORS, SPACING, GLOBAL_STYLES, theme } from '../../theme';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { TimerDisplay } from './TimerDisplay';
import type { SetType, WorkoutSet } from '../../../types';

export const getSetTypeColor = (type: SetType = 'NORMAL') => {
  switch (type) {
    case 'DROP_SET':
      return theme.colors.dropSetIndicator; // Crimson traslúcido
    case 'WARMUP':
      return theme.colors.warmupIndicator; // Amber traslúcido
    default:
      return theme.colors.normalSet; // Transparent/Base
  }
};

const SET_TYPE_OPTIONS: {
  type: SetType;
  shortLabel: string;
  pillText: string;
  label: string;
  description: string;
  accentColor: string;
}[] = [
  {
    type: 'NORMAL',
    shortLabel: 'N',
    pillText: 'Normal',
    label: 'Serie Normal',
    description: 'Serie efectiva de trabajo',
    accentColor: COLORS.primaryDark,
  },
  {
    type: 'WARMUP',
    shortLabel: 'W',
    pillText: 'Warmup',
    label: 'Calentamiento (Warmup)',
    description: 'Serie de aproximación',
    accentColor: COLORS.warmupAccent,
  },
  {
    type: 'DROP_SET',
    shortLabel: 'D',
    pillText: 'Drop',
    label: 'Drop Set',
    description: 'Reducción de carga al fallo',
    accentColor: COLORS.dropSetAccent,
  },
];

export interface SetRowProps {
  exerciseId?: string;
  setId?: string;
  setNumber: number;
  reps: string | number;
  weight: string | number;
  isCompleted: boolean;
  setType?: SetType;
  set?: WorkoutSet;
  onChangeReps?: (val: string) => void;
  onChangeWeight?: (val: string) => void;
  onChangeSetType?: (val: SetType) => void;
  onToggleComplete?: () => void;
  onDelete?: () => void;
}

const SetRowComponent = ({
  exerciseId,
  setId: setIdProp,
  setNumber,
  reps: repsProp,
  weight: weightProp,
  isCompleted: isCompletedProp,
  setType: setTypeProp,
  set: setObj,
  onChangeReps,
  onChangeWeight,
  onChangeSetType,
  onToggleComplete,
  onDelete,
}: SetRowProps) => {
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const updateSetType = useWorkoutStore((s) => s.updateSetType);
  const updateSetRestSeconds = useWorkoutStore((s) => s.updateSetRestSeconds);
  const updateSetStatus = useWorkoutStore((s) => s.updateSetStatus);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const defaultRestSeconds = useWorkoutStore((s) => s.defaultRestSeconds);
  const setDefaultRestSeconds = useWorkoutStore((s) => s.setDefaultRestSeconds);
  const { startTimer, stopTimer, activeSetId } = useWorkoutTimer();

  const [isTypePickerVisible, setIsTypePickerVisible] = useState(false);

  const setId = setObj?.id ?? setIdProp;
  const reps = String(setObj?.reps ?? repsProp ?? '');
  const weight = String(setObj?.weight ?? weightProp ?? '');
  const isCompleted = setObj?.isCompleted ?? isCompletedProp;
  const currentSetType: SetType = setObj?.setType ?? setTypeProp ?? 'NORMAL';
  const restSeconds = setObj?.restSeconds ?? defaultRestSeconds ?? 120;

  const handleChangeReps = useCallback(
    (val: string) => {
      if (onChangeReps) {
        onChangeReps(val);
      } else if (exerciseId && setId) {
        updateSet(exerciseId, setId, 'reps', val);
      }
    },
    [onChangeReps, exerciseId, setId, updateSet],
  );

  const handleChangeWeight = useCallback(
    (val: string) => {
      if (onChangeWeight) {
        onChangeWeight(val);
      } else if (exerciseId && setId) {
        updateSet(exerciseId, setId, 'weight', val);
      }
    },
    [onChangeWeight, exerciseId, setId, updateSet],
  );

  const handleSelectSetType = useCallback(
    (newType: SetType) => {
      if (onChangeSetType) {
        onChangeSetType(newType);
      } else if (exerciseId && setId) {
        updateSetType(exerciseId, setId, newType);
      }
      setIsTypePickerVisible(false);
    },
    [onChangeSetType, exerciseId, setId, updateSetType],
  );

  const handleSelectRestDuration = useCallback(
    (seconds: number) => {
      setDefaultRestSeconds(seconds);
      if (exerciseId && setId) {
        updateSetRestSeconds(exerciseId, setId, seconds);
      }
    },
    [exerciseId, setId, updateSetRestSeconds, setDefaultRestSeconds],
  );

  const handleToggleComplete = useCallback(() => {
    const newState = !isCompleted;
    if (onToggleComplete) {
      onToggleComplete();
    } else if (setId) {
      updateSetStatus(setId, newState, exerciseId);
    }

    if (newState) {
      // Disparo automatizado del temporizador inter-series debajo de esta serie
      void startTimer(restSeconds, setId);
    } else if (setId && activeSetId === setId) {
      void stopTimer();
    }
  }, [
    isCompleted,
    onToggleComplete,
    setId,
    exerciseId,
    updateSetStatus,
    startTimer,
    stopTimer,
    activeSetId,
    restSeconds,
  ]);

  const handleDelete = useCallback(() => {
    if (setId && activeSetId === setId) {
      void stopTimer();
    }
    if (onDelete) {
      onDelete();
    } else if (exerciseId && setId) {
      removeSet(exerciseId, setId);
    }
  }, [onDelete, exerciseId, setId, removeSet, activeSetId, stopTimer]);

  const currentOption =
    SET_TYPE_OPTIONS.find((o) => o.type === currentSetType) ?? SET_TYPE_OPTIONS[0];

  const badgeAccentColor =
    currentSetType === 'DROP_SET'
      ? COLORS.dropSetAccent
      : currentSetType === 'WARMUP'
      ? COLORS.warmupAccent
      : COLORS.primaryDark;

  return (
    <View style={styles.setBlockWrapper}>
      <View
        style={[
          styles.rowContainer,
          { backgroundColor: getSetTypeColor(currentSetType) },
          currentSetType === 'DROP_SET' && styles.rowDropSetBorder,
          currentSetType === 'WARMUP' && styles.rowWarmupBorder,
          isCompleted && currentSetType === 'NORMAL' && styles.rowCompleted,
          isCompleted && currentSetType !== 'NORMAL' && styles.rowCompletedTyped,
        ]}
      >
        {/* Selector compacto visible de tipo de serie (NORMAL / WARMUP / DROP_SET) */}
        <TouchableOpacity
          style={[
            styles.setTypeSelector,
            currentSetType === 'DROP_SET' && styles.setTypeSelectorDrop,
            currentSetType === 'WARMUP' && styles.setTypeSelectorWarmup,
          ]}
          onPress={() => setIsTypePickerVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Serie ${setNumber}, tipo ${currentOption.label}. Toca para cambiar tipo de serie`}
        >
          <Text style={[styles.setNumber, { color: badgeAccentColor }]}>{setNumber}</Text>
          <Text
            style={[styles.setTypePillText, { color: badgeAccentColor }]}
            numberOfLines={1}
          >
            {currentOption.pillText}
          </Text>
          <ChevronDown size={11} color={badgeAccentColor} />
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <TextInput
            style={[GLOBAL_STYLES.input, styles.inputBox, isCompleted && styles.inputCompleted]}
            keyboardType="numeric"
            value={reps}
            onChangeText={handleChangeReps}
            editable={!isCompleted}
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[GLOBAL_STYLES.input, styles.inputBox, isCompleted && styles.inputCompleted]}
            keyboardType="numeric"
            value={weight}
            onChangeText={handleChangeWeight}
            editable={!isCompleted}
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        {/* Botón de Completado (Dispara Temporizador Inter-Series automáticamente) */}
        <TouchableOpacity
          onPress={handleToggleComplete}
          style={[styles.actionButton, isCompleted && styles.actionButtonActive]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted }}
        >
          <Check size={20} color={isCompleted ? COLORS.surface : COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Botón de Eliminar */}
        <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
          <Minus size={20} color={COLORS.danger} />
        </TouchableOpacity>

        {/* Modal compacto para seleccionar el tipo de serie */}
        <Modal
          visible={isTypePickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsTypePickerVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsTypePickerVisible(false)}
          >
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Tipo de Serie #{setNumber}</Text>
              <Text style={styles.modalSubtitle}>
                Las series de calentamiento y drop sets se excluyen del cálculo de PR Absoluto.
              </Text>

              <View style={styles.segmentedList}>
                {SET_TYPE_OPTIONS.map((option) => {
                  const selected = currentSetType === option.type;
                  return (
                    <TouchableOpacity
                      key={option.type}
                      style={[
                        styles.optionRow,
                        selected && {
                          borderColor: option.accentColor,
                          backgroundColor:
                            option.type === 'NORMAL'
                              ? 'rgba(143, 155, 122, 0.12)'
                              : getSetTypeColor(option.type),
                        },
                      ]}
                      onPress={() => handleSelectSetType(option.type)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.optionBadge,
                          { backgroundColor: option.accentColor },
                        ]}
                      >
                        {option.type === 'DROP_SET' ? (
                          <Flame size={14} color={COLORS.surface} />
                        ) : option.type === 'WARMUP' ? (
                          <Zap size={14} color={COLORS.surface} />
                        ) : (
                          <Shield size={14} color={COLORS.surface} />
                        )}
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>

      {/* Temporizador Inter-Series ubicado abajo de la serie (entre series) */}
      <TimerDisplay
        setId={setId}
        selectedSeconds={restSeconds}
        isSetCompleted={isCompleted}
        onSelectDuration={handleSelectRestDuration}
      />
    </View>
  );
};

export const SetRow = memo(SetRowComponent);

const styles = StyleSheet.create({
  setBlockWrapper: {
    marginVertical: 2,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    paddingHorizontal: SPACING.xs,
  },
  rowDropSetBorder: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.dropSetAccent,
  },
  rowWarmupBorder: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warmupAccent,
  },
  rowCompleted: {
    backgroundColor: 'rgba(193, 225, 79, 0.2)',
  },
  rowCompletedTyped: {
    opacity: 0.92,
  },
  setTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 82,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 3,
  },
  setTypeSelectorDrop: {
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
    borderColor: 'rgba(220, 38, 38, 0.45)',
  },
  setTypeSelectorWarmup: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  setNumber: {
    fontWeight: '800',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  setTypePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  inputBox: {
    paddingVertical: 8,
    borderRadius: 8,
  },
  inputCompleted: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: COLORS.primaryDark,
  },
  actionButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
    borderRadius: 8,
  },
  actionButtonActive: {
    backgroundColor: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 17,
  },
  segmentedList: {
    gap: SPACING.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceHighlight,
    gap: SPACING.sm,
  },
  optionBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  optionDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});
