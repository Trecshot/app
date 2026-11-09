import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, FastForward } from 'lucide-react-native';
import { COLORS, SPACING } from '../../theme';
import {
  BLOCK_TARGET_SESSIONS,
  formatBlockStartDate,
  getBlockDay,
  isBlockExpired,
  useSessionStore,
} from '../../store/useSessionStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { promptForceCloseWeek } from '../../database/planQueries';
import type { WeekType } from '../../../types';

/**
 * Modal global de gestión de bloques y semanas (carga/descarga) con soporte
 * de cierre manual anticipado de semana o bloque activo.
 */
export function NewBlockModal() {
  const blockStatus = useSessionStore((s) => s.blockStatus);
  const lastBlock = useSessionStore((s) => s.lastBlock);
  const currentBlock = useSessionStore((s) => s.currentBlock);
  const activeWeek = useSessionStore((s) => s.activeWeek);
  const isBlockPickerOpen = useSessionStore((s) => s.isBlockPickerOpen);
  const startNewBlock = useSessionStore((s) => s.startNewBlock);
  const changeCurrentBlockType = useSessionStore((s) => s.changeCurrentBlockType);
  const forceAdvanceWeek = useSessionStore((s) => s.forceAdvanceWeek);
  const closeBlockPicker = useSessionStore((s) => s.closeBlockPicker);
  const [saving, setSaving] = useState<WeekType | 'advance' | null>(null);

  const isInitialSetup = blockStatus === 'needs_new';
  const isEditing = !isInitialSetup && isBlockPickerOpen && currentBlock !== null;
  const isCompletedBlock = currentBlock ? isBlockExpired(currentBlock) : false;
  const selectedType = isEditing && !isCompletedBlock ? currentBlock?.type : undefined;

  const completedSessions = Math.max(0, currentBlock?.sessionCount ?? 0);
  const totalSessions =
    activeWeek?.total_planned_sessions ??
    currentBlock?.targetSessions ??
    BLOCK_TARGET_SESSIONS;

  const handleSelect = async (type: WeekType) => {
    try {
      setSaving(type);
      if (isEditing && !isCompletedBlock) {
        await changeCurrentBlockType(type);
      } else {
        await startNewBlock(type);
      }
    } catch (error) {
      console.error('Error al guardar el tipo de semana:', error);
      Alert.alert('No se pudo guardar el bloque', 'Inténtalo de nuevo.');
    } finally {
      setSaving(null);
    }
  };

  const handleForceCloseWeek = () => {
    const weekNum = activeWeek?.week_number ?? 1;
    promptForceCloseWeek(weekNum, completedSessions, totalSessions, async () => {
      try {
        setSaving('advance');
        await forceAdvanceWeek();
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
      } catch (error) {
        console.error('Error al avanzar de semana manualmente:', error);
        Alert.alert('Error', 'No se pudo avanzar a la siguiente semana.');
      } finally {
        setSaving(null);
      }
    });
  };

  const handleClose = () => {
    if (isInitialSetup) {
      void handleSelect('carga');
      return;
    }
    closeBlockPicker();
  };

  let eyebrow = `NUEVO BLOQUE (${totalSessions} SESIONES)`;
  let modalTitle = '¿Cómo será este bloque?';
  let subtitle =
    'El bloque se contabiliza por sesiones efectivas completadas, sin atarse rígidamente a los días del calendario.';

  if (isEditing && currentBlock) {
    const initiatedText = formatBlockStartDate(currentBlock.startDate);
    if (isCompletedBlock) {
      eyebrow = `BLOQUE FINALIZADO (${totalSessions}/${totalSessions})`;
      modalTitle = 'Iniciar siguiente bloque';
      subtitle = `${initiatedText} · ${totalSessions}/${totalSessions} sesiones completadas. Elige el enfoque para tu próximo bloque.`;
    } else {
      eyebrow = activeWeek
        ? `SEMANA ${activeWeek.week_number} ACTIVA`
        : 'BLOQUE ACTUAL';
      modalTitle = '¿En qué bloque estás?';
      subtitle = `${initiatedText} · Sesión ${getBlockDay(currentBlock)}/${totalSessions} (${completedSessions}/${totalSessions} completadas). Puedes cambiar el tipo o concluir la semana actual para avanzar.`;
    }
  } else if (lastBlock) {
    subtitle = `Tu bloque anterior de ${lastBlock.type} (${formatBlockStartDate(lastBlock.startDate)}) finalizó. ${subtitle}`;
  }

  const renderOption = (type: WeekType, title: string, hint?: string) => {
    const isCarga = type === 'carga';
    const isSelected = selectedType === type;
    const textColor = isCarga ? COLORS.textInverted : COLORS.textPrimary;
    return (
      <TouchableOpacity
        style={[
          styles.option,
          isCarga ? styles.optionCarga : styles.optionDescarga,
          isSelected && styles.optionSelected,
        ]}
        onPress={() => void handleSelect(type)}
        disabled={saving !== null}
        activeOpacity={0.8}
      >
        {saving === type ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <View style={styles.optionRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.optionTitleRow}>
                <Text style={[styles.optionTitle, { color: textColor }]}>{title}</Text>
              </View>
              {hint ? (
                <Text style={[styles.optionHint, isCarga && { color: COLORS.textInverted }]}>{hint}</Text>
              ) : null}
            </View>
            {isSelected ? <Check size={22} color={textColor} strokeWidth={3} /> : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isInitialSetup || isBlockPickerOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{modalTitle}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {renderOption('carga', 'Semana de Carga', 'Progresión de peso y volumen')}
          {renderOption('descarga', 'Semana de Descarga', 'Reducción de intensidad')}

          {isEditing && !isCompletedBlock && (
            <TouchableOpacity
              style={styles.forceAdvanceButton}
              onPress={handleForceCloseWeek}
              disabled={saving !== null}
              activeOpacity={0.8}
            >
              {saving === 'advance' ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <FastForward size={16} color={COLORS.primary} />
                  <Text style={styles.forceAdvanceText}>
                    {activeWeek
                      ? `Concluir Semana ${activeWeek.week_number} y avanzar (${completedSessions}/${totalSessions})`
                      : `Concluir bloque actual e iniciar nuevo (${completedSessions}/${totalSessions})`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={saving !== null}
          >
            <Text style={styles.cancelText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.borderStrong,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  option: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    minHeight: 64,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCarga: {
    backgroundColor: COLORS.primary,
  },
  optionDescarga: {
    backgroundColor: COLORS.btnSecondary,
    borderColor: COLORS.border,
  },
  optionSelected: {
    borderColor: COLORS.textPrimary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  optionHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  forceAdvanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.xs,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  forceAdvanceText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: SPACING.xs,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
});
