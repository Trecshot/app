import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../theme';
import { SetRow } from './SetRow';

interface ExerciseCardProps {
  exerciseName: string;
}

export const ExerciseCard = ({ exerciseName }: ExerciseCardProps) => {
  return (
    <View style={GLOBAL_STYLES.card}>
      <View style={styles.header}>
        <Text style={GLOBAL_STYLES.title}>{exerciseName}</Text>
        <TouchableOpacity>
          <MoreHorizontal color={COLORS.textSecondary} size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.columnLabel, { width: 24 }]}>SET</Text>
        <Text style={[styles.columnLabel, { flex: 1, textAlign: 'center' }]}>PREVIO</Text>
        <Text style={[styles.columnLabel, { minWidth: 60, textAlign: 'center' }]}>KG</Text>
        <Text style={[styles.columnLabel, { minWidth: 60, textAlign: 'center' }]}>REPS</Text>
        <Text style={[styles.columnLabel, { width: 36, textAlign: 'center' }]}>ok</Text>
      </View>

      {/* Mockup visual de las filas. Más adelante, esto se renderizará mapeando el estado de Zustand */}
      <SetRow setNumber={1} previousRecord="200 kg x 8" isCompleted={true} />
      <SetRow setNumber={2} previousRecord="200 kg x 8" isCompleted={false} />
      
      <TouchableOpacity style={styles.addSetButton}>
        <Text style={styles.addSetText}>+ Añadir Serie</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  columnLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  addSetButton: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  addSetText: {
    color: COLORS.primary,
    fontWeight: '600',
  }
});
