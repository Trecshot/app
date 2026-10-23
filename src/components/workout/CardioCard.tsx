// src/components/workout/CardioCard.tsx
import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Flame, X } from 'lucide-react-native';
import { CardioBlock, CardioType } from '../../../types/workout';
import { COLORS, SPACING } from '../../theme';

const CARDIO_TYPES: CardioType[] = ['Trote', 'Caminar', 'Salto en cuerda'];

interface Props {
  cardio: CardioBlock;
  onUpdate: (field: keyof CardioBlock, value: any) => void;
  onRemove: () => void;
}

export const CardioCard: React.FC<Props> = ({ cardio, onUpdate, onRemove }) => {
  return (
    <View style={styles.card}>
      {/* Header con Selector de Tipo e Ícono de Eliminar */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Flame size={18} color={COLORS.primary} strokeWidth={2.5} />
          <Text style={styles.title}>{cardio.type}</Text>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
        >
          <X size={18} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Selector de Modalidad (Pills) */}
      <View style={styles.typeSelectorRow}>
        {CARDIO_TYPES.map((type) => {
          const isSelected = cardio.type === type;
          return (
            <Pressable
              key={type}
              onPress={() => onUpdate('type', type)}
              style={[
                styles.typePill,
                isSelected && styles.typePillActive,
              ]}
            >
              <Text
                style={[
                  styles.typePillText,
                  isSelected && styles.typePillTextActive,
                ]}
              >
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Fila de Campos de Entrada Dinámicos */}
      <View style={styles.inputsRow}>
        {/* Siempre visible: Minutos */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Minutos</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
            value={cardio.minutos > 0 ? String(cardio.minutos) : ''}
            onChangeText={(val) => {
              const cleaned = val.replace(/[^0-9.]/g, '');
              onUpdate('minutos', cleaned ? Number(cleaned) : 0);
            }}
          />
        </View>

        {/* Renderizado Condicional: Trote o Caminar */}
        {(cardio.type === 'Trote' || cardio.type === 'Caminar') && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nivel/Vel.</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
                value={cardio.velocidad !== undefined && cardio.velocidad > 0 ? String(cardio.velocidad) : ''}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9.]/g, '');
                  onUpdate('velocidad', cleaned ? Number(cleaned) : undefined);
                }}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Km</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0.0"
                placeholderTextColor={COLORS.textSecondary}
                value={cardio.kilometros !== undefined && cardio.kilometros > 0 ? String(cardio.kilometros) : ''}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9.]/g, '');
                  onUpdate('kilometros', cleaned ? Number(cleaned) : undefined);
                }}
              />
            </View>
          </>
        )}

        {/* Renderizado Condicional: Salto en Cuerda */}
        {cardio.type === 'Salto en cuerda' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Saltos</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              value={cardio.saltos !== undefined && cardio.saltos > 0 ? String(cardio.saltos) : ''}
              onChangeText={(val) => {
                const cleaned = val.replace(/[^0-9]/g, '');
                onUpdate('saltos', cleaned ? Number(cleaned) : undefined);
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  removeButton: {
    padding: 4,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.md,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typePillActive: {
    backgroundColor: 'rgba(193, 225, 79, 0.15)',
    borderColor: COLORS.primary,
  },
  typePillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
