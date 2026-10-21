import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS, SPACING, GLOBAL_STYLES } from '../../theme';

interface SetRowProps {
  setNumber: number;
  previousRecord: string;
  isCompleted: boolean;
  onToggleComplete?: () => void;
}

export const SetRow = ({ setNumber, previousRecord, isCompleted, onToggleComplete }: SetRowProps) => {
  return (
    <View style={[styles.rowContainer, isCompleted && styles.rowCompleted]}>
      <Text style={styles.setNumber}>{setNumber}</Text>
      <Text style={styles.previousText}>{previousRecord}</Text>
      
      <TextInput 
        style={GLOBAL_STYLES.input} 
        keyboardType="numeric" 
        placeholder="KG" 
        placeholderTextColor={COLORS.textSecondary}
      />
      <TextInput 
        style={GLOBAL_STYLES.input} 
        keyboardType="numeric" 
        placeholder="Reps" 
        placeholderTextColor={COLORS.textSecondary}
      />

      <TouchableOpacity 
        style={[styles.checkButton, isCompleted && styles.checkButtonActive]}
        onPress={onToggleComplete}
      >
        <Check size={20} color={isCompleted ? COLORS.background : COLORS.textSecondary} />
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)', // Feedback visual sutil cuando se marca la serie
  },
  setNumber: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    width: 24,
  },
  previousText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  checkButton: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 8,
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  checkButtonActive: {
    backgroundColor: COLORS.success,
  }
});
