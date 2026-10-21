import { Activity, Dumbbell, Trash2 } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { c } from '../../theme';
import type { SesionEntrenamiento, WorkoutDetails } from '../../../types';

export interface WorkoutHistoryCardProps {
  workout: SesionEntrenamiento;
  expanded: boolean;
  details: WorkoutDetails | null;
  loadingDetails: boolean;
  onToggle: (workoutId: string) => void;
  onDelete: (workoutId: string) => void;
}

function WorkoutHistoryCardBase({
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
          onPress={() => onToggle(workout.id)}
        >
          <Text style={styles.date}>{workout.fecha}</Text>
          <Text style={styles.meta}>
            {workout.tipoSemana === 'carga' ? 'Semana de carga' : 'Semana de descarga'} ·{' '}
            {Math.floor(workout.duracionSegundos / 60)} min
          </Text>
          <Text style={styles.meta}>Semana del año: {workout.cycleWeek ?? 1}</Text>
          {workout.notas ? <Text style={styles.meta}>Notas: {workout.notas}</Text> : null}
          <Text style={detailStyles.toggleLabel}>{expanded ? 'Ocultar detalles' : 'Ver ejercicios y cardio'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eliminar sesión"
          onPress={() => onDelete(workout.id)}
        >
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
                <View
                  style={detailStyles.entry}
                  key={`${set.exerciseId ?? set.exerciseName}-${set.setNumber}-${index}`}
                >
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

export const WorkoutHistoryCard = memo(WorkoutHistoryCardBase);

const styles = StyleSheet.create({
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { color: c.ink, fontSize: 16, fontWeight: '800' },
  meta: { color: c.muted, fontSize: 12, marginTop: 4 },
  emptyText: { color: c.muted, textAlign: 'center', fontSize: 13 },
});

const detailStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  toggle: { flex: 1, gap: 4 },
  toggleLabel: { color: c.green, fontSize: 12, fontWeight: '800', marginTop: 3 },
  body: { borderTopWidth: 1, borderTopColor: c.line, marginTop: 14, paddingTop: 12, gap: 12 },
  entry: { gap: 4 },
  exerciseName: { color: c.ink, fontSize: 13, fontWeight: '700' },
  detailText: { color: c.muted, fontSize: 12, marginLeft: 22 },
});
