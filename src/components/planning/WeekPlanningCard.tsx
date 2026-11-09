import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  Sliders,
  Dumbbell,
  ChevronRight,
  FastForward,
  Trash2,
} from 'lucide-react-native';
import { COLORS, LINE_HEIGHT, SPACING } from '../../theme';
import type {
  MesocycleWeek,
  PlannedSessionConfig,
  PlannedWeekType,
} from '../../../types';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const FREQUENCY_OPTIONS = [3, 4, 5, 6, 7];

export interface PlanWeekAccordionItemProps {
  week: {
    id: number;
    weekNumber: number;
    type: PlannedWeekType;
    totalSessions: number;
  };
  isActive: boolean;
  currentSessionIndex?: number;
  onActivate: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function PlanWeekAccordionItem({
  week,
  isActive,
  currentSessionIndex,
  onActivate,
  onDelete,
  children,
}: PlanWeekAccordionItemProps) {
  // La semana activa inicia expandida; las otras colapsadas
  const [isExpanded, setIsExpanded] = useState<boolean>(Boolean(isActive));

  const toggle = () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {
      // safe fallback
    }
    setIsExpanded((prev) => !prev);
  };

  return (
    <View style={[styles.weekCard, isActive && styles.weekCardActiveBorder]}>
      {/* CABECERA COMPACTA RESUMEN */}
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.weekBadge,
              week.type === 'DESCARGA' ? styles.deloadBadge : styles.loadBadge,
            ]}
          >
            <Text
              style={[
                styles.weekBadgeText,
                week.type === 'DESCARGA'
                  ? styles.deloadBadgeText
                  : styles.loadBadgeText,
              ]}
            >
              S{week.weekNumber}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.weekTitleText}>Semana {week.weekNumber}</Text>
            <Text style={styles.weekSubText}>
              {week.type} • {week.totalSessions} sesiones
              {isActive && currentSessionIndex
                ? ` • Sesión ${currentSessionIndex}/${week.totalSessions}`
                : ''}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {isActive ? (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>ACTIVA</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.activateBtn}
              onPress={(e) => {
                e.stopPropagation();
                onActivate();
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.activateBtnText}>Activar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.deleteBadge}
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={16} color="#FF453A" strokeWidth={2} />
          </TouchableOpacity>

          <Text style={styles.accordionChevron}>{isExpanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* CONTENIDO EXPANDIBLE (Solo visible si isExpanded es true) */}
      {isExpanded && <View style={styles.accordionBody}>{children}</View>}
    </View>
  );
}

export interface WeekPlanningCardProps {
  week: MesocycleWeek;
  isActive: boolean;
  currentSessionIndex: number;
  completedSessionsInBlock?: number;
  weekConfigs: Record<number, PlannedSessionConfig>;
  onActivate: () => void;
  onDelete: () => void;
  onToggleType: (newType: PlannedWeekType) => void;
  onUpdateSessions: (weekId: number, num: number) => void;
  onChangeComment: (weekId: number, text: string) => void;
  onOpenSessionConfig: (
    week: MesocycleWeek,
    sessionOrdinal: number,
    config: PlannedSessionConfig,
  ) => void;
  onForceAdvanceWeek?: () => void;
}

export function WeekPlanningCard({
  week,
  isActive,
  currentSessionIndex,
  completedSessionsInBlock = 0,
  weekConfigs,
  onActivate,
  onDelete,
  onToggleType,
  onUpdateSessions,
  onChangeComment,
  onOpenSessionConfig,
  onForceAdvanceWeek,
}: WeekPlanningCardProps) {
  const isCarga = week.type === 'CARGA';
  const normalizedWeek = {
    id: week.id,
    weekNumber: week.week_number,
    type: week.type,
    totalSessions: week.total_planned_sessions,
  };

  return (
    <PlanWeekAccordionItem
      week={normalizedWeek}
      isActive={isActive}
      currentSessionIndex={currentSessionIndex}
      onActivate={onActivate}
      onDelete={onDelete}
    >
      {/* Selector Flexible de Etiqueta: CARGA vs DESCARGA */}
      <View style={styles.typeToggleRow}>
        <TouchableOpacity
          style={[
            styles.typeOptionBtn,
            isCarga && styles.typeOptionBtnCargaActive,
          ]}
          onPress={() => onToggleType('CARGA')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.typeOptionText,
              isCarga && styles.typeOptionTextCargaActive,
            ]}
          >
            CARGA
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeOptionBtn,
            !isCarga && styles.typeOptionBtnDescargaActive,
          ]}
          onPress={() => onToggleType('DESCARGA')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.typeOptionText,
              !isCarga && styles.typeOptionTextDescargaActive,
            ]}
          >
            DESCARGA
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selector de Frecuencia (3 a 7 Sesiones) */}
      <View style={styles.frequencySection}>
        <Text style={styles.sectionLabel}>SESIONES DEL BLOQUE</Text>

        <View style={styles.frequencyRow}>
          {FREQUENCY_OPTIONS.map((num) => {
            const isSelected = normalizedWeek.totalSessions === num;
            return (
              <TouchableOpacity
                key={num}
                style={[styles.freqButton, isSelected && styles.freqButtonActive]}
                onPress={() => onUpdateSessions(normalizedWeek.id, num)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.freqButtonText,
                    isSelected && styles.freqButtonTextActive,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Comentario por Semana (Nivel Bloque) */}
      <View style={styles.commentSection}>
        <Text style={styles.sectionLabel}>OBJETIVO / COMENTARIO SEMANAL</Text>
        <TextInput
          style={styles.commentInput}
          value={week.week_comment ?? ''}
          onChangeText={(txt) => onChangeComment(week.id, txt)}
          placeholder="Ej. Acumulación de volumen en banca y sentadilla; mantener RIR 2"
          placeholderTextColor={COLORS.textSecondary}
          multiline={true}
          blurOnSubmit={false}
          returnKeyType="default"
          textAlignVertical="top"
        />
      </View>

      {/* Acción de Cierre Manual de Semana Activa (Punto 3) */}
      {isActive && onForceAdvanceWeek && (
        <TouchableOpacity
          style={styles.forceCloseWeekBtn}
          onPress={onForceAdvanceWeek}
          activeOpacity={0.8}
        >
          <FastForward size={14} color={COLORS.primary} />
          <Text style={styles.forceCloseWeekBtnText}>
            Concluir Semana Activa ({completedSessionsInBlock}/
            {normalizedWeek.totalSessions}) y avanzar
          </Text>
        </TouchableOpacity>
      )}

      {/* Lista de Sesiones Ordinales (1/N a N/N) */}
      <View style={styles.sessionNotesList}>
        {Array.from(
          { length: normalizedWeek.totalSessions },
          (_, idx) => idx + 1,
        ).map((sessionOrd) => {
          const isCurrentOrd = isActive && currentSessionIndex === sessionOrd;
          const config = weekConfigs[sessionOrd];
          const hasNote = Boolean(
            config?.session_note && config.session_note.trim().length > 0,
          );
          const hasMuscles = Boolean(
            config?.target_muscles && config.target_muscles.length > 0,
          );
          const hasPresets = Boolean(
            config?.preset_exercise_ids && config.preset_exercise_ids.length > 0,
          );
          const isConfigured = hasNote || hasMuscles || hasPresets;

          return (
            <TouchableOpacity
              key={sessionOrd}
              style={[
                styles.sessionCardItem,
                isCurrentOrd && styles.sessionCardItemCurrent,
              ]}
              onPress={() =>
                onOpenSessionConfig(
                  week,
                  sessionOrd,
                  config ?? {
                    session_note: '',
                    target_muscles: [],
                    preset_exercise_ids: [],
                  },
                )
              }
              activeOpacity={0.75}
            >
              <View style={styles.sessionCardHeader}>
                <View style={styles.sessionCardHeaderLeft}>
                  <Text
                    style={[
                      styles.sessionOrdinalLabel,
                      isCurrentOrd && styles.sessionOrdinalLabelCurrent,
                    ]}
                  >
                    Sesión {sessionOrd}/{normalizedWeek.totalSessions}
                  </Text>
                  {isCurrentOrd && (
                    <Text style={styles.currentOrdTag}>• SESIÓN ACTUAL</Text>
                  )}
                </View>

                <View style={styles.sessionCardConfigTrigger}>
                  <Sliders
                    size={13}
                    color={isConfigured ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sessionCardConfigTriggerText,
                      isConfigured && styles.sessionCardConfigTriggerTextActive,
                    ]}
                  >
                    {isConfigured ? 'Configurado' : 'Configurar'}
                  </Text>
                  <ChevronRight size={13} color={COLORS.textSecondary} />
                </View>
              </View>

              {isConfigured ? (
                <View style={styles.sessionCardBody}>
                  {hasNote && (
                    <Text style={styles.sessionPreviewNote} numberOfLines={2}>
                      {config.session_note}
                    </Text>
                  )}

                  <View style={styles.sessionPreviewBadgesRow}>
                    {hasMuscles && (
                      <View style={styles.sessionPreviewMuscles}>
                        {config.target_muscles.map((m) => (
                          <View
                            key={m}
                            style={styles.sessionPreviewMuscleBadge}
                          >
                            <Text style={styles.sessionPreviewMuscleBadgeText}>
                              {m}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {hasPresets && (
                      <View style={styles.sessionPreviewPresetsBadge}>
                        <Dumbbell size={11} color={COLORS.primary} />
                        <Text style={styles.sessionPreviewPresetsText}>
                          {config.preset_exercise_ids.length}{' '}
                          {config.preset_exercise_ids.length === 1
                            ? 'ejercicio'
                            : 'ejercicios'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={styles.sessionPlaceholderText}>
                  Toca para directriz táctica y pre-carga opcional...
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </PlanWeekAccordionItem>
  );
}

const styles = StyleSheet.create({
  weekCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weekCardActiveBorder: {
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: SPACING.xs,
  },
  weekBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  loadBadge: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryBorder,
  },
  deloadBadge: {
    backgroundColor: COLORS.surfaceHighlight,
    borderColor: COLORS.border,
  },
  weekBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  loadBadgeText: {
    color: COLORS.primary,
  },
  deloadBadgeText: {
    color: COLORS.textPrimary,
  },
  weekTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  weekSubText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activePillText: {
    color: COLORS.textInverted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activateBtn: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activateBtnText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#2A1515',
    borderWidth: 1,
    borderColor: '#4A1C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionChevron: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 2,
  },
  accordionBody: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    borderColor: COLORS.primary,
  },
  typeOptionBtnDescargaActive: {
    backgroundColor: COLORS.btnSecondary,
    borderColor: COLORS.border,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  typeOptionTextCargaActive: {
    color: COLORS.textInverted,
  },
  typeOptionTextDescargaActive: {
    color: COLORS.textPrimary,
  },
  frequencySection: {
    marginTop: 14,
    marginBottom: 10,
  },
  sectionLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  freqButton: {
    flex: 1, // Distribuye los 5 botones exactamente iguales sin desbordar
    height: 40,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqButtonActive: {
    backgroundColor: '#26381E',
    borderColor: '#9FE870',
  },
  freqButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  freqButtonTextActive: {
    color: '#9FE870',
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
    paddingVertical: 10,
    color: COLORS.textBody,
    fontSize: 14,
    lineHeight: LINE_HEIGHT.base,
    minHeight: 44,
  },
  forceCloseWeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: SPACING.sm,
  },
  forceCloseWeekBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  sessionNotesList: {
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  sessionCardItem: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md - 4,
  },
  sessionCardItemCurrent: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primarySoft,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionCardConfigTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionCardConfigTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  sessionCardConfigTriggerTextActive: {
    color: COLORS.primary,
  },
  sessionOrdinalLabel: {
    fontSize: 13,
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
  sessionCardBody: {
    marginTop: 6,
  },
  sessionPreviewNote: {
    fontSize: 13,
    color: COLORS.textBody,
    lineHeight: LINE_HEIGHT.sm,
    marginBottom: 8,
  },
  sessionPreviewBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  sessionPreviewMuscles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sessionPreviewMuscleBadge: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  sessionPreviewMuscleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sessionPreviewPresetsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.3)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  sessionPreviewPresetsText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sessionPlaceholderText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
