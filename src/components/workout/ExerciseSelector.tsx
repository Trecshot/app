// src/components/workout/ExerciseSelector.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import {
  EXERCISE_CATALOG,
  MuscleGroup,
  CatalogExercise,
  MUSCLE_GROUPS,
} from '../../../types';
import { COLORS, SPACING } from '../../theme';

interface Props {
  onExerciseSelect: (exercise: CatalogExercise) => void;
  selectedExerciseId?: string;
  initialGroup?: MuscleGroup | null;
  sessionFocus?: MuscleGroup[];
}

export const ExerciseSelector: React.FC<Props> = ({
  onExerciseSelect,
  selectedExerciseId,
  initialGroup = null,
  sessionFocus = [],
}) => {
  const [activeGroup, setActiveGroup] = useState<MuscleGroup | null>(initialGroup);

  // Memorización de la lista filtrada para evitar re-cálculos en cada render
  const filteredExercises = useMemo(() => {
    if (!activeGroup) return [];
    return EXERCISE_CATALOG.filter((ex) => ex.muscleGroup === activeGroup);
  }, [activeGroup]);

  // Si hay sessionFocus definido, priorizar esos grupos musculares
  const displayedGroups = useMemo(() => {
    if (sessionFocus && sessionFocus.length > 0) {
      // Grupos del enfoque primero, seguidos del resto
      const otherGroups = MUSCLE_GROUPS.filter((g) => !sessionFocus.includes(g));
      return [...sessionFocus, ...otherGroups];
    }
    return MUSCLE_GROUPS;
  }, [sessionFocus]);

  return (
    <View style={styles.container}>
      {/* 1. Selector de Grupo Muscular (Chips scrolleables) */}
      <View style={styles.groupSection}>
        <Text style={styles.sectionHeader}>1. SELECCIONA GRUPO MUSCULAR</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupScrollContent}
        >
          {displayedGroups.map((group) => {
            const isActive = activeGroup === group;
            const isFocusGroup = sessionFocus.includes(group);

            return (
              <Pressable
                key={group}
                onPress={() => setActiveGroup(group)}
                style={({ pressed }) => [
                  styles.groupChip,
                  isActive && styles.groupChipActive,
                  isFocusGroup && !isActive && styles.groupChipFocus,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    isActive && styles.groupChipTextActive,
                    isFocusGroup && !isActive && styles.groupChipTextFocus,
                  ]}
                >
                  {group} {isFocusGroup ? '★' : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Lista de Ejercicios Dependiente (O(n) memoizada con FlatList) */}
      <View style={styles.exerciseSection}>
        <Text style={styles.sectionHeader}>
          {activeGroup
            ? `2. EJERCICIOS DE ${activeGroup.toUpperCase()}`
            : '2. SELECCIONA UN GRUPO ARRIBA'}
        </Text>

        {activeGroup ? (
          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            initialNumToRender={10}
            windowSize={5}
            maxToRenderPerBatch={10}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = selectedExerciseId === item.id;
              return (
                <Pressable
                  onPress={() => onExerciseSelect(item)}
                  style={({ pressed }) => [
                    styles.exerciseItem,
                    isSelected && styles.exerciseItemSelected,
                    pressed && styles.exerciseItemPressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.exerciseName,
                        isSelected && styles.exerciseNameSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.exerciseGroup}>{item.muscleGroup}</Text>
                  </View>

                  {isSelected ? (
                    <Check size={18} color={COLORS.primaryDark} strokeWidth={2.5} />
                  ) : (
                    <ChevronRight size={18} color={COLORS.textSecondary} />
                  )}
                </Pressable>
              );
            }}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>
              Elige un grupo muscular para ver los ejercicios disponibles
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.sm,
  },
  groupSection: {
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  groupScrollContent: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  groupChipFocus: {
    borderColor: COLORS.primaryDark,
  },
  groupChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  groupChipTextActive: {
    color: COLORS.timerSurface,
    fontWeight: '700',
  },
  groupChipTextFocus: {
    color: COLORS.primaryDark,
  },
  exerciseSection: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SPACING.md,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  exerciseItemSelected: {
    backgroundColor: 'rgba(193, 225, 79, 0.18)',
    borderBottomColor: 'transparent',
  },
  exerciseItemPressed: {
    backgroundColor: COLORS.surfaceHighlight,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  exerciseNameSelected: {
    fontWeight: '700',
  },
  exerciseGroup: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  placeholderContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 12,
  },
  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
