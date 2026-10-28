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
import { useSessionStore, isBlockExpired } from '../../src/store/useSessionStore';
import { BlockIndicator } from '../../src/components/workout/BlockIndicator';
import { WorkoutRepository } from '../../src/db/repositories/WorkoutRepository';
import type { CardioBlock, Ejercicio, MuscleGroup, SesionEntrenamiento, WorkoutExerciseBlock } from '../../types';
import { MUSCLE_GROUPS, getCatalogExerciseName } from '../../types';

export default function ActiveWorkoutScreen() {
  const sessionFocus = useWorkoutStore((s) => s.sessionFocus);
  const toggleSessionFocus = useWorkoutStore((s) => s.toggleSessionFocus);
  const exercises = useWorkoutStore((s) => s.exercises);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const cardio = useWorkoutStore((s) => s.cardio);
  const addCardioBlock = useWorkoutStore((s) => s.addCardioBlock);
  const updateCardioBlock = useWorkoutStore((s) => s.updateCardioBlock);
  const removeCardioBlock = useWorkoutStore((s) => s.removeCardioBlock);
  const resetWorkout = useWorkoutStore((s) => s.resetWorkout);

  const isActive = useSessionStore((s) => s.isActive);
  const isRunning = useSessionStore((s) => s.isRunning);
  const toggleSession = useSessionStore((s) => s.toggleSession);
  const endSession = useSessionStore((s) => s.endSession);
  const getElapsedSeconds = useSessionStore((s) => s.getElapsedSeconds);
  const startTimestamp = useSessionStore((s) => s.startTimestamp);
  const currentBlock = useSessionStore((s) => s.currentBlock);

  const [isSaving, setIsSaving] = useState(false);
  const [isSummaryModalVisible, setIsSummaryModalVisible] = useState(false);
  const [modalSummary, setModalSummary] = useState<{
    sessionFocus: MuscleGroup[];
    exercises: WorkoutExerciseBlock[];
    cardio: CardioBlock[];
    durationSeconds: number;
  } | null>(null);

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

    // Normalizar ejercicios: filtrar series válidas (reps > 0 o isCompleted === true)
    // y marcarlas como isCompleted: true
    const normalizedExercises: WorkoutExerciseBlock[] = exercises
      .map((ex) => ({
        ...ex,
        sets: ex.sets
          .filter((s) => (parseInt(s.reps, 10) || 0) > 0 || s.isCompleted)
          .map((s) => ({
            ...s,
            isCompleted: true,
          })),
      }))
      .filter(
        (ex) =>
          ex.sets.length > 0 &&
          (Boolean(ex.catalogExerciseId) || Boolean(ex.name && ex.name.trim().length > 0)),
      );

    if (normalizedExercises.length === 0) {
      Alert.alert(
        'Sin series válidas',
        'Debes registrar al menos una serie con repeticiones mayores a 0 para finalizar el entrenamiento.',
      );
      return;
    }

    // 1. Snapshot inmutable de la sesión para el Modal (Optimistic Rendering)
    const currentDuration = getElapsedSeconds();
    const sessionSnapshot = {
      sessionFocus: [...sessionFocus],
      exercises: normalizedExercises,
      cardio: JSON.parse(JSON.stringify(cardio || [])),
      durationSeconds: currentDuration,
    };
    setModalSummary(sessionSnapshot);

    // 2. Activar el Modal de forma INMEDIATA
    setIsSummaryModalVisible(true);

    // 3. Ejecutar el guardado en base de datos de forma asíncrona "silenciosa" (Background)
    saveActiveSession(sessionSnapshot).catch((error) => {
      console.error('Fallo de persistencia en segundo plano:', error);
    });
  };

  const saveActiveSession = async (snapshot?: {
    sessionFocus: MuscleGroup[];
    exercises: WorkoutExerciseBlock[];
    cardio: CardioBlock[];
    durationSeconds: number;
  }) => {
    try {
      setIsSaving(true);
      const activeExercises = snapshot ? snapshot.exercises : exercises;
      const activeCardio = snapshot ? snapshot.cardio : cardio;
      const activeFocus = snapshot ? snapshot.sessionFocus : sessionFocus;
      const elapsedSeconds = snapshot ? snapshot.durationSeconds : getElapsedSeconds();
      const now = new Date();
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Mapear y validar ejercicios con resolución de integridad referencial
      // Persistir en SQLite únicamente series con reps > 0 (o isCompleted === true), descartando series vacías
      const validExercises: Ejercicio[] = activeExercises
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
          const validSets = ex.sets
            .filter((s) => (parseInt(s.reps, 10) || 0) > 0 || s.isCompleted)
            .map((s) => ({
              id: s.id,
              reps: parseInt(s.reps, 10) || 0,
              pesoKg: parseFloat(s.weight) || 0,
            }));

          return {
            id: ex.id,
            catalogExerciseId: ex.catalogExerciseId || undefined,
            nombre: resolvedName,
            grupoMuscular: ex.selectedMuscleGroup || 'General',
            selectedMuscleGroup: ex.selectedMuscleGroup,
            series: validSets,
          };
        })
        .filter((ex) => ex.series.length > 0);

      // La sesión hereda tipo (carga/descarga) del bloque vigente de 7 días
      const activeBlock =
        currentBlock && !isBlockExpired(currentBlock) ? currentBlock : null;

      const session: SesionEntrenamiento = {
        id: Crypto.randomUUID(),
        fecha: todayDate,
        duracionSegundos: elapsedSeconds,
        tipoSemana: activeBlock?.type ?? 'carga',
        blockId: activeBlock?.id,
        cycleWeek: WorkoutRepository.getIsoWeekNumber(todayDate),
        sessionFocus: activeFocus.length > 0 ? activeFocus : undefined,
        ejercicios: validExercises,
        cardio: null,
        cardioBlocks: activeCardio && activeCardio.length > 0 ? activeCardio : undefined,
      };

      await WorkoutRepository.saveSession(session, startTimestamp);
      if (!activeBlock) {
        // El bloque expiró durante la sesión: pedir la nueva semana
        void useSessionStore.getState().initBlock();
      }
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
            <BlockIndicator />
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
        onClose={() => {
          resetActiveSession();
          setIsSummaryModalVisible(false);
        }}
        session={modalSummary ?? { sessionFocus, exercises, cardio }}
        durationSeconds={modalSummary?.durationSeconds}
        resetSession={resetActiveSession}
        onNavigateToHistory={() => {
          resetActiveSession();
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
