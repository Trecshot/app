import { Activity, Dumbbell, History as HistoryIcon, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getWorkoutDetails } from '../../database';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { c } from '../../src/theme';
import type { SesionEntrenamiento, WorkoutDetails } from '../../types';

const formatoFechaCorta = (dateValue: string) => {
  const [year, month, day] = dateValue.split('-');
  return `${day}/${month}/${year}`;
};

export default function HistoryScreen() {
  const { history, weeklySummary, loading, deleteWorkout } = useWorkoutHistory();

  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);
  const [details, setDetails] = useState<{ workoutId: string; data: WorkoutDetails } | null>(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);

  async function toggleWorkoutDetails(workoutId: string) {
    if (expandedWorkoutId === workoutId) {
      setExpandedWorkoutId(null);
      setDetails(null);
      setDetailsLoadingId(null);
      return;
    }
    setExpandedWorkoutId(workoutId);
    setDetails(null);
    setDetailsLoadingId(workoutId);
    try {
      const workoutDetails = await getWorkoutDetails(workoutId);
      setDetails({ workoutId, data: workoutDetails });
    } finally {
      setDetailsLoadingId((current) => (current === workoutId ? null : current));
    }
  }

  function confirmDeleteWorkout(workoutId: string) {
    Alert.alert('Eliminar sesión', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { void deleteWorkout(workoutId); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>MI ENTRENAMIENTO</Text>
          <Text style={styles.title}>Tu constancia.</Text>
        </View>
        <View style={styles.logo}>
          <Dumbbell color={c.ink} size={22} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.historyIntro}>
          <Text style={styles.count}>{history.length}</Text>
          <View>
            <Text style={styles.historyLabel}>SESIONES REGISTRADAS</Text>
            <Text style={styles.historySub}>Cada entrenamiento cuenta.</Text>
          </View>
        </View>

        {weeklySummary.length > 0 && (
          <View style={weeklyStyles.section}>
            <Text style={styles.headingText}>Rendimiento semanal</Text>
            <Text style={styles.hint}>Días entrenados por semana ISO</Text>
            {weeklySummary.map((summary) => (
              <View style={weeklyStyles.card} key={`${summary.weekYear}-${summary.cycleWeek}-${summary.weekType}`}>
                <Text style={weeklyStyles.title}>
                  Semana {summary.cycleWeek}, {summary.weekYear} · {summary.weekType === 'carga' ? 'CARGA' : 'DESCARGA'}
                </Text>
                <Text style={weeklyStyles.range}>
                  Rango: {formatoFechaCorta(summary.weekStart)} al {formatoFechaCorta(summary.weekEnd)}
                </Text>
                <Text style={weeklyStyles.days}>Días entrenados: {summary.trainingDays} / 7</Text>
                <Text style={weeklyStyles.dates}>Fechas: {summary.dates}</Text>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <Text style={styles.emptyText}>Cargando historial...</Text>
        ) : history.length === 0 ? (
          <View style={styles.empty}>
            <HistoryIcon color={c.muted} size={32} />
            <Text style={styles.emptyTitle}>Aún no hay sesiones</Text>
            <Text style={styles.emptyText}>Guarda tu primer entrenamiento para verlo aquí.</Text>
          </View>
        ) : (
          history.map((workout) => (
            <WorkoutHistoryCard
              key={workout.id}
              workout={workout}
              expanded={expandedWorkoutId === workout.id}
              details={details?.workoutId === workout.id ? details.data : null}
              loadingDetails={detailsLoadingId === workout.id}
              onToggle={() => {
                void toggleWorkoutDetails(workout.id);
              }}
              onDelete={() => confirmDeleteWorkout(workout.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface WorkoutHistoryCardProps {
  workout: SesionEntrenamiento;
  expanded: boolean;
  details: WorkoutDetails | null;
  loadingDetails: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function WorkoutHistoryCard({
  workout,
  expanded,
  details,
  loadingDetails,
  onToggle,
  onDelete,
}: WorkoutHistoryCardProps) {
  return (
    <View style={styles.historyCard}>
      <View style={[styles.rowBetween, detailStyles.header]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={detailStyles.toggle}
          onPress={onToggle}
        >
          <Text style={styles.date}>{workout.fecha}</Text>
          <Text style={styles.meta}>
            {workout.tipoSemana === 'carga' ? 'Semana de carga' : 'Semana de descarga'} · {Math.floor(workout.duracionSegundos / 60)} min
          </Text>
          <Text style={styles.meta}>Semana del año: {workout.cycleWeek ?? 1}</Text>
          {workout.notas ? <Text style={styles.meta}>Notas: {workout.notas}</Text> : null}
          <Text style={detailStyles.toggleLabel}>{expanded ? 'Ocultar detalles' : 'Ver ejercicios y cardio'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Eliminar sesión" onPress={onDelete}>
          <Trash2 color={c.red} size={18} />
        </Pressable>
      </View>
      {expanded && (
        <View style={detailStyles.body}>
          {loadingDetails ? (
            <Text style={styles.emptyText}>Cargando detalles...</Text>
          ) : !details || (details.exercises.length === 0 && details.cardio.length === 0) ? (
            <Text style={styles.emptyText}>Esta sesión no tiene ejercicios ni cardio registrados.</Text>
          ) : (
            <>
              {details.exercises.map((set, index) => (
                <View style={detailStyles.entry} key={`${set.exerciseId ?? set.exerciseName}-${set.setNumber}-${index}`}>
                  <View style={styles.live}>
                    <Dumbbell color={c.green} size={14} />
                    <Text style={detailStyles.exerciseName}>
                      {set.exerciseName} · {set.muscleGroup}
                    </Text>
                  </View>
                  <Text style={detailStyles.detailText}>
                    Serie {set.setNumber} · {set.reps} reps · {set.weight} kg
                  </Text>
                </View>
              ))}
              {details.cardio.map((cardio, index) => (
                <View style={detailStyles.entry} key={`${cardio.cardioType}-${index}`}>
                  <View style={styles.live}>
                    <Activity color={c.orange} size={14} />
                    <Text style={detailStyles.exerciseName}>Cardio · {cardio.cardioType}</Text>
                  </View>
                  <Text style={detailStyles.detailText}>
                    {cardio.durationMinutes} min
                    {cardio.distanceKm !== undefined ? ` · ${cardio.distanceKm} km` : ''}
                    {cardio.level !== undefined ? ` · Nivel ${cardio.level}` : ''}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.paper },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: { color: c.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: c.ink, fontSize: 25, fontWeight: '800', marginTop: 5 },
  logo: { width: 44, height: 44, backgroundColor: c.lime, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 40, gap: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingText: { color: c.ink, fontSize: 19, fontWeight: '800' },
  hint: { color: c.muted, fontSize: 12 },
  historyIntro: { backgroundColor: c.ink, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  count: { color: c.lime, fontSize: 44, fontWeight: '900' },
  historyLabel: { color: c.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.8 },
  historySub: { color: '#aab6ad', marginTop: 4, fontSize: 12 },
  historyCard: { backgroundColor: c.white, borderWidth: 1, borderColor: c.line, borderRadius: 17, padding: 16 },
  date: { color: c.ink, fontSize: 16, fontWeight: '800' },
  meta: { color: c.muted, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 45, gap: 10 },
  emptyTitle: { color: c.ink, fontSize: 18, fontWeight: '800' },
  emptyText: { color: c.muted, textAlign: 'center', fontSize: 13 },
});

const detailStyles = StyleSheet.create({
  header: { gap: 12, alignItems: 'flex-start' },
  toggle: { flex: 1, gap: 4 },
  toggleLabel: { color: c.green, fontSize: 12, fontWeight: '800', marginTop: 3 },
  body: { borderTopWidth: 1, borderTopColor: c.line, marginTop: 14, paddingTop: 12, gap: 12 },
  entry: { gap: 4 },
  exerciseName: { color: c.ink, fontSize: 13, fontWeight: '700' },
  detailText: { color: c.muted, fontSize: 12, marginLeft: 22 },
});

const weeklyStyles = StyleSheet.create({
  section: { gap: 10 },
  card: { backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 15, gap: 7 },
  title: { color: c.ink, fontSize: 14, fontWeight: '900' },
  range: { color: c.muted, fontSize: 12, fontWeight: '700' },
  days: { color: c.green, fontSize: 13, fontWeight: '800' },
  dates: { color: c.muted, fontSize: 12, lineHeight: 18 },
});
