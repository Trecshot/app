import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X, PlusCircle } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../theme';
import { SetRow } from './SetRow';
import { useWorkoutStore, WorkoutExercise } from '../../store/useWorkoutStore';

interface ExerciseCardProps {
  exerciseIndex: string;
  exercise: WorkoutExercise;
}

export const ExerciseCard = ({ exerciseIndex, exercise }: ExerciseCardProps) => {
  const { addSet, removeSet, updateSet, toggleSetComplete, removeExercise } = useWorkoutStore();

  return (
    <View style={GLOBAL_STYLES.card}>
      <View style={styles.header}>
        <Text style={styles.indexText}>{exerciseIndex}</Text>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        {/* Botón para eliminar el ejercicio completo */}
        <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
          <X color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.muscleGroupContainer}>
        <Text style={styles.muscleGroupText}>{exercise.muscleGroup}</Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.columnLabel, { width: 40, textAlign: 'center' }]}>SERIE</Text>
        <Text style={[styles.columnLabel, { flex: 1, textAlign: 'center' }]}>REPS</Text>
        <Text style={[styles.columnLabel, { flex: 1, textAlign: 'center' }]}>PESO (KG)</Text>
        {/* Espacio para botones OK y Eliminar */}
        <View style={{ width: 70 }} />
      </View>

      {/* Dibuja las series de forma dinámica */}
      {exercise.sets.map((set, index) => (
        <SetRow 
          key={set.id}
          setNumber={index + 1} 
          reps={set.reps} 
          weight={set.weight} 
          isCompleted={set.isCompleted}
          onChangeReps={(val) => updateSet(exercise.id, set.id, 'reps', val)}
          onChangeWeight={(val) => updateSet(exercise.id, set.id, 'weight', val)}
          onToggleComplete={() => toggleSetComplete(exercise.id, set.id)}
          onDelete={() => removeSet(exercise.id, set.id)}
        />
      ))}
      
      <TouchableOpacity style={styles.addSetButton} onPress={() => addSet(exercise.id)}>
        <PlusCircle size={16} color={COLORS.primaryDark} />
        <Text style={styles.addSetText}>Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  indexText: {
    color: COLORS.primaryDark,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: SPACING.sm,
  },
  exerciseName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  muscleGroupContainer: {
    backgroundColor: COLORS.surfaceHighlight,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: SPACING.md,
  },
  muscleGroupText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  columnLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  addSetText: {
    color: COLORS.primaryDark,
    fontWeight: '600',
    marginLeft: SPACING.xs,
    fontSize: 14,
  }
});
