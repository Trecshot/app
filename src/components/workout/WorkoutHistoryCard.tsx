import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Clock, Dumbbell, Trophy, MoreVertical } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../theme';
import type { CardioBlock } from '../../../types';

export interface WorkoutHistoryCardProps {
  title?: string;
  focus?: string;
  date?: string;
  duration?: string;
  volume?: string;
  prs?: number;
  exercises?: string[];
  cardio?: CardioBlock[];
  /** Si se define, muestra el menú (⋮) con la opción de eliminar el registro. */
  onDelete?: () => void | Promise<void>;
  session?: {
    id?: string;
    fecha?: string;
    sessionFocus?: string[];
    duracionSegundos?: number;
    exercises?: { id: string; name: string; sets: any[] }[];
    cardio?: CardioBlock[];
  };
}

export const WorkoutHistoryCard = ({
  title,
  focus,
  date,
  duration,
  volume,
  prs = 0,
  exercises = [],
  cardio = [],
  session,
  onDelete,
}: WorkoutHistoryCardProps) => {
  const displayTitle = title ?? (session?.exercises && session.exercises.length > 0
    ? session.exercises.map((e) => e.name).join(', ')
    : 'Entrenamiento');

  const displayDate = date ?? session?.fecha ?? '';
  const displayFocus = focus ?? session?.sessionFocus?.join(', ');
  const exerciseList = exercises.length > 0
    ? exercises
    : (session?.exercises ?? []).map((e) => `${e.name} (${e.sets?.length || 0} series)`);
  const cardioList = (session?.cardio && session.cardio.length > 0) ? session.cardio : cardio;

  // Menú contextual: confirmación nativa antes de borrar para evitar eliminaciones accidentales
  const handleOpenMenu = () => {
    if (!onDelete) return;
    Alert.alert(
      'Eliminar entrenamiento',
      `¿Seguro que quieres eliminar la sesión del ${displayDate}? Se borrarán también sus ejercicios, series y cardio. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void onDelete() },
      ],
      { cancelable: true },
    );
  };

  return (
    <TouchableOpacity style={GLOBAL_STYLES.card} activeOpacity={0.7}>
      {/* Cabecera: Título y Fecha */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title} numberOfLines={1}>{displayTitle}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.date}>{displayDate}</Text>
            {displayFocus ? (
              <View style={styles.focusBadge}>
                <Text style={styles.focusText}>{displayFocus}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {onDelete ? (
          <TouchableOpacity
            onPress={handleOpenMenu}
            style={styles.menuButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Opciones del entrenamiento"
          >
            <MoreVertical color={COLORS.textSecondary} size={20} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Fila de Métricas Rápidas */}
      {(duration || volume || prs > 0) && (
        <View style={styles.statsContainer}>
          {duration ? (
            <View style={styles.statBadge}>
              <Clock size={16} color={COLORS.textSecondary} />
              <Text style={styles.statText}>{duration}</Text>
            </View>
          ) : null}

          {volume ? (
            <View style={styles.statBadge}>
              <Dumbbell size={16} color={COLORS.textSecondary} />
              <Text style={styles.statText}>{volume}</Text>
            </View>
          ) : null}

          {/* Renderizado condicional: Solo aparece si hay PRs */}
          {prs > 0 && (
            <View style={[styles.statBadge, styles.prBadge]}>
              <Trophy size={16} color="#D97706" />
              <Text style={[styles.statText, { color: '#D97706', fontWeight: 'bold' }]}>{prs} PRs</Text>
            </View>
          )}
        </View>
      )}

      {/* Vista previa de ejercicios */}
      <View style={styles.exerciseList}>
        {exerciseList.slice(0, 3).map((ex, idx) => (
          <Text key={idx} style={styles.exerciseText} numberOfLines={1}>
            <Text style={styles.bulletPoint}>•</Text> {ex}
          </Text>
        ))}
        {/* Indicador de ejercicios ocultos si hay más de 3 */}
        {exerciseList.length > 3 && (
          <Text style={styles.moreText}>+ {exerciseList.length - 3} ejercicios más</Text>
        )}
      </View>

      {/* Renderizado de Cardio (Nueva sección) */}
      {cardioList && cardioList.length > 0 && (
        <View style={styles.historyCardioSection}>
          {cardioList.map((c, i) => (
            <Text key={c.id || i} style={styles.historyCardioText}>
              🏃 {c.type}: {c.minutos} min {c.kilometros ? `(${c.kilometros} km)` : ''}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  menuButton: {
    padding: 4,
    marginTop: -2,
    marginRight: -4,
    borderRadius: 8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  date: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  focusBadge: {
    backgroundColor: 'rgba(143, 155, 122, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  focusText: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  prBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)', // Naranja tenue
  },
  statText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  exerciseList: {
    gap: 4,
  },
  exerciseText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  bulletPoint: {
    color: COLORS.primaryDark,
    fontWeight: 'bold',
  },
  moreText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  historyCardioSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 4,
  },
  historyCardioText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
