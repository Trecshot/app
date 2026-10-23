import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS, SPACING } from '../../theme';
import { getBlockDay, useSessionStore } from '../../store/useSessionStore';
import type { WeekType } from '../../../types';

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Modal global de selección de semana (carga/descarga).
 * - Obligatorio cuando no existe un bloque vigente (primera apertura o el último expiró).
 * - Manual al tocar el indicador de semana: permite cambiar el tipo del bloque actual.
 */
export function NewBlockModal() {
  const blockStatus = useSessionStore((s) => s.blockStatus);
  const lastBlock = useSessionStore((s) => s.lastBlock);
  const currentBlock = useSessionStore((s) => s.currentBlock);
  const isBlockPickerOpen = useSessionStore((s) => s.isBlockPickerOpen);
  const startNewBlock = useSessionStore((s) => s.startNewBlock);
  const changeCurrentBlockType = useSessionStore((s) => s.changeCurrentBlockType);
  const closeBlockPicker = useSessionStore((s) => s.closeBlockPicker);
  const [saving, setSaving] = useState<WeekType | null>(null);

  const isMandatory = blockStatus === 'needs_new';
  const isEditing = !isMandatory && isBlockPickerOpen && currentBlock !== null;
  const selectedType = isEditing ? currentBlock?.type : undefined;

  const handleSelect = async (type: WeekType) => {
    try {
      setSaving(type);
      if (isEditing) {
        await changeCurrentBlockType(type);
      } else {
        await startNewBlock(type);
      }
    } catch (error) {
      console.error('Error al guardar el tipo de semana:', error);
      Alert.alert('No se pudo guardar la semana', 'Inténtalo de nuevo.');
    } finally {
      setSaving(null);
    }
  };

  const handleClose = () => {
    if (!isMandatory) closeBlockPicker();
  };

  let subtitle = 'El bloque durará 7 días desde hoy, sin importar cuántas sesiones hagas.';
  if (isEditing && currentBlock) {
    subtitle = `Semana del ${formatShortDate(currentBlock.startDate)} al ${formatShortDate(currentBlock.endDate)} · Día ${getBlockDay(currentBlock)}/7. Las sesiones ya registradas en esta semana también se actualizarán.`;
  } else if (lastBlock) {
    subtitle = `Tu semana de ${lastBlock.type} (${formatShortDate(lastBlock.startDate)} al ${formatShortDate(lastBlock.endDate)}) terminó. ${subtitle}`;
  }

  const renderOption = (type: WeekType, title: string, hint: string) => {
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
              <Text style={[styles.optionTitle, { color: textColor }]}>{title}</Text>
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
      visible={isMandatory || isBlockPickerOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{isEditing ? 'SEMANA ACTUAL' : 'NUEVA SEMANA'}</Text>
          <Text style={styles.title}>
            {isEditing ? '¿En qué semana estás?' : '¿Cómo será esta semana?'}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {renderOption('carga', '💪 Semana de Carga', 'Progresar en peso y volumen')}
          {renderOption('descarga', '🧘 Semana de Descarga', 'Reducir intensidad y recuperar')}

          {!isMandatory ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={saving !== null}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
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
