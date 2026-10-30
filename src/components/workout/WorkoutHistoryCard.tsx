import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  Clock,
  Dumbbell,
  Trophy,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  FileText,
} from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../theme';
import type { CardioBlock, Ejercicio } from '../../../types';

export interface WorkoutHistoryCardProps {
  title?: string;
  focus?: string;
  date?: string;
  duration?: string;
  volume?: string;
  prs?: number;
  exercises?: string[];
  detailedExercises?: Ejercicio[];
  notes?: string;
  cardio?: CardioBlock[];
  /** Si se define, muestra el menú (⋮) con la opción de eliminar el registro. */
  onDelete?: () => void | Promise<void>;
  session?: {
    id?: string;
    fecha?: string;
    notas?: string;
    sessionFocus?: string[];
    duracionSegundos?: number;
    exercises?: { id: string; name: string; sets: any[] }[];
    ejercicios?: Ejercicio[];
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
  detailedExercises,
  notes,
  cardio = [],
  session,
  onDelete,
}: WorkoutHistoryCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const sessionEjercicios = session?.ejercicios;
  const sessionExercises = session?.exercises;

  const normalizedExercises = useMemo(() => {
    const sourceDetailed = detailedExercises ?? sessionEjercicios;
    if (sourceDetailed && sourceDetailed.length > 0) {
      return sourceDetailed.map((ex, idx) => ({
        id: ex.id || `ex-${idx}`,
        name: ex.nombre || 'Ejercicio',
        muscleGroup: ex.grupoMuscular,
        sets: (ex.series ?? []).map((s, sIdx) => {
          const reps = Number(s.reps ?? 0);
          const weight = Number(s.pesoKg ?? 0);
          const setType = s.setType ?? 'NORMAL';
          return {
            id: s.id || `set-${idx}-${sIdx}`,
            setNumber: sIdx + 1,
            reps,
            weight,
            setType,
            isPr:
              setType === 'NORMAL' &&
              Boolean(s.isPr) &&
              reps >= 1 &&
              reps <= 5 &&
              weight > 0,
          };
        }),
      }));
    }

    if (sessionExercises && sessionExercises.length > 0) {
      return sessionExercises.map((ex, idx) => ({
        id: ex.id || `ex-${idx}`,
        name: ex.name || 'Ejercicio',
        muscleGroup: undefined,
        sets: (ex.sets ?? []).map((s: any, sIdx: number) => {
          const reps = Number(s.reps ?? 0);
          const weight = Number(s.weight ?? s.pesoKg ?? 0);
          const setType = s.setType ?? 'NORMAL';
          return {
            id: s.id || `set-${idx}-${sIdx}`,
            setNumber: sIdx + 1,
            reps,
            weight,
            setType,
            isPr:
              setType === 'NORMAL' &&
              Boolean(s.isPr) &&
              reps >= 1 &&
              reps <= 5 &&
              weight > 0,
          };
        }),
      }));
    }

    return [];
  }, [detailedExercises, sessionEjercicios, sessionExercises]);

  const displayTitle =
    title ??
    (normalizedExercises.length > 0
      ? normalizedExercises.map((e) => e.name).join(', ')
      : 'Entrenamiento');

  const displayDate = date ?? session?.fecha ?? '';
  const displayFocus = focus ?? session?.sessionFocus?.join(', ');
  const displayNotes = notes ?? session?.notas;
  const exerciseList =
    exercises.length > 0
      ? exercises
      : normalizedExercises.map((e) => `${e.name} (${e.sets.length} series)`);
  const cardioList =
    session?.cardio && session.cardio.length > 0 ? session.cardio : cardio;

  const totalExercisesCount =
    normalizedExercises.length > 0 ? normalizedExercises.length : exerciseList.length;

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
    <View style={GLOBAL_STYLES.card}>
      {/* Cabecera: Título, Fecha y Controles (Expansión + Menú) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerTextContainer}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.title} numberOfLines={isExpanded ? 2 : 1}>
            {displayTitle}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.date}>{displayDate}</Text>
            {displayFocus ? (
              <View style={styles.focusBadge}>
                <Text style={styles.focusText}>{displayFocus}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setIsExpanded(!isExpanded)}
            style={styles.expandButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? 'Contraer desglose de sesión' : 'Expandir desglose de sesión'
            }
          >
            {isExpanded ? (
              <ChevronDown color={COLORS.textPrimary} size={20} />
            ) : (
              <ChevronRight color={COLORS.textSecondary} size={20} />
            )}
          </TouchableOpacity>

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
      </View>

      {/* Fila de Métricas Rápidas */}
      {(duration || volume || prs > 0 || totalExercisesCount > 0) && (
        <View
          style={[
            styles.statsContainer,
            !isExpanded && (!cardioList || cardioList.length === 0) && styles.statsContainerCompact,
          ]}
        >
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

          {prs > 0 && (
            <View style={[styles.statBadge, styles.prBadge]}>
              <Trophy size={16} color="#D97706" />
              <Text style={[styles.statText, { color: '#D97706', fontWeight: 'bold' }]}>
                {prs} PRs
              </Text>
            </View>
          )}

          {totalExercisesCount > 0 && (
            <TouchableOpacity
              style={styles.expandHintBadge}
              onPress={() => setIsExpanded(!isExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.expandHintText}>
                {isExpanded
                  ? 'Ocultar detalle'
                  : `Ver ${totalExercisesCount} ${totalExercisesCount === 1 ? 'ejercicio' : 'ejercicios'}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Desglose Detallado Desplegable (Accordion) */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          {normalizedExercises.length > 0 ? (
            normalizedExercises.map((ex, idx) => (
              <View
                key={ex.id || idx}
                style={[
                  styles.exerciseBlock,
                  idx === normalizedExercises.length - 1 && styles.exerciseBlockLast,
                ]}
              >
                <View style={styles.exerciseHeaderRow}>
                  <Text style={styles.exerciseBlockTitle}>{ex.name}</Text>
                  <View style={styles.seriesCountBadge}>
                    <Text style={styles.seriesCountText}>
                      {ex.sets.length} {ex.sets.length === 1 ? 'serie' : 'series'}
                    </Text>
                  </View>
                </View>

                <View style={styles.setsBreakdownList}>
                  {ex.sets.map((s) => (
                    <View
                      key={s.id}
                      style={[styles.setBreakdownRow, s.isPr && styles.setBreakdownRowPr]}
                    >
                      <View style={styles.setLeftGroup}>
                        <Text style={styles.setIndexText}>Serie {s.setNumber}</Text>
                        {s.setType === 'DROP_SET' && (
                          <View style={[styles.setPrTag, { backgroundColor: COLORS.dropSetIndicator }]}>
                            <Text style={[styles.setPrTagText, { color: COLORS.dropSetAccent }]}>
                              Drop Set
                            </Text>
                          </View>
                        )}
                        {s.setType === 'WARMUP' && (
                          <View style={[styles.setPrTag, { backgroundColor: COLORS.warmupIndicator }]}>
                            <Text style={[styles.setPrTagText, { color: COLORS.warmupAccent }]}>
                              Calentamiento
                            </Text>
                          </View>
                        )}
                        {s.isPr && (
                          <View style={styles.setPrTag}>
                            <Trophy size={11} color="#D97706" />
                            <Text style={styles.setPrTagText}>PR Absoluto</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.setMetricsText}>
                        {s.reps} reps × {s.weight} kg
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.exerciseList}>
              {exerciseList.map((ex, idx) => (
                <Text key={idx} style={styles.exerciseText}>
                  <Text style={styles.bulletPoint}>•</Text> {ex}
                </Text>
              ))}
            </View>
          )}

          {displayNotes ? (
            <View style={styles.notesBox}>
              <View style={styles.notesHeader}>
                <FileText size={14} color={COLORS.primaryDark} />
                <Text style={styles.notesLabel}>Notas de la sesión</Text>
              </View>
              <Text style={styles.notesText}>{displayNotes}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Renderizado de Cardio */}
      {cardioList && cardioList.length > 0 && (
        <View style={styles.historyCardioSection}>
          {cardioList.map((c, i) => (
            <Text key={c.id || i} style={styles.historyCardioText}>
              🏃 {c.type}: {c.minutos} min {c.kilometros ? `(${c.kilometros} km)` : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
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
    marginRight: SPACING.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceHighlight,
  },
  menuButton: {
    padding: 4,
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
    flexWrap: 'wrap',
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
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsContainerCompact: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
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
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
  },
  statText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  expandHintBadge: {
    marginLeft: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  expandHintText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  expandedSection: {
    gap: SPACING.sm,
  },
  exerciseBlock: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseBlockLast: {
    marginBottom: 2,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  exerciseBlockTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  seriesCountBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  seriesCountText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  setsBreakdownList: {
    gap: 4,
  },
  setBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
  },
  setBreakdownRowPr: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  setLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setPrTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(217, 119, 6, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  setPrTagText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },
  setIndexText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  setMetricsText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
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
  notesBox: {
    marginTop: 4,
    padding: SPACING.sm,
    backgroundColor: 'rgba(143, 155, 122, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(143, 155, 122, 0.25)',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  notesLabel: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  notesText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 18,
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
    fontVariant: ['tabular-nums'],
  },
});
