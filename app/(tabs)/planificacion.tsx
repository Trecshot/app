import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Calendar,
  Plus,
  Trash2,
  Sparkles,
  Layers,
} from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, LINE_HEIGHT, SPACING } from '../../src/theme';
import { ConfirmModal } from '../../src/components/ui/ConfirmModal';
import {
  SessionConfigModal,
  SessionConfigData,
} from '../../src/components/planning/SessionConfigModal';
import {
  WeekPlanningCard,
  PlanWeekAccordionItem,
  FREQUENCY_OPTIONS,
} from '../../src/components/planning/WeekPlanningCard';
import { MesocycleRepository } from '../../src/db/repositories/MesocycleRepository';
import { promptForceCloseWeek } from '../../src/database/planQueries';
import {
  plannedTypeToBlockType,
  useSessionStore,
} from '../../src/store/useSessionStore';
import { useWorkoutStore } from '../../src/store/useWorkoutStore';
import { WorkoutRepository } from '../../src/db/repositories/WorkoutRepository';
import type { MesocycleWeek, PlannedSessionConfig, PlannedWeekType } from '../../types';

export { PlanWeekAccordionItem, FREQUENCY_OPTIONS };

export default function PlanificacionScreen() {
  const [weeks, setWeeks] = useState<MesocycleWeek[]>([]);
  const [sessionConfigsByWeek, setSessionConfigsByWeek] = useState<
    Record<number, Record<number, PlannedSessionConfig>>
  >({});
  const [activeConfigModal, setActiveConfigModal] = useState<{
    visible: boolean;
    week: MesocycleWeek;
    sessionOrdinal: number;
    config: PlannedSessionConfig;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const currentSessionIndex = useSessionStore((s) => s.currentSessionIndex);
  const currentBlock = useSessionStore((s) => s.currentBlock);
  const forceAdvanceWeek = useSessionStore((s) => s.forceAdvanceWeek);
  const commentDebounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = commentDebounceRef.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const syncWithSessionStore = useCallback(async () => {
    await useSessionStore.getState().initBlock();
  }, []);

  const loadMesocycleData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [loadedWeeks, loadedConfigs] = await Promise.all([
        MesocycleRepository.getAllWeeks(),
        MesocycleRepository.getAllSessionConfigsByWeek(),
      ]);
      setWeeks(loadedWeeks);
      setSessionConfigsByWeek(loadedConfigs);
    } catch (error) {
      console.error('Error al cargar la planificación del mesociclo:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMesocycleData();
    }, [loadMesocycleData]),
  );

  const handleAddWeek = async (defaultType: PlannedWeekType = 'CARGA') => {
    if (weeks.length >= 10) {
      setConfirmModalConfig({
        visible: true,
        title: 'Límite alcanzado',
        message: 'El mesociclo permite configurar un horizonte máximo de 10 semanas.',
        confirmText: 'Entendido',
        cancelText: '',
        confirmDestructive: false,
        onConfirm: () => setConfirmModalConfig(null),
      });
      return;
    }

    const created = await MesocycleRepository.addWeek(defaultType, 7, null);
    if (created) {
      setWeeks((prev) => [...prev, created]);
      if (created.is_current && currentBlock) {
        const blockType = plannedTypeToBlockType(created.type);
        if (currentBlock.type !== blockType) {
          await WorkoutRepository.updateBlockType(currentBlock.id, blockType);
        }
      }
      await syncWithSessionStore();
    }
  };

  const handleCreatePreset = async (pattern: PlannedWeekType[]) => {
    await MesocycleRepository.createPresetMesocycle(pattern);
    const loadedWeeks = await MesocycleRepository.getAllWeeks();
    setWeeks(loadedWeeks);
    setSessionConfigsByWeek({});
    const firstActive = loadedWeeks.find((w) => w.is_current);
    if (firstActive && currentBlock) {
      await WorkoutRepository.updateBlockType(
        currentBlock.id,
        plannedTypeToBlockType(firstActive.type),
      );
      await WorkoutRepository.updateBlockTargetSessions(
        currentBlock.id,
        firstActive.total_planned_sessions,
      );
    }
    await syncWithSessionStore();
  };

  const handleToggleWeekType = async (
    week: MesocycleWeek,
    newType: PlannedWeekType,
  ) => {
    if (week.type === newType) return;

    setWeeks((prev) =>
      prev.map((w) => (w.id === week.id ? { ...w, type: newType } : w)),
    );
    await MesocycleRepository.updateWeekType(week.id, newType);

    if (week.is_current && currentBlock) {
      await WorkoutRepository.updateBlockType(
        currentBlock.id,
        plannedTypeToBlockType(newType),
      );
    }
    await syncWithSessionStore();
  };

  const handleSetActiveWeek = async (week: MesocycleWeek) => {
    if (week.is_current) return;

    setWeeks((prev) =>
      prev.map((w) => ({
        ...w,
        is_current: w.id === week.id,
      })),
    );
    await MesocycleRepository.setActiveWeek(week.id);

    const completedInCurrent = Math.max(0, currentBlock?.sessionCount ?? 0);
    if (!currentBlock || completedInCurrent > 0) {
      // Si el bloque anterior tenía sesiones registradas, iniciar un nuevo bloque desde Sesión 1/N
      await WorkoutRepository.createBlock(
        plannedTypeToBlockType(week.type),
        week.total_planned_sessions,
      );
    } else {
      await WorkoutRepository.updateBlockType(
        currentBlock.id,
        plannedTypeToBlockType(week.type),
      );
      await WorkoutRepository.updateBlockTargetSessions(
        currentBlock.id,
        week.total_planned_sessions,
      );
    }
    await syncWithSessionStore();
  };

  const handleUpdateWeekSessions = async (weekId: number, newTotal: number) => {
    const targetWeek = weeks.find((w) => w.id === weekId);
    if (!targetWeek || targetWeek.total_planned_sessions === newTotal) return;

    setWeeks((prev) =>
      prev.map((w) =>
        w.id === weekId ? { ...w, total_planned_sessions: newTotal } : w,
      ),
    );
    await MesocycleRepository.updateWeekPlannedSessions(weekId, newTotal);

    if (targetWeek.is_current && currentBlock) {
      await WorkoutRepository.updateBlockTargetSessions(currentBlock.id, newTotal);
    }
    await loadMesocycleData();
    await syncWithSessionStore();
  };

  const handleChangeWeekComment = (weekId: number, text: string) => {
    setWeeks((prev) =>
      prev.map((w) => (w.id === weekId ? { ...w, week_comment: text } : w)),
    );
    if (commentDebounceRef.current[weekId]) {
      clearTimeout(commentDebounceRef.current[weekId]);
    }
    commentDebounceRef.current[weekId] = setTimeout(() => {
      delete commentDebounceRef.current[weekId];
      void MesocycleRepository.updateWeekComment(weekId, text).then(() =>
        useSessionStore.getState().loadPlanningContext(),
      );
    }, 350);
  };

  const handleSaveSessionConfig = async (
    weekId: number,
    sessionIndex: number,
    data: SessionConfigData,
  ) => {
    const newConfig: PlannedSessionConfig = {
      session_note: data.note,
      target_muscles: data.targetMuscles,
      preset_exercise_ids: data.presetExerciseIds,
    };
    setSessionConfigsByWeek((prev) => ({
      ...prev,
      [weekId]: {
        ...(prev[weekId] ?? {}),
        [sessionIndex]: newConfig,
      },
    }));
    await MesocycleRepository.upsertSessionConfig(weekId, sessionIndex, {
      session_note: data.note,
      target_muscles: data.targetMuscles,
      preset_exercise_ids: data.presetExerciseIds,
    });
    await useSessionStore.getState().loadPlanningContext();
  };

  const handleForceCloseActiveWeek = (week: MesocycleWeek) => {
    const completed = Math.max(0, currentBlock?.sessionCount ?? 0);
    promptForceCloseWeek(
      week.week_number,
      completed,
      week.total_planned_sessions,
      async () => {
        await forceAdvanceWeek();
        await loadMesocycleData();
        const sessionState = useSessionStore.getState();
        const workoutState = useWorkoutStore.getState();
        if (!sessionState.isActive) {
          workoutState.resetWorkout();
          if (sessionState.activeWeek) {
            workoutState.hydratePreloadedSession(
              sessionState.activeSessionTargetMuscles,
              sessionState.activeSessionPresetExerciseIds,
            );
          }
        }
      },
    );
  };

  const handleDeleteWeek = (week: MesocycleWeek) => {
    setConfirmModalConfig({
      visible: true,
      title: `Eliminar Semana ${week.week_number}`,
      message: '¿Eliminar esta semana del mesociclo? Las semanas posteriores se reordenarán.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      confirmDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig(null);
        await MesocycleRepository.deleteWeek(week.id);
        await loadMesocycleData();
        await syncWithSessionStore();
      },
    });
  };

  const handleClearMesocycle = () => {
    setConfirmModalConfig({
      visible: true,
      title: 'Desactivar planificación',
      message: '¿Volver al modo manual libre? El historial de sesiones pasadas se conservará intacto.',
      confirmText: 'Volver a modo libre',
      cancelText: 'Cancelar',
      confirmDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig(null);
        await MesocycleRepository.clearMesocycle();
        setWeeks([]);
        setSessionConfigsByWeek({});
        await syncWithSessionStore();
      },
    });
  };

  const completedInBlock = Math.max(0, currentBlock?.sessionCount ?? 0);

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
        {/* Cabecera Principal */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>MESOCICLO FLEXIBLE • HASTA 10 SEMANAS</Text>
            <Text style={styles.title}>Planificación</Text>
          </View>
          <View style={styles.counterBadge}>
            <Calendar size={14} color={COLORS.primaryDark} />
            <Text style={styles.counterBadgeText}>{weeks.length}/10 sem</Text>
          </View>
        </View>

        <Text style={styles.descriptionText}>
          Configura tus bloques de Carga y Descarga con objetivos semanales y notas tácticas por sesión ordinal (3 a 7 sesiones). La semana activa inicia expandida y las demás contraídas.
        </Text>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primaryDark} />
          </View>
        ) : weeks.length === 0 ? (
          /* Estado vacío (Modo 100% Manual activo) */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Layers size={26} color={COLORS.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>Modo Manual Libre Activo</Text>
            <Text style={styles.emptySubtitle}>
              Actualmente entrenas sin planificación previa. Si deseas estructurar un mesociclo de hasta 10 semanas con transición automática entre bloques y notas tácticas por sesión, comienza aquí:
            </Text>

            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => void handleAddWeek('CARGA')}
              activeOpacity={0.8}
            >
              <Plus size={18} color={COLORS.timerSurface} />
              <Text style={styles.primaryActionBtnText}>
                Crear Semana 1 (Empezar de cero)
              </Text>
            </TouchableOpacity>

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() =>
                  void handleCreatePreset([
                    'CARGA',
                    'CARGA',
                    'CARGA',
                    'CARGA',
                    'CARGA',
                    'DESCARGA',
                  ])
                }
                activeOpacity={0.75}
              >
                <Sparkles size={14} color={COLORS.primaryDark} />
                <Text style={styles.presetBtnText}>5 Carga + 1 Descarga</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() =>
                  void handleCreatePreset([
                    'CARGA',
                    'CARGA',
                    'CARGA',
                    'DESCARGA',
                  ])
                }
                activeOpacity={0.75}
              >
                <Sparkles size={14} color={COLORS.primaryDark} />
                <Text style={styles.presetBtnText}>3 Carga + 1 Descarga</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Lista de Semanas Planificadas (Acordeón: activa expandida, resto contraídas) */
          <>
            {weeks.map((week) => (
              <WeekPlanningCard
                key={`${week.id}-${week.is_current ? 'active' : 'idle'}`}
                week={week}
                isActive={week.is_current}
                currentSessionIndex={currentSessionIndex}
                completedSessionsInBlock={completedInBlock}
                weekConfigs={sessionConfigsByWeek[week.id] ?? {}}
                onActivate={() => void handleSetActiveWeek(week)}
                onDelete={() => handleDeleteWeek(week)}
                onToggleType={(newType) => void handleToggleWeekType(week, newType)}
                onUpdateSessions={(weekId, num) =>
                  void handleUpdateWeekSessions(weekId, num)
                }
                onChangeComment={handleChangeWeekComment}
                onOpenSessionConfig={(targetWeek, sessionOrdinal, config) =>
                  setActiveConfigModal({
                    visible: true,
                    week: targetWeek,
                    sessionOrdinal,
                    config,
                  })
                }
                onForceAdvanceWeek={() => handleForceCloseActiveWeek(week)}
              />
            ))}

            {/* Botones inferiores para añadir semanas (hasta 10) o limpiar */}
            {weeks.length < 10 && (
              <View style={styles.addWeekButtonsRow}>
                <TouchableOpacity
                  style={styles.addWeekCargaBtn}
                  onPress={() => void handleAddWeek('CARGA')}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color={COLORS.timerSurface} />
                  <Text style={styles.addWeekCargaBtnText}>
                    + Semana de Carga ({weeks.length + 1}/10)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addWeekDescargaBtn}
                  onPress={() => void handleAddWeek('DESCARGA')}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color={COLORS.primaryDark} />
                  <Text style={styles.addWeekDescargaBtnText}>
                    + Descarga
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.clearPlanBtn}
              onPress={handleClearMesocycle}
              activeOpacity={0.75}
            >
              <Trash2 size={15} color={COLORS.danger} />
              <Text style={styles.clearPlanBtnText}>
                Desactivar planificación y volver a modo manual libre
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Modal de Configuración Táctica y Pre-carga de Sesión */}
      {activeConfigModal && (
        <SessionConfigModal
          visible={activeConfigModal.visible}
          weekNumber={activeConfigModal.week.week_number}
          sessionOrdinal={activeConfigModal.sessionOrdinal}
          totalPlannedSessions={activeConfigModal.week.total_planned_sessions}
          initialNote={activeConfigModal.config.session_note}
          initialTargetMuscles={activeConfigModal.config.target_muscles}
          initialPresetExerciseIds={activeConfigModal.config.preset_exercise_ids}
          onSave={(data) => {
            void handleSaveSessionConfig(
              activeConfigModal.week.id,
              activeConfigModal.sessionOrdinal,
              data,
            );
          }}
          onClose={() => setActiveConfigModal(null)}
        />
      )}

      {/* Modal Oscuro de Confirmación para Acciones de Planificación */}
      {confirmModalConfig && (
        <ConfirmModal
          visible={confirmModalConfig.visible}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmText={confirmModalConfig.confirmText}
          cancelText={confirmModalConfig.cancelText}
          confirmDestructive={confirmModalConfig.confirmDestructive}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={() => setConfirmModalConfig(null)}
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
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  counterBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  descriptionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: LINE_HEIGHT.base,
    marginBottom: SPACING.lg,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(193, 225, 79, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    width: '100%',
    marginBottom: SPACING.md,
  },
  primaryActionBtnText: {
    color: COLORS.timerSurface,
    fontSize: 15,
    fontWeight: '800',
  },
  presetRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  presetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  presetBtnText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  addWeekButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  addWeekCargaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addWeekCargaBtnText: {
    color: COLORS.textInverted,
    fontSize: 14,
    fontWeight: '800',
  },
  addWeekDescargaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.btnSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addWeekDescargaBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  clearPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.lg,
    paddingVertical: 12,
  },
  clearPlanBtnText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
