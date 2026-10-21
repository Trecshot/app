import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Check } from 'lucide-react-native';
import { COLORS, SPACING, GLOBAL_STYLES } from '../../theme';

interface SetRowProps {
  setNumber: number;
  reps: string;
  weight: string;
  isCompleted: boolean;
  onChangeReps: (val: string) => void;
  onChangeWeight: (val: string) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}

export const SetRow = ({ setNumber, reps, weight, isCompleted, onChangeReps, onChangeWeight, onToggleComplete, onDelete }: SetRowProps) => {
  return (
    <View style={[styles.rowContainer, isCompleted && styles.rowCompleted]}>
      <Text style={styles.setNumber}>{setNumber}</Text>
      
      <View style={styles.inputContainer}>
        <TextInput 
          style={[GLOBAL_STYLES.input, styles.inputBox, isCompleted && styles.inputCompleted]} 
          keyboardType="numeric" 
          value={reps}
          onChangeText={onChangeReps}
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
          onChangeText={onChangeWeight}
          editable={!isCompleted} 
          placeholder="0"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Botón de Completado */}
      <TouchableOpacity onPress={onToggleComplete} style={[styles.actionButton, isCompleted && styles.actionButtonActive]}>
        <Check size={20} color={isCompleted ? COLORS.surface : COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Botón de Eliminar */}
      <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
        <Minus size={20} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
};

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
  }
});
