import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Calendar,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  FileText,
  Layers,
} from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { MesocycleRepository } from '../../src/db/repositories/MesocycleRepository';
import {
  plannedTypeToBlockType,
  useSessionStore,
} from '../../src/store/useSessionStore';
import { WorkoutRepository } from '../../src/db/repositories/WorkoutRepository';
import type { MesocycleWeek, PlannedWeekType } from '../../types';

const SESSION_QUOTA_OPTIONS = [4, 5, 6, 7];

export default function PlanificacionScreen() {
  const [weeks, setWeeks] = useState<MesocycleWeek[]>([]);
  const [notesByWeek, setNotesByWeek] = useState<Record<number, Record<number, string>>>({});
  const [expandedWeekIds, setExpandedWeekIds] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const currentSessionIndex = useSessionStore((s) => s.currentSessionIndex);
  const currentBlock = useSessionStore((s) => s.currentBlock);

  const syncWithSessionStore = useCallback(async () => {
    await useSessionStore.getState().initBlock();
    await useSessionStore.getState().loadPlanningContext();
  }, []);

  const loadMesocycleData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [loadedWeeks, loadedNotes] = await Promise.all([
        MesocycleRepository.getAllWeeks(),
        MesocycleRepository.getAllNotesByWeek(),
      ]);
      setWeeks(loadedWeeks);
      setNotesByWeek(loadedNotes);
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

  const toggleExpandWeek = (weekId: number) => {
    setExpandedWeekIds((prev) => ({
      ...prev,
      [weekId]: !prev[weekId],
    }));
  };

  const handleAddWeek = async (defaultType: PlannedWeekType = 'CARGA') => {
    if (weeks.length >= 10) {
      Alert.alert(
        'Límite alcanzado',
        'El mesociclo permite configurar un horizonte máximo de 10 semanas.',
      );
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
    setNotesByWeek({});
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

    // Si es la semana activa en curso, sincronizar en tiempo real con el bloque actual de Entrenar
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

    if (currentBlock) {
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

  const handleChangePlannedSessions = async (
    week: MesocycleWeek,
    newTotal: number,
  ) => {
    if (week.total_planned_sessions === newTotal) return;

    setWeeks((prev) =>
      prev.map((w) =>
        w.id === week.id ? { ...w, total_planned_sessions: newTotal } : w,
      ),
    );
    await MesocycleRepository.updateWeekPlannedSessions(week.id, newTotal);

    if (week.is_current && currentBlock) {
      await WorkoutRepository.updateBlockTargetSessions(currentBlock.id, newTotal);
    }
    await syncWithSessionStore();
  };

  const handleChangeWeekComment = (weekId: number, text: string) => {
    setWeeks((prev) =>
      prev.map((w) => (w.id === weekId ? { ...w, week_comment: text } : w)),
    );
    void MesocycleRepository.updateWeekComment(weekId, text).then(() =>
      useSessionStore.getState().loadPlanningContext(),
    );
  };

  const handleChangeSessionNote = (
    weekId: number,
    sessionIndex: number,
    text: string,
  ) => {
    setNotesByWeek((prev) => ({
      ...prev,
      [weekId]: {
        ...(prev[weekId] ?? {}),
        [sessionIndex]: text,
      },
    }));
    void MesocycleRepository.upsertSessionNote(weekId, sessionIndex, text).then(
      () => useSessionStore.getState().loadPlanningContext(),
    );
  };

  const handleDeleteWeek = (week: MesocycleWeek) => {
    Alert.alert(
      `Eliminar Semana ${week.week_number}`,
      '¿Deseas quitar esta semana y sus notas tácticas del mesociclo? Las demás semanas se reordenarán automáticamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await MesocycleRepository.deleteWeek(week.id);
            await loadMesocycleData();
            await syncWithSessionStore();
          },
        },
      ],
    );
  };

  const handleClearMesocycle = () => {
    Alert.alert(
      'Desactivar Planificación',
      '¿Deseas borrar las semanas planificadas y volver al modo 100% manual libre? Tu historial de entrenamientos pasados se conservará intacto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Volver a modo libre',
          style: 'destructive',
          onPress: async () => {
            await MesocycleRepository.clearMesocycle();
            setWeeks([]);
            setNotesByWeek({});
            await syncWithSessionStore();
          },
        },
      ],
    );
  };

  return (
    <View style={GLOBAL_STYLES.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
          Configura tus bloques de Carga y Descarga con objetivos semanales y notas tácticas por sesión ordinal (1/7 a 7/7). Puedes modificar cualquier etiqueta en tiempo real sin romper tu historial.
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
          /* Lista de Semanas Planificadas (1 a 10) */
          <>
            {weeks.map((week) => {
              const isCarga = week.type === 'CARGA';
              const isExpanded = Boolean(expandedWeekIds[week.id]);
              const weekNotes = notesByWeek[week.id] ?? {};
              const configuredNotesCount = Object.values(weekNotes).filter(
                (n) => n && n.trim().length > 0,
              ).length;

              return (
                <View
                  key={week.id}
                  style={[
                    styles.weekCard,
                    week.is_current && styles.weekCardActive,
                  ]}
                >
                  {/* Fila superior: Número de semana + Estado Activo + Borrar */}
                  <View style={styles.weekTopRow}>
                    <View style={styles.weekTitleGroup}>
                      <View
                        style={[
                          styles.weekNumberBadge,
                          week.is_current && styles.weekNumberBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.weekNumberText,
                            week.is_current && styles.weekNumberTextActive,
                          ]}
                        >
                          S{week.week_number}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.weekTitle}>
                          Semana {week.week_number}
                        </Text>
                        {week.is_current ? (
                          <Text style={styles.activeSessionSubtext}>
                            En ejecución • Sesión {currentSessionIndex}/
                            {week.total_planned_sessions}
                          </Text>
                        ) : (
                          <Text style={styles.inactiveSubtext}>
                            {week.total_planned_sessions} sesiones programadas
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.weekRightActions}>
                      {week.is_current ? (
                        <View style={styles.activeBadgePill}>
                          <CheckCircle2 size={13} color={COLORS.timerSurface} />
                          <Text style={styles.activeBadgePillText}>ACTIVA</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.activateWeekBtn}
                          onPress={() => void handleSetActiveWeek(week)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.activateWeekBtnText}>
                            Activar
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.deleteWeekBtn}
                        onPress={() => handleDeleteWeek(week)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Selector Flexible de Etiqueta: CARGA vs DESCARGA */}
                  <View style={styles.typeToggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.typeOptionBtn,
                        isCarga && styles.typeOptionBtnCargaActive,
                      ]}
                      onPress={() => void handleToggleWeekType(week, 'CARGA')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          isCarga && styles.typeOptionTextCargaActive,
                        ]}
                      >
                        💪 CARGA
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeOptionBtn,
                        !isCarga && styles.typeOptionBtnDescargaActive,
                      ]}
                      onPress={() => void handleToggleWeekType(week, 'DESCARGA')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          !isCarga && styles.typeOptionTextDescargaActive,
                        ]}
                      >
                        🧘 DESCARGA
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Selector de Cuota de Sesiones del Bloque (ej. 4, 5, 6, 7 sesiones) */}
                  <View style={styles.quotaRow}>
                    <Text style={styles.fieldLabel}>
                      SESIONES DEL BLOQUE:
                    </Text>
                    <View style={styles.quotaChipsGroup}>
                      {SESSION_QUOTA_OPTIONS.map((count) => {
                        const selected = week.total_planned_sessions === count;
                        return (
                          <TouchableOpacity
                            key={count}
                            style={[
                              styles.quotaChip,
                              selected && styles.quotaChipSelected,
                            ]}
                            onPress={() =>
                              void handleChangePlannedSessions(week, count)
                            }
                            activeOpacity={0.75}
                          >
                            <Text
                              style={[
                                styles.quotaChipText,
                                selected && styles.quotaChipTextSelected,
                              ]}
                            >
                              {count}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Comentario por Semana (Nivel Bloque) */}
                  <View style={styles.commentSection}>
                    <Text style={styles.fieldLabel}>
                      OBJETIVO / COMENTARIO SEMANAL
                    </Text>
                    <TextInput
                      style={styles.commentInput}
                      value={week.week_comment ?? ''}
                      onChangeText={(txt) =>
                        handleChangeWeekComment(week.id, txt)
                      }
                      placeholder="Ej. Acumulación de volumen en banca y sentadilla; mantener RIR 2"
                      placeholderTextColor={COLORS.textSecondary}
                      multiline
                    />
                  </View>

                  {/* Desplegable de Notas Tácticas por Sesión Ordinal (1/N a N/N) */}
                  <TouchableOpacity
                    style={styles.sessionNotesToggleBtn}
                    onPress={() => toggleExpandWeek(week.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.sessionNotesToggleLeft}>
                      <FileText size={15} color={COLORS.primaryDark} />
                      <Text style={styles.sessionNotesToggleText}>
                        Notas por Sesión (1/{week.total_planned_sessions} a{' '}
                        {week.total_planned_sessions}/
                        {week.total_planned_sessions})
                      </Text>
                      {configuredNotesCount > 0 && (
                        <View style={styles.notesCountBadge}>
                          <Text style={styles.notesCountBadgeText}>
                            {configuredNotesCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={16} color={COLORS.textSecondary} />
                    ) : (
                      <ChevronDown size={16} color={COLORS.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.sessionNotesList}>
                      {Array.from(
                        { length: week.total_planned_sessions },
                        (_, idx) => idx + 1,
                      ).map((sessionOrd) => {
                        const isCurrentOrd =
                          week.is_current &&
                          currentSessionIndex === sessionOrd;
                        const noteValue = weekNotes[sessionOrd] ?? '';

                        return (
                          <View
                            key={sessionOrd}
                            style={[
                              styles.sessionNoteItem,
                              isCurrentOrd && styles.sessionNoteItemCurrent,
                            ]}
                          >
                            <View style={styles.sessionNoteHeader}>
                              <Text
                                style={[
                                  styles.sessionOrdinalLabel,
                                  isCurrentOrd &&
                                    styles.sessionOrdinalLabelCurrent,
                                ]}
                              >
                                Sesión {sessionOrd}/
                                {week.total_planned_sessions}
                              </Text>
                              {isCurrentOrd && (
                                <Text style={styles.currentOrdTag}>
                                  • SESIÓN ACTUAL
                                </Text>
                              )}
                            </View>
                            <TextInput
                              style={styles.sessionNoteInput}
                              value={noteValue}
                              onChangeText={(txt) =>
                                handleChangeSessionNote(
                                  week.id,
                                  sessionOrd,
                                  txt,
                                )
                              }
                              placeholder={`Directriz táctica para la Sesión ${sessionOrd}/${week.total_planned_sessions} (ej. Subir 2.5 kg en press banca con RIR 2)`}
                              placeholderTextColor={COLORS.textSecondary}
                              multiline
                            />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

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
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.md,
    paddingTop: 50,
    paddingBottom: 110,
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
    fontSize: 13,
    lineHeight: 19,
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
    lineHeight: 19,
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
  weekCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weekCardActive: {
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
  },
  weekTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  weekTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  weekNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNumberBadgeActive: {
    backgroundColor: COLORS.timerSurface,
    borderColor: COLORS.timerSurface,
  },
  weekNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  weekNumberTextActive: {
    color: COLORS.primary,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  activeSessionSubtext: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginTop: 1,
  },
  inactiveSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  weekRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activeBadgePillText: {
    color: COLORS.timerSurface,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activateWeekBtn: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activateWeekBtnText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteWeekBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceHighlight,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  typeOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeOptionBtnCargaActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  typeOptionBtnDescargaActive: {
    backgroundColor: COLORS.timerSurface,
    borderColor: COLORS.timerSurface,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  typeOptionTextCargaActive: {
    color: COLORS.timerSurface,
  },
  typeOptionTextDescargaActive: {
    color: COLORS.textInverted,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  quotaChipsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  quotaChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quotaChipSelected: {
    backgroundColor: COLORS.timerSurface,
    borderColor: COLORS.timerSurface,
  },
  quotaChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  quotaChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  commentSection: {
    marginBottom: SPACING.sm,
  },
  commentInput: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: COLORS.textPrimary,
    fontSize: 13,
    minHeight: 42,
  },
  sessionNotesToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(143, 155, 122, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(143, 155, 122, 0.28)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sessionNotesToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionNotesToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  notesCountBadge: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  notesCountBadgeText: {
    color: COLORS.surface,
    fontSize: 11,
    fontWeight: '800',
  },
  sessionNotesList: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  sessionNoteItem: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
  },
  sessionNoteItemCurrent: {
    borderColor: COLORS.primaryDark,
    backgroundColor: 'rgba(193, 225, 79, 0.14)',
  },
  sessionNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionOrdinalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sessionOrdinalLabelCurrent: {
    color: COLORS.primaryDark,
  },
  currentOrdTag: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  sessionNoteInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: COLORS.textPrimary,
    minHeight: 38,
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
    color: COLORS.timerSurface,
    fontSize: 14,
    fontWeight: '800',
  },
  addWeekDescargaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addWeekDescargaBtnText: {
    color: COLORS.primaryDark,
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
