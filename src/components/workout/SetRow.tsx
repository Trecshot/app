import React, { memo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Check } from 'lucide-react-native';
import { COLORS, SPACING, GLOBAL_STYLES } from '../../theme';
import { useWorkoutStore } from '../../store/useWorkoutStore';

export interface SetRowProps {
  exerciseId?: string;
  setId?: string;
  setNumber: number;
  reps: string;
  weight: string;
  isCompleted: boolean;
  onChangeReps?: (val: string) => void;
  onChangeWeight?: (val: string) => void;
  onToggleComplete?: () => void;
  onDelete?: () => void;
}

const SetRowComponent = ({
  exerciseId,
  setId,
  setNumber,
  reps,
  weight,
  isCompleted,
  onChangeReps,
  onChangeWeight,
  onToggleComplete,
  onDelete,
}: SetRowProps) => {
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const removeSet = useWorkoutStore((s) => s.removeSet);

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

  const handleToggleComplete = useCallback(() => {
    if (onToggleComplete) {
      onToggleComplete();
    } else if (exerciseId && setId) {
      toggleSetComplete(exerciseId, setId);
    }
  }, [onToggleComplete, exerciseId, setId, toggleSetComplete]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete();
    } else if (exerciseId && setId) {
      removeSet(exerciseId, setId);
    }
  }, [onDelete, exerciseId, setId, removeSet]);

  return (
    <View style={[styles.rowContainer, isCompleted && styles.rowCompleted]}>
      <Text style={styles.setNumber}>{setNumber}</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[GLOBAL_STYLES.input, styles.inputBox, isCompleted && styles.inputCompleted]}
          keyboardType="numeric"
          value={reps}
          onChangeText={handleChangeReps}
          editable={!isCompleted} // Bloquea escritura si está marcado como OK
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

      {/* Botón de Completado */}
      <TouchableOpacity
        onPress={handleToggleComplete}
        style={[styles.actionButton, isCompleted && styles.actionButtonActive]}
      >
        <Check size={20} color={isCompleted ? COLORS.surface : COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Botón de Eliminar */}
      <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
        <Minus size={20} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
};

export const SetRow = memo(SetRowComponent);

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    marginVertical: 2,
    paddingHorizontal: SPACING.xs,
  },
  rowCompleted: {
    backgroundColor: 'rgba(193, 225, 79, 0.2)', // Verde lima transparente al completar
  },
  setNumber: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 16,
    width: 30,
    textAlign: 'center',
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
});
