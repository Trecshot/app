import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Crypto } from '../../src/utils/uuid';
import { router, useFocusEffect } from 'expo-router';
import { Settings, RotateCcw } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, LINE_HEIGHT, SPACING, TOUCH_TARGET } from '../../src/theme';
import { ConfirmModal } from '../../src/components/ui/ConfirmModal';
import { SessionStopwatchDisplay } from '../../src/components/workout/TimerDisplay';
import { sanitizeTacticalNote } from '../../src/utils/textSanitizer';
import { clearCurrentPlanning } from '../../src/database/planQueries';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { CardioCard } from '../../src/components/workout/CardioCard';
import { WorkoutSummaryModal } from '../../src/components/workout/WorkoutSummaryModal';
import { useWorkoutStore } from '../../src/store/useWorkoutStore';
import {
  useSessionStore,
  isBlockExpired,
} from '../../src/store/useSessionStore';
import { WorkoutRepository } from '../../src/db/repositories/WorkoutRepository';
import type { CardioBlock, Ejercicio, MuscleGroup, SesionEntrenamiento, WorkoutExerciseBlock } from '../../types';
import { MUSCLE_GROUPS, getCatalogExerciseName } from '../../types';
import { exportDatabaseBackup } from '../../src/utils/databaseBackup';
import { toStrictIntegerReps, toStrictRealWeight } from '../../src/utils/prEngine';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SHORT_MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function formatDate(date: Date): string {
  const day = date.getDate();
  const month = SHORT_MONTHS_ES[date.getMonth()] ?? '';
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

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
  const activeWeek = useSessionStore((s) => s.activeWeek);
  const currentSessionIndex = useSessionStore((s) => s.currentSessionIndex);
  const activeSessionNote = useSessionStore((s) => s.activeSessionNote);
  const activeSessionTargetMuscles = useSessionStore(
    (s) => s.activeSessionTargetMuscles,
  );
  const activeSessionPresetExerciseIds = useSessionStore(
    (s) => s.activeSessionPresetExerciseIds,
  );
  const openSessionSelectorModal = useSessionStore((s) => s.openBlockPicker);

  const [noteExpanded, setNoteExpanded] = useState(false);

  const isPlanningActive = Boolean(activeWeek);
  const currentWeek = activeWeek?.week_number ?? 1;
  const weekType = activeWeek?.type === 'DESCARGA' ? 'Descarga' : 'Carga';
  const currentOrdinal = currentSessionIndex;
  const totalSessions =
    activeWeek?.total_planned_sessions ?? currentBlock?.targetSessions ?? 7;

  const tacticalNote = useMemo(() => {
    const parts: string[] = [];
    if (activeWeek?.week_comment?.trim()) {
      parts.push(`Objetivo semanal: ${activeWeek.week_comment.trim()}`);
    }
    if (activeSessionNote?.trim()) {
      parts.push(sanitizeTacticalNote(activeSessionNote));
    }
    if (
      activeSessionTargetMuscles.length > 0 ||
      activeSessionPresetExerciseIds.length > 0
    ) {
      const preloadParts: string[] = [];
      if (activeSessionTargetMuscles.length > 0) {
        preloadParts.push(`Enfoque (${activeSessionTargetMuscles.join(', ')})`);
      }
      if (activeSessionPresetExerciseIds.length > 0) {
        preloadParts.push(
          `${activeSessionPresetExerciseIds.length} ${
            activeSessionPresetExerciseIds.length === 1
              ? 'ejercicio pre-cargado'
              : 'ejercicios pre-cargados'
          }`,
        );
      }
      parts.push(`Pre-carga: ${preloadParts.join(' • ')}`);
    }
    return parts.join('\n');
  }, [
    activeWeek,
    activeSessionNote,
    activeSessionTargetMuscles,
    activeSessionPresetExerciseIds,
  ]);

  const handleToggleNoteAccordion = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {
      // safe fallback
    }
    setNoteExpanded((prev) => !prev);
  };

  const handleToggleWorkout = () => {
    toggleSession();
  };

  // Función atómica encargada de leer la pre-carga desde SQLite y sincronizar con la sesión activa
  const hydrateCurrentSessionData = useCallback(async () => {
    await useSessionStore.getState().initBlock();

    const sessionState = useSessionStore.getState();
    const workoutState = useWorkoutStore.getState();

    // Solo hidratar si la sesión NO está en curso y la rutina está limpia
    if (!sessionState.isActive && workoutState.exercises.length === 0) {
      if (sessionState.activeWeek) {
        workoutState.hydratePreloadedSession(
          sessionState.activeSessionTargetMuscles,
          sessionState.activeSessionPresetExerciseIds,
        );
      }
    }
  }, []);

  // useFocusEffect corre en el montaje inicial y cada vez que el usuario vuelve a la pestaña Entrenar
  useFocusEffect(
    useCallback(() => {
      void hydrateCurrentSessionData();
    }, [hydrateCurrentSessionData]),
  );

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
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmDestructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  const pendingPlanCompletedRef = useRef(false);
  const isSummaryModalOpenRef = useRef(false);

  const showPlanCompletedModal = useCallback((postNavigationRoute?: string) => {
    setConfirmModalConfig({
      visible: true,
      title: '¡Planificación Terminada!',
      message:
        'Has completado con éxito todo tu mesociclo (todas las semanas de carga y descarga).\n\nLos datos ejecutados están guardados en tu historial. La planificación actual se limpiará.\n\n¿Qué deseas hacer ahora?',
      confirmText: 'Volver a planificar',
      cancelText: 'Modo libre',
      confirmDestructive: false,
      onConfirm: async () => {
        setConfirmModalConfig(null);
        pendingPlanCompletedRef.current = false;
        await clearCurrentPlanning();
        await useSessionStore.getState().initBlock();
        router.navigate('/planificacion');
      },
      onCancel: async () => {
        setConfirmModalConfig(null);
        pendingPlanCompletedRef.current = false;
        await clearCurrentPlanning();
        await useSessionStore.getState().initBlock();
        if (postNavigationRoute && postNavigationRoute !== '/') {
          router.navigate(postNavigationRoute as any);
        } else {
          router.navigate('/');
        }
      },
    });
  }, []);

  const timerStatus = isRunning
    ? '• ENTRENAMIENTO EN CURSO'
    : isActive
    ? '• SESIÓN PAUSADA'
    : '• LISTO PARA EMPEZAR';

  const handleResetTimer = () => {
    setConfirmModalConfig({
      visible: true,
      title: 'Reiniciar cronómetro',
      message: '¿Deseas reiniciar el tiempo del entrenamiento a cero?',
      confirmText: 'Reiniciar',
      cancelText: 'Cancelar',
      confirmDestructive: true,
      onConfirm: () => {
        setConfirmModalConfig(null);
        endSession();
      },
    });
  };

  const handleFinishWorkout = () => {
    if (exercises.length === 0) {
      setConfirmModalConfig({
        visible: true,
        title: 'Rutina vacía',
        message: 'Añade al menos un ejercicio antes de finalizar el entrenamiento.',
        confirmText: 'Entendido',
        cancelText: '',
        confirmDestructive: false,
        onConfirm: () => setConfirmModalConfig(null),
      });
      return;
    }

    const hasValidExercise = exercises.some(
      (ex) =>
        Boolean(ex.catalogExerciseId) ||
        Boolean(ex.name && ex.name.trim().length > 0),
    );

    if (!hasValidExercise) {
      setConfirmModalConfig({
        visible: true,
        title: 'Sin ejercicios seleccionados',
        message: 'Selecciona al menos un ejercicio del catálogo para poder finalizar.',
        confirmText: 'Entendido',
        cancelText: '',
        confirmDestructive: false,
        onConfirm: () => setConfirmModalConfig(null),
      });
      return;
    }

    // Normalizar ejercicios: filtrar estrictamente series válidas (reps > 0 y peso >= 0)
    // y marcarlas como isCompleted: true
    const normalizedExercises: WorkoutExerciseBlock[] = exercises
      .map((ex) => ({
        ...ex,
        sets: ex.sets
          .filter((s) => toStrictIntegerReps(s.reps) > 0 && toStrictRealWeight(s.weight) >= 0)
          .map((s) => ({
            ...s,
            setType: s.setType ?? 'NORMAL',
            isCompleted: true,
          })),
      }))
      .filter(
        (ex) =>
          ex.sets.length > 0 &&
          (Boolean(ex.catalogExerciseId) || Boolean(ex.name && ex.name.trim().length > 0)),
      );

    if (normalizedExercises.length === 0) {
      setConfirmModalConfig({
        visible: true,
        title: 'Sin series válidas',
        message: 'Debes registrar al menos una serie con repeticiones mayores a 0 para finalizar el entrenamiento.',
        confirmText: 'Entendido',
        cancelText: '',
        confirmDestructive: false,
        onConfirm: () => setConfirmModalConfig(null),
      });
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
    isSummaryModalOpenRef.current = true;
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
            .filter((s) => toStrictIntegerReps(s.reps) > 0 && toStrictRealWeight(s.weight) >= 0)
            .map((s) => ({
              id: s.id,
              reps: toStrictIntegerReps(s.reps),
              pesoKg: toStrictRealWeight(s.weight),
              setType: s.setType ?? 'NORMAL',
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
      // Evaluar cierre de semana planificada (avanza a la siguiente o detecta fin de mesociclo)
      const completionResult = await useSessionStore.getState().evaluateBlockCompletion();
      if (completionResult?.planCompleted) {
        pendingPlanCompletedRef.current = true;
        if (!isSummaryModalOpenRef.current) {
          showPlanCompletedModal();
        }
      } else {
        await useSessionStore.getState().initBlock();
      }
    } catch (error) {
      console.error('Error al guardar sesión:', error);
      setConfirmModalConfig({
        visible: true,
        title: 'Error al guardar',
        message: 'Ocurrió un problema al persistir el entrenamiento en la base de datos local.',
        confirmText: 'Entendido',
        cancelText: '',
        confirmDestructive: false,
        onConfirm: () => setConfirmModalConfig(null),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetActiveSession = () => {
    endSession();
    resetWorkout();
  };

  const handleOpenSettings = () => {
    setConfirmModalConfig({
      visible: true,
      title: 'Ajustes y Respaldo',
      message: '¿Deseas exportar una copia de seguridad de tu base de datos SQLite?',
      confirmText: 'Exportar Copia BD',
      cancelText: 'Cancelar',
      confirmDestructive: false,
      onConfirm: () => {
        setConfirmModalConfig(null);
        void exportDatabaseBackup();
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={GLOBAL_STYLES.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera Superior Compacta */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.headerSubtitle}>MI ENTRENAMIENTO</Text>
            <Text style={styles.headerTitle}>Entrena con intención.</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleOpenSettings}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Settings size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cabecera Unificada y Tarjeta de Vista Previa Compacta (Puntos 4, 5 y 6) */}
        <View style={styles.unifiedHeader}>
          {/* Fila 1: Píldora de Estado Limpia e Historial de Inicio */}
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={styles.sessionPill}
              onPress={openSessionSelectorModal}
              activeOpacity={0.75}
            >
              <View style={styles.greenDot} />
              <Text style={styles.sessionPillText} numberOfLines={1}>
                {isPlanningActive
                  ? `Semana ${currentWeek} (${weekType}) • Sesión ${currentOrdinal}/${totalSessions}`
                  : 'Entrenamiento Libre'}
              </Text>
              <Text style={styles.pillChevron}>▾</Text>
            </TouchableOpacity>

            <Text style={styles.dateSubtitle}>{formatDate(new Date())}</Text>
          </View>

          {/* Fila 2: Acordeón Plegable de Objetivos / Nota Táctica */}
          {tacticalNote ? (
            <View style={styles.collapsibleNoteContainer}>
              <TouchableOpacity
                style={styles.noteToggleBar}
                onPress={handleToggleNoteAccordion}
                activeOpacity={0.7}
              >
                <Text style={styles.noteLabel}>OBJETIVO DE LA SESIÓN</Text>
                <Text style={styles.chevronSmall}>
                  {noteExpanded ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {noteExpanded && (
                <Text style={styles.tacticalNoteBody}>{tacticalNote}</Text>
              )}
            </View>
          ) : null}

          {/* Cronómetro compacto cuando la sesión está activa */}
          {isActive && (
            <View style={styles.activeStopwatchRow}>
              <View style={styles.activeStopwatchLeft}>
                <Text style={styles.timerLabel}>{timerStatus}</Text>
                <SessionStopwatchDisplay style={styles.compactStopwatchText} />
              </View>
              <TouchableOpacity
                onPress={handleResetTimer}
                style={styles.resetIconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RotateCcw size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Fila 3: Botón de Arranque Prominente */}
          <TouchableOpacity
            style={[
              styles.startWorkoutButton,
              isRunning && { backgroundColor: COLORS.pause },
            ]}
            onPress={handleToggleWorkout}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.startWorkoutIcon,
                isRunning ? { color: '#FFFFFF' } : { color: COLORS.textInverted },
              ]}
            >
              {isRunning ? '⏸' : '▶'}
            </Text>
            <Text
              style={[
                styles.startWorkoutText,
                isRunning ? { color: '#FFFFFF' } : { color: COLORS.textInverted },
              ]}
            >
              {isRunning ? 'Pausar' : isActive ? 'Reanudar' : 'Comenzar'}
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
            onChangeText={(text) => setNotes(text)}
            placeholder="Ej. Sensación de fatiga alta, buen bombeo, falta de sueño..."
            placeholderTextColor={COLORS.textSecondary}
            multiline={true}
            blurOnSubmit={false}
            returnKeyType="default"
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Botón Finalizar Entrenamiento */}
        <TouchableOpacity
          style={[
            styles.solidButton,
            { backgroundColor: COLORS.primary, marginTop: SPACING.xl },
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
          isSummaryModalOpenRef.current = false;
          resetActiveSession();
          setIsSummaryModalVisible(false);
          if (pendingPlanCompletedRef.current) {
            showPlanCompletedModal();
          }
        }}
        session={modalSummary ?? { sessionFocus, exercises, cardio, notes }}
        durationSeconds={modalSummary?.durationSeconds}
        resetSession={resetActiveSession}
        onNavigateToHistory={() => {
          isSummaryModalOpenRef.current = false;
          resetActiveSession();
          setIsSummaryModalVisible(false);
          if (pendingPlanCompletedRef.current) {
            showPlanCompletedModal('/history');
          } else {
            router.navigate('/history');
          }
        }}
      />

      {/* Modal Oscuro de Confirmación / Alertas para la pantalla de Entrenamiento */}
      {confirmModalConfig && (
        <ConfirmModal
          visible={confirmModalConfig.visible}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmText={confirmModalConfig.confirmText}
          cancelText={confirmModalConfig.cancelText}
          confirmDestructive={confirmModalConfig.confirmDestructive}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={confirmModalConfig.onCancel ?? (() => setConfirmModalConfig(null))}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.md,
    paddingTop: 50,
    paddingBottom: 120, // Margen extra inferior para que nunca quede al ras sobre el teclado ni la barra de navegación
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  unifiedHeader: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexShrink: 1,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
  },
  sessionPillText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  pillChevron: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  dateSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  collapsibleNoteContainer: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noteToggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteLabel: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chevronSmall: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  tacticalNoteBody: {
    color: COLORS.textBody,
    fontSize: 13,
    lineHeight: LINE_HEIGHT.sm,
    marginTop: 6,
  },
  activeStopwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeStopwatchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactStopwatchText: {
    fontSize: 22,
    fontWeight: '800',
  },
  timerLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  resetIconButton: {
    padding: 4,
  },
  startWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  startWorkoutIcon: {
    color: COLORS.textInverted,
    fontSize: 15,
    fontWeight: '800',
  },
  startWorkoutText: {
    color: COLORS.textInverted,
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
    backgroundColor: COLORS.btnSecondary,
  },
  outlineButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  solidButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  solidButtonText: {
    fontWeight: '800',
    fontSize: 16,
  },
  focusContainer: {
    marginBottom: SPACING.xl,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  focusChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  focusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  focusChipTextActive: {
    color: COLORS.textInverted,
    fontWeight: '800',
  },
  planningBannerCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    borderRadius: 14,
    marginBottom: SPACING.lg,
  },
  planningHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planningTitleGroup: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  planningWeekEyebrow: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  planningSessionMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  planningEditLink: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  planningObjectiveText: {
    color: COLORS.textBody,
    fontSize: 14,
    fontWeight: '500',
    marginTop: SPACING.sm,
    lineHeight: LINE_HEIGHT.base,
  },
  planningObjectiveLabel: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  planningSessionNoteBox: {
    backgroundColor: COLORS.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: SPACING.sm + 2,
  },
  planningInfoLabel: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  planningSessionNoteText: {
    color: COLORS.textBody,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: LINE_HEIGHT.base,
    marginTop: 4,
    textAlign: 'left',
  },
  planningPreloadBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: SPACING.sm,
  },
  planningPreloadLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planningPreloadText: {
    color: COLORS.textBody,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: LINE_HEIGHT.sm,
    marginTop: 4,
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
