import React, { useState, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import {
  X,
  PlusCircle,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Tag,
  Lock,
  CheckCheck,
} from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../theme';
import { SetRow } from './SetRow';
import { ExerciseBottomSheet } from './ExerciseBottomSheet';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import {
  useWorkoutStore,
  WorkoutExerciseBlock,
} from '../../store/useWorkoutStore';
import { useSessionStore } from '../../store/useSessionStore';
import {
  MUSCLE_GROUPS,
  MuscleGroup,
  filterExercisesByGroup,
  getCatalogExerciseById,
  getCatalogExerciseName,
} from '../../../types';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const defaultRestSeconds = useWorkoutStore((s) => s.defaultRestSeconds);
  const activeSessionPresetExerciseIds = useSessionStore(
    (s) => s.activeSessionPresetExerciseIds,
  );
  const { startTimer } = useWorkoutTimer();

  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [isExerciseSheetOpen, setIsExerciseSheetOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {
      // safe fallback
    }
    setIsCollapsed((prev) => !prev);
  };

  // Resumen informativo rápido para cuando la tarjeta está colapsada
  const summaryStats = useMemo(() => {
    const totalSets = exercise.sets.length;
    const completedSets = exercise.sets.filter((s) => s.isCompleted);
    const completedCount = completedSets.length;

    // Calcular peso máximo registrado
    const weights = exercise.sets
      .map((s) => {
        const val =
          typeof s.weight === 'number'
            ? s.weight
            : parseFloat(String(s.weight));
        return val;
      })
      .filter((w) => !isNaN(w) && w > 0);
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;

    let text = '';
    if (totalSets === 0) {
      text = 'Sin series añadidas';
    } else if (completedCount === totalSets) {
      text = `${totalSets} ${
        totalSets === 1 ? 'serie completada' : 'series completadas'
      }${maxWeight > 0 ? ` • ${maxWeight} kg máx` : ''}`;
    } else if (completedCount > 0) {
      text = `${completedCount}/${totalSets} series completadas${
        maxWeight > 0 ? ` • ${maxWeight} kg máx` : ''
      }`;
    } else {
      text = `${totalSets} ${
        totalSets === 1 ? 'serie configurada' : 'series configuradas'
      }${maxWeight > 0 ? ` • ${maxWeight} kg máx` : ''}`;
    }

    return { totalSets, completedCount, maxWeight, text };
  }, [exercise.sets]);

  // Nombre del ejercicio resuelto por integridad referencial
  const exerciseName = getCatalogExerciseName(
    exercise.catalogExerciseId,
    exercise.name,
  );
  const hasExerciseSelected = Boolean(exercise.catalogExerciseId);
  const hasGroupSelected = Boolean(exercise.selectedMuscleGroup);

  // Filtro Dinámico O(n) dependiente del grupo muscular seleccionado
  const filteredExercises = useMemo(
    () => filterExercisesByGroup(exercise.selectedMuscleGroup ?? null),
    [exercise.selectedMuscleGroup],
  );

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

  // Datos adaptados para el Bottom Sheet de Ejercicios (prioriza sugeridos de la sesión)
  const exerciseSheetData = useMemo(() => {
    const isPreset = (id: string) =>
      (activeSessionPresetExerciseIds || []).includes(id);
    const sorted = [...filteredExercises].sort((a, b) => {
      const aP = isPreset(a.id) ? 1 : 0;
      const bP = isPreset(b.id) ? 1 : 0;
      return bP - aP;
    });
    return sorted.map((ex) => ({
      id: ex.id,
      title: ex.name,
      subtitle: ex.muscleGroup,
      badge: isPreset(ex.id) ? 'Sugerido' : undefined,
    }));
  }, [filteredExercises, activeSessionPresetExerciseIds]);

  const handleSelectGroup = (item: { id: string }) => {
    const newGroup = item.id as MuscleGroup;
    updateMuscleGroup(exercise.id, newGroup);
    // Si no había ejercicio seleccionado, abrir automáticamente el selector de ejercicio
    if (!exercise.catalogExerciseId) {
      setTimeout(() => setIsExerciseSheetOpen(true), 250);
    }
  };

  const handleSelectExercise = (item: { id: string }) => {
    const found = getCatalogExerciseById(item.id);
    if (found) {
      selectExercise(exercise.id, found);
    }
  };

  return (
    <View style={[GLOBAL_STYLES.card, isCollapsed && styles.cardCollapsed]}>
      {/* 1. Header con Número de Ejercicio, Grupo, Nombre y Acciones */}
      <View style={[styles.header, isCollapsed && styles.headerCollapsed]}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={toggleCollapse}
          activeOpacity={0.7}
        >
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{exerciseIndex}</Text>
          </View>

          {isCollapsed ? (
            <>
              {exercise.selectedMuscleGroup ? (
                <View style={styles.muscleBadgeCompact}>
                  <Text style={styles.muscleBadgeCompactText}>
                    {exercise.selectedMuscleGroup}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.headerExerciseTitle} numberOfLines={1}>
                {hasExerciseSelected ? exerciseName : 'Sin ejercicio seleccionado'}
              </Text>
            </>
          ) : (
            /* 1.1 Botón de Grupo Muscular (Abre Bottom Sheet de Categorías) */
            <Pressable
              style={({ pressed }) => [
                styles.muscleGroupButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setIsGroupSheetOpen(true)}
            >
              <Tag size={13} color={COLORS.primary} style={{ marginRight: 5 }} />
              <Text style={styles.muscleGroupText}>
                {exercise.selectedMuscleGroup || 'Elegir Grupo'}
              </Text>
              <ChevronDown size={14} color={COLORS.primary} style={{ marginLeft: 3 }} />
            </Pressable>
          )}
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Botón para completar todas las series del bloque */}
          {exercise.sets.length > 0 && (
            <Pressable
              onPress={() => {
                completeAllSetsInBlock(exercise.id);
                const lastSet = exercise.sets[exercise.sets.length - 1];
                void startTimer(
                  lastSet?.restSeconds ?? defaultRestSeconds ?? 120,
                  lastSet?.id,
                );
              }}
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
                color={allSetsCompleted ? COLORS.textInverted : COLORS.primary}
              />
            </Pressable>
          )}

          {/* Botón Chevron interactivo para expandir/colapsar */}
          <TouchableOpacity
            style={styles.chevronButton}
            onPress={toggleCollapse}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={isCollapsed ? 'Expandir ejercicio' : 'Colapsar ejercicio'}
          >
            {isCollapsed ? (
              <ChevronRight size={18} color={COLORS.textSecondary} />
            ) : (
              <ChevronDown size={18} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          {/* Botón para eliminar el ejercicio completo */}
          <TouchableOpacity
            onPress={() => removeExercise(exercise.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteButton}
            accessibilityLabel="Eliminar ejercicio"
          >
            <X color={COLORS.textSecondary} size={18} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Subtítulo informativo resumido cuando está colapsado */}
      {isCollapsed && (
        <TouchableOpacity
          style={styles.collapsedSummary}
          onPress={toggleCollapse}
          activeOpacity={0.7}
        >
          <Text style={styles.summaryText}>{summaryStats.text}</Text>
        </TouchableOpacity>
      )}

      {/* 2. CUERPO DEL EJERCICIO: Solo se muestra si NO está colapsado */}
      {!isCollapsed && (
        <View style={styles.cardBody}>
          {/* Botón de Ejercicio Dependiente */}
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
                  color={hasExerciseSelected ? COLORS.primary : COLORS.textSecondary}
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
            <Text style={[styles.columnLabel, { width: 86, textAlign: 'center' }]}>SERIE / TIPO</Text>
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
              setType={set.setType ?? 'NORMAL'}
              set={set}
            />
          ))}

          {/* 5. Botón para Añadir Serie */}
          <TouchableOpacity
            style={styles.addSetButton}
            onPress={() => addSet(exercise.id)}
            activeOpacity={0.7}
          >
            <PlusCircle size={15} color={COLORS.primary} />
            <Text style={styles.addSetText}>Añadir serie</Text>
          </TouchableOpacity>
        </View>
      )}

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
  cardCollapsed: {
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  headerCollapsed: {
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerExerciseTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  muscleBadgeCompact: {
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.25)',
  },
  muscleBadgeCompactText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  chevronButton: {
    padding: 6,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 14,
  },
  collapsedSummary: {
    marginTop: 6,
    paddingLeft: 2,
  },
  summaryText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  cardBody: {
    marginTop: 0,
  },
  indexBadge: {
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: SPACING.sm,
  },
  indexText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  muscleGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.25)',
  },
  muscleGroupText: {
    color: COLORS.primary,
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
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
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
    opacity: 0.45,
    backgroundColor: COLORS.surface,
  },
  exercisePickerButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceHighlight,
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
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.btnSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addSetText: {
    color: COLORS.primary,
    fontWeight: '700',
    marginLeft: 5,
    fontSize: 13,
  },
});
