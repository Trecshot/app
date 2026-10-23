import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { Settings, Maximize, RotateCcw } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { TimerDisplay } from '../../src/components/workout/TimerDisplay';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { CardioCard } from '../../src/components/workout/CardioCard';
import { WorkoutSummaryModal } from '../../src/components/workout/WorkoutSummaryModal';
import { useWorkoutStore } from '../../src/store/useWorkoutStore';
import { useSessionStore } from '../../src/store/useSessionStore';
import { WorkoutRepository } from '../../src/db/repositories/WorkoutRepository';
import { clearDraft } from '../../src/storage/workoutDraft';
import type { Ejercicio, SesionEntrenamiento } from '../../types';
import { MUSCLE_GROUPS, getCatalogExerciseName } from '../../types';

export default function ActiveWorkoutScreen() {
  const {
    sessionFocus,
    toggleSessionFocus,
    exercises,
    addExercise,
    cardio,
    addCardioBlock,
    updateCardioBlock,
    removeCardioBlock,
    resetWorkout,
  } = useWorkoutStore();
  const {
    isActive,
    isRunning,
    toggleSession,
    endSession,
    getElapsedSeconds,
    startTimestamp,
  } = useSessionStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isSummaryModalVisible, setIsSummaryModalVisible] = useState(false);

  const timerStatus = isRunning
    ? '• ENTRENAMIENTO EN CURSO'
    : isActive
    ? '• SESIÓN PAUSADA'
    : '• LISTO PARA EMPEZAR';

  const timerButtonText = isRunning
    ? '⏸ Pausar'
    : isActive
    ? '▶ Reanudar'
    : '▶ Comenzar';

  const handleResetTimer = () => {
    Alert.alert(
      'Reiniciar cronómetro',
      '¿Deseas reiniciar el tiempo del entrenamiento a cero?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', style: 'destructive', onPress: endSession },
      ],
    );
  };

  const handleFinishWorkout = () => {
    if (exercises.length === 0) {
      Alert.alert(
        'Rutina vacía',
        'Añade al menos un ejercicio antes de finalizar el entrenamiento.',
      );
      return;
    }

    const hasValidExercise = exercises.some(
      (ex) =>
        Boolean(ex.catalogExerciseId) ||
        Boolean(ex.name && ex.name.trim().length > 0),
    );

    if (!hasValidExercise) {
      Alert.alert(
        'Sin ejercicios seleccionados',
        'Selecciona al menos un ejercicio del catálogo para poder finalizar.',
      );
      return;
    }

    setIsSummaryModalVisible(true);
  };

  const saveActiveSession = async () => {
    try {
      setIsSaving(true);
      const elapsedSeconds = getElapsedSeconds();
      const now = new Date();
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Mapear y validar ejercicios con resolución de integridad referencial
      const validExercises: Ejercicio[] = exercises
        .filter(
          (ex) =>
            Boolean(ex.catalogExerciseId) ||
            Boolean(ex.name && ex.name.trim().length > 0),
        )
        .map((ex) => {
          const resolvedName = getCatalogExerciseName(
            ex.catalogExerciseId,
            ex.name,
          );
          return {
            id: ex.id,
            catalogExerciseId: ex.catalogExerciseId || undefined,
            nombre: resolvedName,
            grupoMuscular: ex.selectedMuscleGroup || 'General',
            selectedMuscleGroup: ex.selectedMuscleGroup,
            series: ex.sets.map((s) => ({
              id: s.id,
              reps: parseInt(s.reps, 10) || 0,
              pesoKg: parseFloat(s.weight) || 0,
            })),
          };
        });

      const session: SesionEntrenamiento = {
        id: Crypto.randomUUID(),
        fecha: todayDate,
        duracionSegundos: elapsedSeconds,
        tipoSemana: 'carga',
        cycleWeek: WorkoutRepository.getIsoWeekNumber(todayDate),
        sessionFocus: sessionFocus.length > 0 ? sessionFocus : undefined,
        ejercicios: validExercises,
        cardio: null,
        cardioBlocks: cardio && cardio.length > 0 ? cardio : undefined,
      };

      await WorkoutRepository.saveSession(session, startTimestamp);
      await clearDraft();
    } catch (error) {
      console.error('Error al guardar sesión:', error);
      Alert.alert(
        'Error al guardar',
        'Ocurrió un problema al persistir el entrenamiento en la base de datos local.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetActiveSession = () => {
    endSession();
    resetWorkout();
  };

  return (
    <View style={GLOBAL_STYLES.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Superior */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.headerSubtitle}>MI ENTRENAMIENTO</Text>
            <Text style={styles.headerTitle}>Entrena con intención.</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Maximize size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Settings size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta Oscura del Cronómetro */}
        <View style={styles.timerCard}>
          <View style={styles.timerHeaderRow}>
            <Text style={styles.timerLabel}>{timerStatus}</Text>
            {isActive && (
              <TouchableOpacity
                onPress={handleResetTimer}
                style={styles.resetIconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RotateCcw size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.timerCenter}>
            <TimerDisplay />
          </View>

          <TouchableOpacity
            style={[
              styles.startButton,
              isRunning && { backgroundColor: COLORS.primaryDark },
            ]}
            onPress={toggleSession}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.startButtonText,
                isRunning && { color: COLORS.textInverted },
              ]}
            >
              {timerButtonText}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Enfoque del Entrenamiento (Session Focus) */}
        <View style={styles.focusContainer}>
          <View style={styles.focusHeaderRow}>
            <Text style={styles.focusTitle}>ENFOQUE DEL ENTRENAMIENTO</Text>
            {sessionFocus.length > 0 && (
              <TouchableOpacity
                onPress={() => sessionFocus.forEach((g) => toggleSessionFocus(g))}
              >
                <Text style={styles.focusClearText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.focusScrollContent}
          >
            {MUSCLE_GROUPS.map((group) => {
              const isSelected = sessionFocus.includes(group);
              return (
                <TouchableOpacity
                  key={group}
                  onPress={() => toggleSessionFocus(group)}
                  style={[
                    styles.focusChip,
                    isSelected && styles.focusChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.focusChipText,
                      isSelected && styles.focusChipTextActive,
                    ]}
                  >
                    {group}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Componentes de la Rutina (Vinculados a Zustand) */}
        <Text style={styles.sectionTitle}>Ejercicios</Text>

        {exercises.length === 0 ? (
          <Text
            style={{
              color: COLORS.textSecondary,
              marginBottom: SPACING.md,
              fontStyle: 'italic',
            }}
          >
            Tu rutina está vacía. Añade un ejercicio para empezar.
          </Text>
        ) : (
          exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exerciseIndex={`0${index + 1}`.slice(-2)}
              exercise={exercise}
            />
          ))
        )}

        {/* Botón Añadir Ejercicio */}
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => addExercise()}
          activeOpacity={0.7}
        >
          <Text style={styles.outlineButtonText}>⊕ Añadir ejercicio</Text>
        </TouchableOpacity>

        {/* Sección de Cardio Extra */}
        <View style={{ marginTop: SPACING.lg }}>
          <View style={styles.focusHeaderRow}>
            <Text style={styles.focusTitle}>CARDIO EXTRA</Text>
          </View>
          {cardio && cardio.length > 0 ? (
            cardio.map((block) => (
              <CardioCard
                key={block.id}
                cardio={block}
                onUpdate={(field, value) => updateCardioBlock(block.id, field, value)}
                onRemove={() => removeCardioBlock(block.id)}
              />
            ))
          ) : null}

          <TouchableOpacity
            style={[styles.outlineButton, { borderColor: 'rgba(193, 225, 79, 0.5)' }]}
            onPress={() => addCardioBlock()}
            activeOpacity={0.7}
          >
            <Text style={styles.outlineButtonText}>🔥 Añadir bloque de cardio</Text>
          </TouchableOpacity>
        </View>

        {/* Botón Finalizar Entrenamiento */}
        <TouchableOpacity
          style={[
            styles.solidButton,
            { backgroundColor: COLORS.primaryDark, marginTop: SPACING.xl },
            isSaving && { opacity: 0.7 },
          ]}
          onPress={handleFinishWorkout}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.textInverted} />
          ) : (
            <Text style={[styles.solidButtonText, { color: COLORS.textInverted }]}>
              Finalizar entrenamiento
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de resumen de finalización */}
      <WorkoutSummaryModal
        visible={isSummaryModalVisible}
        onClose={() => setIsSummaryModalVisible(false)}
        session={{ sessionFocus, exercises, cardio }}
        saveSession={saveActiveSession}
        onSaveSession={saveActiveSession}
        resetSession={resetActiveSession}
        onNavigateToHistory={() => {
          setIsSummaryModalVisible(false);
          router.navigate('/history');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.md,
    paddingTop: 50,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconButton: {
    padding: 8,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 8,
  },
  timerCard: {
    backgroundColor: COLORS.timerSurface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  timerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  resetIconButton: {
    padding: 4,
  },
  timerCenter: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.timerSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  outlineButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  solidButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  solidButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  focusContainer: {
    marginBottom: SPACING.lg,
  },
  focusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  focusTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.textSecondary,
  },
  focusClearText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.danger,
  },
  focusScrollContent: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  focusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  focusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  focusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  focusChipTextActive: {
    color: COLORS.timerSurface,
    fontWeight: '700',
  },
});
