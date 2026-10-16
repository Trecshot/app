import { Dumbbell, History as HistoryIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  type ListRenderItemInfo,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getWorkoutDetails } from '../../database';
import { WorkoutHistoryCard } from '../../src/components/WorkoutHistoryCard';
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

  const toggleWorkoutDetails = useCallback(
    async (workoutId: string) => {
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
    },
    [expandedWorkoutId],
  );

  const confirmDeleteWorkout = useCallback(
    (workoutId: string) => {
      Alert.alert('Eliminar sesión', '¿Deseas eliminar este registro?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void deleteWorkout(workoutId);
          },
        },
      ]);
    },
    [deleteWorkout],
  );

  const renderWorkoutItem = useCallback(
    ({ item }: ListRenderItemInfo<SesionEntrenamiento>) => (
      <WorkoutHistoryCard
        workout={item}
        expanded={expandedWorkoutId === item.id}
        details={details?.workoutId === item.id ? details.data : null}
        loadingDetails={detailsLoadingId === item.id}
        onToggle={toggleWorkoutDetails}
        onDelete={confirmDeleteWorkout}
      />
    ),
    [expandedWorkoutId, details, detailsLoadingId, toggleWorkoutDetails, confirmDeleteWorkout],
  );

  const keyExtractor = useCallback((item: SesionEntrenamiento) => item.id, []);

  const ListHeader = useCallback(
    () => (
      <View style={styles.headerSection}>
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

        {history.length > 0 && (
          <View style={styles.listHeading}>
            <Text style={styles.headingText}>Entrenamientos pasados</Text>
          </View>
        )}
      </View>
    ),
    [history.length, weeklySummary],
  );

  const ListEmpty = useCallback(() => {
    if (loading) {
      return <Text style={styles.emptyText}>Cargando historial...</Text>;
    }
    return (
      <View style={styles.empty}>
        <HistoryIcon color={c.muted} size={32} />
        <Text style={styles.emptyTitle}>Aún no hay sesiones</Text>
        <Text style={styles.emptyText}>Guarda tu primer entrenamiento para verlo aquí.</Text>
      </View>
    );
  }, [loading]);

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

      <FlatList
        data={history as SesionEntrenamiento[]}
        renderItem={renderWorkoutItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </SafeAreaView>
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
  content: { padding: 18, paddingBottom: 40 },
  headerSection: { gap: 18, marginBottom: 18 },
  headingText: { color: c.ink, fontSize: 19, fontWeight: '800' },
  hint: { color: c.muted, fontSize: 12 },
  listHeading: { marginTop: 4 },
  historyIntro: { backgroundColor: c.ink, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  count: { color: c.lime, fontSize: 44, fontWeight: '900' },
  historyLabel: { color: c.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.8 },
  historySub: { color: '#aab6ad', marginTop: 4, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 45, gap: 10 },
  emptyTitle: { color: c.ink, fontSize: 18, fontWeight: '800' },
  emptyText: { color: c.muted, textAlign: 'center', fontSize: 13 },
});

const weeklyStyles = StyleSheet.create({
  section: { gap: 10 },
  card: { backgroundColor: c.white, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 15, gap: 7 },
  title: { color: c.ink, fontSize: 14, fontWeight: '900' },
  range: { color: c.muted, fontSize: 12, fontWeight: '700' },
  days: { color: c.green, fontSize: 13, fontWeight: '800' },
  dates: { color: c.muted, fontSize: 12, lineHeight: 18 },
});
