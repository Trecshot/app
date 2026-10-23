import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '../../theme';
import { getBlockDay, useSessionStore } from '../../store/useSessionStore';

/** Indicador global: "Semana de Carga - Día 3/7". Al tocarlo permite cambiar carga/descarga. */
export function BlockIndicator() {
  const currentBlock = useSessionStore((s) => s.currentBlock);
  const openBlockPicker = useSessionStore((s) => s.openBlockPicker);

  if (!currentBlock) {
    return (
      <TouchableOpacity style={[styles.badge, styles.badgeEmpty]} onPress={openBlockPicker} activeOpacity={0.7}>
        <Text style={styles.text}>Elegir tipo de semana</Text>
        <ChevronDown size={14} color={COLORS.textPrimary} strokeWidth={2.5} />
      </TouchableOpacity>
    );
  }

  const isCarga = currentBlock.type === 'carga';
  const day = getBlockDay(currentBlock);

  return (
    <TouchableOpacity
      style={[styles.badge, isCarga ? styles.badgeCarga : styles.badgeDescarga]}
      onPress={openBlockPicker}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel="Cambiar tipo de semana"
    >
      <View style={[styles.dot, { backgroundColor: isCarga ? COLORS.timerSurface : COLORS.primaryDark }]} />
      <Text style={styles.text}>
        Semana de {isCarga ? 'Carga' : 'Descarga'} - Día {day}/7
      </Text>
      <ChevronDown size={14} color={COLORS.textPrimary} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 8,
  },
  badgeCarga: {
    backgroundColor: COLORS.primary,
  },
  badgeDescarga: {
    backgroundColor: 'rgba(143, 155, 122, 0.2)',
  },
  badgeEmpty: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
