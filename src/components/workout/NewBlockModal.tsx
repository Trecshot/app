import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS, SPACING } from '../../theme';
import {
  BLOCK_TARGET_SESSIONS,
  formatBlockStartDate,
  getBlockDay,
  isBlockExpired,
  useSessionStore,
} from '../../store/useSessionStore';
import type { WeekType } from '../../../types';

/**
 * Modal global de gestión de bloques de 7 sesiones efectivas (carga/descarga).
 * - Sin bloqueos forzosos: al completar 7/7 sesiones de sobrecarga sugiere pasar a descarga,
 *   pero permite encadenar otra semana de sobrecarga o cerrar el aviso libremente.
 */
export function NewBlockModal() {
  const blockStatus = useSessionStore((s) => s.blockStatus);
  const lastBlock = useSessionStore((s) => s.lastBlock);
  const currentBlock = useSessionStore((s) => s.currentBlock);
  const isBlockPickerOpen = useSessionStore((s) => s.isBlockPickerOpen);
  const showDeloadSuggestion = useSessionStore((s) => s.showDeloadSuggestion);
  const dismissDeloadSuggestion = useSessionStore((s) => s.dismissDeloadSuggestion);
  const startNewBlock = useSessionStore((s) => s.startNewBlock);
  const changeCurrentBlockType = useSessionStore((s) => s.changeCurrentBlockType);
  const closeBlockPicker = useSessionStore((s) => s.closeBlockPicker);
  const [saving, setSaving] = useState<WeekType | null>(null);

  const isInitialSetup = blockStatus === 'needs_new';
  const isEditing = !isInitialSetup && isBlockPickerOpen && currentBlock !== null;
  const isSuggestionMode = !isInitialSetup && !isBlockPickerOpen && showDeloadSuggestion;
  const isCompletedBlock = currentBlock ? isBlockExpired(currentBlock) : false;
  const selectedType = isEditing && !isCompletedBlock ? currentBlock?.type : undefined;

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

  const handleClose = () => {
    if (isSuggestionMode) {
      dismissDeloadSuggestion();
      return;
    }
    if (isInitialSetup) {
      void handleSelect('carga');
      return;
    }
    closeBlockPicker();
  };

  let eyebrow = 'NUEVO BLOQUE (7 SESIONES)';
  let modalTitle = '¿Cómo será este bloque?';
  let subtitle =
    'El bloque se contabiliza por 7 sesiones efectivas completadas, sin atarse rígidamente a los días del calendario.';

  if (isSuggestionMode && currentBlock) {
    eyebrow = 'BLOQUE COMPLETADO · 7/7 SESIONES';
    modalTitle = '¡7 sesiones de sobrecarga completadas!';
    subtitle = `Completaste las 7/7 sesiones de tu bloque (${formatBlockStartDate(currentBlock.startDate)}). Te sugerimos iniciar una semana de Descarga para favorecer la recuperación articular y muscular, aunque puedes encadenar otro bloque de Sobrecarga si te sientes con energía.`;
  } else if (isEditing && currentBlock) {
    const target = currentBlock.targetSessions ?? BLOCK_TARGET_SESSIONS;
    const initiatedText = formatBlockStartDate(currentBlock.startDate);
    if (isCompletedBlock) {
      eyebrow = `BLOQUE FINALIZADO (${target}/${target})`;
      modalTitle = 'Iniciar siguiente bloque de 7 sesiones';
      subtitle = `${initiatedText} · ${target}/${target} sesiones completadas. Elige el enfoque para tu próximo bloque de 7 sesiones.`;
    } else {
      eyebrow = 'BLOQUE ACTUAL';
      modalTitle = '¿En qué bloque estás?';
      subtitle = `${initiatedText} · Sesión ${getBlockDay(currentBlock)}/${target}. Puedes cambiar el tipo del bloque actual en cualquier momento.`;
    }
  } else if (lastBlock) {
    subtitle = `Tu bloque anterior de ${lastBlock.type} (${formatBlockStartDate(lastBlock.startDate)}) finalizó. ${subtitle}`;
  }

  const renderOption = (type: WeekType, title: string, hint: string, badgeText?: string) => {
    const isCarga = type === 'carga';
    const isSelected = selectedType === type;
    const textColor = isCarga ? COLORS.timerSurface : COLORS.textPrimary;
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
                {badgeText ? (
                  <View style={styles.recommendedPill}>
                    <Text style={styles.recommendedPillText}>{badgeText}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.optionHint, isCarga && { color: COLORS.timerSurface }]}>{hint}</Text>
            </View>
            {isSelected ? <Check size={22} color={textColor} strokeWidth={3} /> : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isInitialSetup || isBlockPickerOpen || isSuggestionMode}
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

          {isSuggestionMode ? (
            <>
              {renderOption(
                'descarga',
                '🧘 Pasar a Semana de Descarga',
                'Reducir intensidad y optimizar supercompensación (7 sesiones)',
                'SUGERIDO',
              )}
              {renderOption(
                'carga',
                '💪 Encadenar otra Sobrecarga',
                'Continuar progresando en peso y volumen sin restricciones',
              )}
            </>
          ) : (
            <>
              {renderOption('carga', '💪 Semana de Carga', 'Progresar en peso y volumen (7 sesiones)')}
              {renderOption('descarga', '🧘 Semana de Descarga', 'Reducir intensidad y recuperar (7 sesiones)')}
            </>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={saving !== null}
          >
            <Text style={styles.cancelText}>
              {isSuggestionMode ? 'Ignorar aviso y continuar libremente' : 'Cerrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
  },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: COLORS.surfaceHighlight,
    borderColor: COLORS.border,
  },
  optionSelected: {
    borderColor: COLORS.timerSurface,
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
  recommendedPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  recommendedPillText: {
    color: COLORS.timerSurface,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  optionHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
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
