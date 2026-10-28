import React, { useState, useMemo, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { X, PlusCircle, ChevronDown, Dumbbell, Tag, Lock, CheckCheck } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../theme';
import { SetRow } from './SetRow';
import { ExerciseBottomSheet } from './ExerciseBottomSheet';
import {
  useWorkoutStore,
  WorkoutExerciseBlock,
} from '../../store/useWorkoutStore';
import {
  EXERCISE_CATALOG,
  MUSCLE_GROUPS,
  MuscleGroup,
  getCatalogExerciseName,
} from '../../../types';

interface ExerciseCardProps {
  exerciseIndex: string;
  exercise: WorkoutExerciseBlock;
}

const ExerciseCardComponent = ({ exerciseIndex, exercise }: ExerciseCardProps) => {
  const sessionFocus = useWorkoutStore((s) => s.sessionFocus);
  const addSet = useWorkoutStore((s) => s.addSet);
  const completeAllSetsInBlock = useWorkoutStore((s) => s.completeAllSetsInBlock);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);
  const selectExercise = useWorkoutStore((s) => s.selectExercise);
  const updateMuscleGroup = useWorkoutStore((s) => s.updateMuscleGroup);

  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [isExerciseSheetOpen, setIsExerciseSheetOpen] = useState(false);

  // Nombre del ejercicio resuelto por integridad referencial
  const exerciseName = getCatalogExerciseName(
    exercise.catalogExerciseId,
    exercise.name,
  );
  const hasExerciseSelected = Boolean(exercise.catalogExerciseId);
  const hasGroupSelected = Boolean(exercise.selectedMuscleGroup);

  // Filtro Dinámico O(n) dependiente del grupo muscular seleccionado
  const filteredExercises = useMemo(() => {
    if (!exercise.selectedMuscleGroup) return [];
    return EXERCISE_CATALOG.filter(
      (ex) => ex.muscleGroup === exercise.selectedMuscleGroup,
    );
  }, [exercise.selectedMuscleGroup]);

  // Reordenamiento dinámico (Opción A): grupos del enfoque primero, luego el resto
  const groupSheetData = useMemo(() => {
    const focused = MUSCLE_GROUPS.filter((g) => sessionFocus.includes(g));
    const others = MUSCLE_GROUPS.filter((g) => !sessionFocus.includes(g));
    return [...focused, ...others].map((group) => ({
      id: group,
      title: group,
      badge: sessionFocus.includes(group) ? 'Enfoque' : undefined,
    }));
  }, [sessionFocus]);

  const allSetsCompleted =
    exercise.sets.length > 0 && exercise.sets.every((s) => s.isCompleted);

  // Datos adaptados para el Bottom Sheet de Ejercicios
  const exerciseSheetData = useMemo(() => {
    return filteredExercises.map((ex) => ({
      id: ex.id,
      title: ex.name,
      subtitle: ex.muscleGroup,
    }));
  }, [filteredExercises]);

  const handleSelectGroup = (item: { id: string }) => {
    const newGroup = item.id as MuscleGroup;
    updateMuscleGroup(exercise.id, newGroup);
    // Si no había ejercicio seleccionado, abrir automáticamente el selector de ejercicio
    if (!exercise.catalogExerciseId) {
      setTimeout(() => setIsExerciseSheetOpen(true), 250);
    }
  };

  const handleSelectExercise = (item: { id: string }) => {
    const found = EXERCISE_CATALOG.find((ex) => ex.id === item.id);
    if (found) {
      selectExercise(exercise.id, found);
    }
  };

  return (
    <View style={GLOBAL_STYLES.card}>
      {/* 1. Header con Número de Ejercicio y Botón Eliminar */}
      <View style={styles.header}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{exerciseIndex}</Text>
        </View>

        {/* 1.1 Botón de Grupo Muscular (Abre Bottom Sheet de Categorías) */}
        <Pressable
          style={({ pressed }) => [
            styles.muscleGroupButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setIsGroupSheetOpen(true)}
        >
          <Tag size={13} color={COLORS.primaryDark} style={{ marginRight: 5 }} />
          <Text style={styles.muscleGroupText}>
            {exercise.selectedMuscleGroup || 'Elegir Grupo'}
          </Text>
          <ChevronDown size={14} color={COLORS.primaryDark} style={{ marginLeft: 3 }} />
        </Pressable>

        <View style={{ flex: 1 }} />

        {/* Botón para completar todas las series del bloque */}
        <Pressable
          onPress={() => completeAllSetsInBlock(exercise.id)}
          disabled={allSetsCompleted}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Completar todas las series"
          style={({ pressed }) => [
            styles.completeAllButton,
            allSetsCompleted && styles.completeAllButtonDone,
            pressed && styles.buttonPressed,
          ]}
        >
          <CheckCheck
            size={18}
            color={allSetsCompleted ? COLORS.timerSurface : COLORS.primaryDark}
          />
        </Pressable>

        {/* Botón para eliminar el ejercicio completo */}
        <TouchableOpacity
          onPress={() => removeExercise(exercise.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.deleteButton}
        >
          <X color={COLORS.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      {/* 2. Botón de Ejercicio Dependiente (Deshabilitado hasta que haya grupo muscular) */}
      <Pressable
        disabled={!hasGroupSelected}
        onPress={() => setIsExerciseSheetOpen(true)}
        style={({ pressed }) => [
          styles.exercisePickerButton,
          !hasGroupSelected && styles.exercisePickerButtonDisabled,
          hasExerciseSelected && styles.exercisePickerButtonSelected,
          pressed && styles.buttonPressed,
        ]}
      >
        <View style={styles.exercisePickerLeft}>
          {hasGroupSelected ? (
            <Dumbbell
              size={18}
              color={hasExerciseSelected ? COLORS.primaryDark : COLORS.textSecondary}
              style={{ marginRight: 8 }}
            />
          ) : (
            <Lock size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          )}

          <Text
            numberOfLines={1}
            style={[
              styles.exercisePickerText,
              !hasGroupSelected && styles.exercisePickerTextDisabled,
              !hasExerciseSelected && styles.exercisePickerTextPlaceholder,
            ]}
          >
            {!hasGroupSelected
              ? 'Primero selecciona un grupo muscular'
              : hasExerciseSelected
              ? exerciseName
              : 'Toca para elegir ejercicio...'}
          </Text>
        </View>

        <ChevronDown
          size={16}
          color={hasGroupSelected ? COLORS.textSecondary : COLORS.border}
        />
      </Pressable>

      {/* 3. Encabezados de la Tabla de Series */}
      <View style={styles.tableHeader}>
        <Text style={[styles.columnLabel, { width: 40, textAlign: 'center' }]}>SERIE</Text>
        <Text style={[styles.columnLabel, { flex: 1, textAlign: 'center' }]}>REPS</Text>
        <Text style={[styles.columnLabel, { flex: 1, textAlign: 'center' }]}>PESO (KG)</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* 4. Filas de Series */}
      {exercise.sets.map((set, index) => (
        <SetRow
          key={set.id}
          exerciseId={exercise.id}
          setId={set.id}
          setNumber={index + 1}
          reps={set.reps}
          weight={set.weight}
          isCompleted={set.isCompleted}
        />
      ))}

      {/* 5. Botón Añadir Serie */}
      <TouchableOpacity
        style={styles.addSetButton}
        onPress={() => addSet(exercise.id)}
        activeOpacity={0.7}
      >
        <PlusCircle size={16} color={COLORS.primaryDark} />
        <Text style={styles.addSetText}>Añadir serie</Text>
      </TouchableOpacity>

      {/* 6. Hoja Inferior (Bottom Sheet) para Selección de Grupo Muscular */}
      <ExerciseBottomSheet
        visible={isGroupSheetOpen}
        title="Selecciona Grupo Muscular"
        subtitle="Filtra los ejercicios según el grupo que entrenarás"
        data={groupSheetData}
        selectedId={exercise.selectedMuscleGroup}
        onSelect={handleSelectGroup}
        onClose={() => setIsGroupSheetOpen(false)}
      />

      {/* 7. Hoja Inferior (Bottom Sheet) para Selección de Ejercicio (Filtrado O(n)) */}
      <ExerciseBottomSheet
        visible={isExerciseSheetOpen}
        title={`Ejercicios de ${exercise.selectedMuscleGroup}`}
        subtitle="Selecciona un ejercicio del catálogo oficial"
        data={exerciseSheetData}
        selectedId={exercise.catalogExerciseId}
        onSelect={handleSelectExercise}
        onClose={() => setIsExerciseSheetOpen(false)}
        emptyText="No hay ejercicios para este grupo muscular"
      />
    </View>
  );
};

export const ExerciseCard = memo(ExerciseCardComponent);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  indexBadge: {
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: SPACING.sm,
  },
  indexText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  muscleGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(143, 155, 122, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(143, 155, 122, 0.3)',
  },
  muscleGroupText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 6,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 14,
  },
  completeAllButton: {
    padding: 6,
    backgroundColor: 'rgba(143, 155, 122, 0.15)',
    borderRadius: 14,
    marginRight: SPACING.sm,
  },
  completeAllButtonDone: {
    backgroundColor: COLORS.primary,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  exercisePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },
  exercisePickerButtonDisabled: {
    opacity: 0.55,
    backgroundColor: '#F3F4F6',
  },
  exercisePickerButtonSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.surface,
  },
  exercisePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  exercisePickerText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  exercisePickerTextDisabled: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  exercisePickerTextPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    fontStyle: 'italic',
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
  },
});
