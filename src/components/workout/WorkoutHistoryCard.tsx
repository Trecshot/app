import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, Dumbbell, Trophy, ChevronRight } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../theme';

interface WorkoutHistoryCardProps {
  title: string;
  focus?: string;
  date: string;
  duration: string;
  volume: string;
  prs: number;
  exercises: string[];
}

export const WorkoutHistoryCard = ({ title, focus, date, duration, volume, prs, exercises }: WorkoutHistoryCardProps) => {
  return (
    <TouchableOpacity style={GLOBAL_STYLES.card} activeOpacity={0.7}>
      {/* Cabecera: Título y Fecha */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.date}>{date}</Text>
            {focus ? (
              <View style={styles.focusBadge}>
                <Text style={styles.focusText}>{focus}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <ChevronRight color={COLORS.textSecondary} size={20} />
      </View>

      {/* Fila de Métricas Rápidas */}
      <View style={styles.statsContainer}>
        <View style={styles.statBadge}>
          <Clock size={16} color={COLORS.textSecondary} />
          <Text style={styles.statText}>{duration}</Text>
        </View>
        
        <View style={styles.statBadge}>
          <Dumbbell size={16} color={COLORS.textSecondary} />
          <Text style={styles.statText}>{volume}</Text>
        </View>
        
        {/* Renderizado condicional: Solo aparece si hay PRs */}
        {prs > 0 && (
          <View style={[styles.statBadge, styles.prBadge]}>
            <Trophy size={16} color="#D97706" />
            <Text style={[styles.statText, { color: '#D97706', fontWeight: 'bold' }]}>{prs} PRs</Text>
          </View>
        )}
      </View>

      {/* Vista previa de ejercicios */}
      <View style={styles.exerciseList}>
        {exercises.slice(0, 3).map((ex, idx) => (
          <Text key={idx} style={styles.exerciseText} numberOfLines={1}>
            <Text style={styles.bulletPoint}>•</Text> {ex}
          </Text>
        ))}
        {/* Indicador de ejercicios ocultos si hay más de 3 */}
        {exercises.length > 3 && (
          <Text style={styles.moreText}>+ {exercises.length - 3} ejercicios más</Text>
        )}
      </View>
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
  }
});
