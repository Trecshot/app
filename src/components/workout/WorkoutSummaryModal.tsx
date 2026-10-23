// src/components/workout/WorkoutSummaryModal.tsx
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  Trophy,
  Clock,
  Dumbbell,
  CheckCircle2,
  List,
} from 'lucide-react-native';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useSessionStore } from '../../store/useSessionStore';
import { COLORS, SPACING } from '../../theme';
import type { CardioBlock, MuscleGroup, WorkoutExerciseBlock, WorkoutSet } from '../../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigateToHistory: () => void;
  onSaveSession?: () => Promise<void> | void;
  saveSession?: () => Promise<void> | void;
  resetSession?: () => void;
  durationSeconds?: number;
  session?: {
    sessionFocus?: MuscleGroup[];
    exercises?: WorkoutExerciseBlock[];
    cardio?: CardioBlock[];
    [key: string]: any;
  } | null;
}

export const WorkoutSummaryModal: React.FC<Props> = ({
  visible,
  onClose,
  onNavigateToHistory,
  onSaveSession,
  saveSession: saveSessionProp,
  resetSession: resetSessionProp,
  durationSeconds,
  session: sessionProp,
}) => {
  // Selectors de Zustand
  const exercises = useWorkoutStore((state) => state.exercises);
  const sessionFocus = useWorkoutStore((state) => state.sessionFocus);
  const storeCardio = useWorkoutStore((state) => state.cardio);
  const resetWorkout = useWorkoutStore((state) => state.resetWorkout);
  const endSession = useSessionStore((state) => state.endSession);
  const getElapsedSeconds = useSessionStore((state) => state.getElapsedSeconds);

  // Blindaje de sesión: soporta prop 'session' o deriva de los stores
  const session = sessionProp ?? {
    sessionFocus: sessionFocus ?? [],
    exercises: exercises ?? [],
    cardio: storeCardio ?? [],
  };

  // 1. Selector de cálculo de cardio
  const cardioList = session?.cardio;
  const cardioStats = useMemo(() => {
    if (!cardioList || cardioList.length === 0) return null;

    const totalMin = cardioList.reduce(
      (acc, curr) => acc + (Number(curr?.minutos) || 0),
      0,
    );
    const totalKm = cardioList.reduce(
      (acc, curr) => acc + (Number(curr?.kilometros) || 0),
      0,
    );

    if (totalMin === 0 && totalKm === 0) return null;

    return { totalMin, totalKm };
  }, [cardioList]);

  // 2. Cálculos de datos derivados (Selectors blindados con useMemo)
  const sessionExercises = session?.exercises;
  const stats = useMemo(() => {
    let volume = 0;
    let completedSets = 0;
    let totalSets = 0;

    const list = sessionExercises ?? exercises ?? [];

    list.forEach((ex: WorkoutExerciseBlock) => {
      ex?.sets?.forEach((set: WorkoutSet) => {
        totalSets++;
        if (set?.isCompleted) {
          completedSets++;
          const reps = parseFloat(String(set?.reps ?? 0)) || 0;
          const weight = parseFloat(String(set?.weight ?? 0)) || 0;
          volume += reps * weight;
        }
      });
    });

    return {
      volume: Math.round(volume),
      completedSets,
      totalSets,
      exerciseCount: list.length,
    };
  }, [sessionExercises, exercises]);

  // Duración formateada a minutos/segundos con fallbacks seguros
  const formattedDuration = useMemo(() => {
    const rawSeconds = durationSeconds ?? (typeof getElapsedSeconds === 'function' ? getElapsedSeconds() : 0) ?? 0;
    const seconds = Math.max(0, rawSeconds);

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
    }
    return `${remainingSeconds}s`;
  }, [durationSeconds, getElapsedSeconds]);

  const saveSession = () => {
    if (saveSessionProp) {
      void saveSessionProp();
    } else if (onSaveSession) {
      void onSaveSession();
    }
  };

  const resetSession = () => {
    if (resetSessionProp) {
      resetSessionProp();
    } else {
      endSession();
      resetWorkout();
    }
  };

  const handleFinish = () => {
    // 1. Ejecutar persistencia de datos (Transacción SQLite)
    // Esto asegura que la sesión se guarde independientemente de lo que ocurra en la UI.
    saveSession();

    // 2. Ocultar el componente Modal visualmente
    // Se invoca el cambio de estado local (visible = false)
    onClose();

    // 3. Diferir la mutación destructiva y la navegación
    // Se otorga un margen (ej. 300ms - 500ms) para que la animación nativa de cierre del Modal finalice.
    setTimeout(() => {
      resetSession(); // Destrucción segura del estado en memoria
      onNavigateToHistory(); // Transición de pantalla sin colisiones nativas
    }, 400);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          <SafeAreaView>
            {/* Cabecera Verde Oscuro */}
            <View style={styles.header}>
              <View style={styles.trophyContainer}>
                <Trophy color="white" size={44} strokeWidth={2} />
              </View>
              <Text style={styles.headerKicker}>RESUMEN DE SESIÓN</Text>
              <Text style={styles.headerTitle}>¡Entrenamiento completado!</Text>

              {/* Renderizado dinámico de los enfoques (sessionFocus) */}
              {(session?.sessionFocus?.length ?? 0) > 0 && (
                <View style={styles.focusTagsContainer}>
                  {/* El operador '?' evita el crash si 'session' es null durante el desmontaje */}
                  {session?.sessionFocus?.map((focus) => (
                    <View key={focus} style={styles.focusTag}>
                      <Text style={styles.focusTagText}>{focus}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Grid de Estadísticas (2x2) */}
            <View style={styles.statsGrid}>
              <StatCard
                icon={<Clock size={20} color={COLORS.textSecondary} />}
                value={formattedDuration ?? '0s'}
                label="Duración"
              />
              <StatCard
                icon={<Dumbbell size={20} color={COLORS.textSecondary} />}
                value={`${(stats?.volume ?? 0).toLocaleString('es-CL')} kg`}
                label="Volumen total"
              />
              <StatCard
                icon={<CheckCircle2 size={20} color={COLORS.textSecondary} />}
                value={`${stats?.completedSets ?? 0}/${stats?.totalSets ?? 0}`}
                label="Series hechas"
              />
              <StatCard
                icon={<List size={20} color={COLORS.textSecondary} />}
                value={(stats?.exerciseCount ?? 0).toString()}
                label="Ejercicios"
              />
            </View>

            {/* Renderizado condicional actualizado */}
            {session?.cardio && session.cardio.length > 0 && (
              <View style={styles.cardioSummaryContainer}>
                <View style={styles.cardioHeaderRow}>
                  <Text style={styles.cardioSummaryTitle}>🔥 Cardio Extra</Text>
                  {cardioStats && (
                    <Text style={styles.cardioTotalBadge}>
                      {cardioStats.totalMin} min{cardioStats.totalKm > 0 ? ` • ${cardioStats.totalKm} km` : ''}
                    </Text>
                  )}
                </View>

                {session.cardio.map((cBlock, index) => (
                  <View key={cBlock.id || index} style={styles.cardioRow}>
                    <Text style={styles.cardioType}>{cBlock.type}</Text>
                    <Text style={styles.cardioDetails}>
                      {cBlock.minutos} min
                      {cBlock.kilometros ? ` • ${cBlock.kilometros} km` : ''}
                      {cBlock.velocidad ? ` • Vel: ${cBlock.velocidad}` : ''}
                      {cBlock.saltos ? ` • ${cBlock.saltos} saltos` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Botones de Acción */}
            <View style={styles.actionContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleFinish}
              >
                <Text style={styles.primaryButtonText}>Ver en Historial</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onClose}
              >
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

// Componente Auxiliar para las tarjetas de estadísticas en tarjetas blancas limpias
interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label }) => (
  <View style={styles.statCard}>
    <View style={styles.statIconContainer}>{icon}</View>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  cardContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    backgroundColor: COLORS.timerSurface,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  trophyContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(193, 225, 79, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  headerKicker: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.textInverted,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  focusTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  focusTag: {
    borderWidth: 1,
    borderColor: 'rgba(193, 225, 79, 0.5)',
    backgroundColor: 'rgba(193, 225, 79, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  focusTagText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    rowGap: SPACING.sm,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIconContainer: {
    marginBottom: SPACING.xs,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  actionContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  cardioSummaryContainer: {
    backgroundColor: COLORS.surfaceHighlight,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(193, 225, 79, 0.4)',
    gap: 8,
  },
  cardioHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardioSummaryTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  cardioTotalBadge: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  cardioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  cardioType: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardioDetails: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  primaryButtonText: {
    color: COLORS.timerSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
