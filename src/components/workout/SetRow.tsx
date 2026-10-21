import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus } from 'lucide-react-native';
import { COLORS, SPACING, GLOBAL_STYLES } from '../../theme';

interface SetRowProps {
  setNumber: number;
  reps?: string;
  weight?: string;
  onDelete?: () => void;
}

export const SetRow = ({ setNumber, reps, weight, onDelete }: SetRowProps) => {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.setNumber}>{setNumber}</Text>
      
      <View style={styles.inputContainer}>
        <TextInput 
          style={[GLOBAL_STYLES.input, styles.inputBox]} 
          keyboardType="numeric" 
          defaultValue={reps}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput 
          style={[GLOBAL_STYLES.input, styles.inputBox]} 
          keyboardType="numeric" 
          defaultValue={weight}
        />
      </View>

      <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
        <Minus size={20} color={COLORS.textSecondary} />
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
  deleteButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  }
});
