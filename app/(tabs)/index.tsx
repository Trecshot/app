import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { Settings, Maximize, RotateCcw, Info } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { TimerDisplay } from '../../src/components/workout/TimerDisplay';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { CardioCard } from '../../src/components/workout/CardioCard';
import { WorkoutSummaryModal } from '../../src/components/workout/WorkoutSummaryModal';
import { useWorkoutStore } from '../../src/store/useWorkoutStore';
import {
  BLOCK_TARGET_SESSIONS,
  useSessionStore,
  isBlockExpired,
} from '../../src/store/useSessionStore';
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
  const notes = useWorkoutStore((s) => s.notes);
  const setNotes = useWorkoutStore((s) => s.setNotes);
  const resetWorkout = useWorkoutStore((s) => s.resetWorkout);

  const isActive = useSessionStore((s) => s.isActive);
  const isRunning = useSessionStore((s) => s.isRunning);
  const toggleSession = useSessionStore((s) => s.toggleSession);
  const endSession = useSessionStore((s) => s.endSession);
  const getElapsedSeconds = useSessionStore((s) => s.getElapsedSeconds);
  const startTimestamp = useSessionStore((s) => s.startTimestamp);
  const currentBlock = useSessionStore((s) => s.currentBlock);
  const startNewBlock = useSessionStore((s) => s.startNewBlock);

  const [isSaving, setIsSaving] = useState(false);
  const [isSummaryModalVisible, setIsSummaryModalVisible] = useState(false);
  const [modalSummary, setModalSummary] = useState<{
    sessionFocus: MuscleGroup[];
    exercises: WorkoutExerciseBlock[];
    cardio: CardioBlock[];
    durationSeconds: number;
    notes?: string;
    prs?: number;
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

    // Normalizar ejercicios: filtrar estrictamente series válidas (reps > 0 y peso >= 0)
    // y marcarlas como isCompleted: true
    const normalizedExercises: WorkoutExerciseBlock[] = exercises
      .map((ex) => ({
        ...ex,
        sets: ex.sets
          .filter((s) => {
            const reps = parseInt(s.reps, 10) || 0;
            const weight = s.weight === '' ? 0 : parseFloat(s.weight);
            return reps > 0 && Number.isFinite(weight) && weight >= 0;
          })
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
    const trimmedNotes = notes.trim();
    const sessionSnapshot = {
      sessionFocus: [...sessionFocus],
      exercises: normalizedExercises,
      cardio: JSON.parse(JSON.stringify(cardio || [])),
      durationSeconds: currentDuration,
      notes: trimmedNotes || undefined,
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
    notes?: string;
  }) => {
    try {
      setIsSaving(true);
      const activeExercises = snapshot ? snapshot.exercises : exercises;
      const activeCardio = snapshot ? snapshot.cardio : cardio;
      const activeFocus = snapshot ? snapshot.sessionFocus : sessionFocus;
      const activeNotes = snapshot ? snapshot.notes : notes;
      const elapsedSeconds = snapshot ? snapshot.durationSeconds : getElapsedSeconds();
      const now = new Date();
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Mapear y validar ejercicios con resolución de integridad referencial
      // Persistir en SQLite únicamente series válidas con reps > 0 y peso >= 0
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
            .filter((s) => {
              const reps = parseInt(s.reps, 10) || 0;
              const weight = s.weight === '' ? 0 : parseFloat(s.weight);
              return reps > 0 && Number.isFinite(weight) && weight >= 0;
            })
            .map((s) => ({
              id: s.id,
              reps: parseInt(s.reps, 10) || 0,
              pesoKg: Math.max(0, parseFloat(s.weight) || 0),
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

      // La sesión hereda tipo (carga/descarga) del bloque vigente de 7 sesiones
      const activeBlock =
        currentBlock && !isBlockExpired(currentBlock) ? currentBlock : null;

      const session: SesionEntrenamiento = {
        id: Crypto.randomUUID(),
        fecha: todayDate,
        notas: activeNotes?.trim() ? activeNotes.trim() : undefined,
        duracionSegundos: elapsedSeconds,
        tipoSemana: activeBlock?.type ?? currentBlock?.type ?? 'carga',
        blockId: activeBlock?.id,
        cycleWeek: WorkoutRepository.getIsoWeekNumber(todayDate),
        sessionFocus: activeFocus.length > 0 ? activeFocus : undefined,
        ejercicios: validExercises,
        cardio: null,
        cardioBlocks: activeCardio && activeCardio.length > 0 ? activeCardio : undefined,
      };

      // Calcular PRs Absolutos frente al historial antes de insertar en SQLite
      const achievedPrs = await WorkoutRepository.calculateSessionPRsCount(
        activeExercises,
        session.tipoSemana,
      );
      setModalSummary((prev) => (prev ? { ...prev, prs: achievedPrs } : prev));

      await WorkoutRepository.saveSession(session, startTimestamp);
      // Actualizar contador de sesiones (1/7..7/7) y evaluar sugerencia de descarga al llegar a 7/7
      await useSessionStore.getState().initBlock();
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

        {/* Banner informativo no bloqueante al completar 7/7 sesiones de Sobrecarga */}
        {currentBlock &&
          currentBlock.type === 'carga' &&
          (currentBlock.sessionCount ?? 0) >=
            (currentBlock.targetSessions ?? BLOCK_TARGET_SESSIONS) && (
            <View style={styles.deloadBanner}>
              <View style={styles.deloadBannerHeader}>
                <Info size={18} color={COLORS.timerSurface} />
                <Text style={styles.deloadBannerTitle}>
                  ¡7/7 sesiones de Sobrecarga completadas!
                </Text>
              </View>
              <Text style={styles.deloadBannerText}>
                Se recomienda transicionar hacia una semana de Descarga para optimizar tu recuperación, aunque puedes encadenar otra semana de sobrecarga si lo prefieres.
              </Text>
              <View style={styles.deloadBannerActions}>
                <TouchableOpacity
                  style={styles.deloadPrimaryBtn}
                  onPress={() => void startNewBlock('descarga')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deloadPrimaryBtnText}>Pasar a Descarga</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deloadSecondaryBtn}
                  onPress={() => void startNewBlock('carga')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deloadSecondaryBtnText}>Seguir en Carga</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

        {/* Notas de Contexto de la Sesión (Punto 8) */}
        <View style={styles.notesSection}>
          <View style={styles.focusHeaderRow}>
            <Text style={styles.focusTitle}>NOTAS DE CONTEXTO DE LA SESIÓN</Text>
            {notes.length > 0 && (
              <TouchableOpacity onPress={() => setNotes('')}>
                <Text style={styles.focusClearText}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ej. Sensación de fatiga alta, buen bombeo, falta de sueño..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
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
        session={modalSummary ?? { sessionFocus, exercises, cardio, notes }}
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
    paddingBottom: 100, // Vital para que los botones inferiores no queden detrás de la barra inferior
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
  deloadBanner: {
    backgroundColor: 'rgba(193, 225, 79, 0.22)',
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  deloadBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  deloadBannerTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  deloadBannerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  deloadBannerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  deloadPrimaryBtn: {
    flex: 1,
    backgroundColor: COLORS.timerSurface,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  deloadPrimaryBtnText: {
    color: COLORS.textInverted,
    fontSize: 13,
    fontWeight: '700',
  },
  deloadSecondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  deloadSecondaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  notesSection: {
    marginTop: SPACING.lg,
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 15,
    minHeight: 88,
    lineHeight: 21,
  },
});
