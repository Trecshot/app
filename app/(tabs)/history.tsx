import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Dumbbell } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { WorkoutHistoryCard } from '../../src/components/workout/WorkoutHistoryCard';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';

export default function HistoryScreen() {
  const { history, loading, refreshHistory } = useWorkoutHistory();

  // Actualizar el historial cada vez que la pantalla gana el foco
  useFocusEffect(
    useCallback(() => {
      void refreshHistory();
    }, [refreshHistory]),
  );

  // Mapear los registros de SQLite para las tarjetas del historial
  const historyData = history.map((session) => {
    const totalMinutes = Math.floor(session.duracionSegundos / 60);
    const remainingSeconds = session.duracionSegundos % 60;
    const durationStr =
      totalMinutes > 0
        ? `${totalMinutes} min`
        : `${remainingSeconds} s`;

    const totalVolumeKg = session.ejercicios.reduce((accEx, ex) => {
      return (
        accEx +
        ex.series.reduce((accSet, s) => accSet + (s.reps || 0) * (s.pesoKg || 0), 0)
      );
    }, 0);

    const titleStr =
      session.ejercicios.length > 0
        ? session.ejercicios.map((e) => e.nombre).filter(Boolean).join(', ')
        : 'Entrenamiento';

    const exercisesSummary = session.ejercicios.map(
      (e) => `${e.nombre || 'Ejercicio'} (${e.series.length} ${e.series.length === 1 ? 'serie' : 'series'})`,
    );

    const focusStr =
      session.sessionFocus && session.sessionFocus.length > 0
        ? session.sessionFocus.join(', ')
        : undefined;

    return {
      id: session.id,
      title: titleStr,
      focus: focusStr,
      date: session.fecha,
      duration: durationStr,
      volume: `${Math.round(totalVolumeKg)} kg`,
      prs: 0,
      exercises: exercisesSummary,
    };
  });

  // Componente visual que se muestra solo cuando no hay datos
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.iconCircle}>
        <Dumbbell size={40} color={COLORS.primaryDark} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>Aún no hay registros</Text>
      <Text style={styles.emptySubtitle}>
        Tus entrenamientos finalizados aparecerán aquí. ¡Ve a la pestaña &quot;Entrenar&quot; y completa tu primera sesión!
      </Text>
    </View>
  );

  return (
    <View style={GLOBAL_STYLES.container}>
      {/* Header Superior */}
      <View style={styles.topHeader}>
        <Text style={styles.headerSubtitle}>TUS REGISTROS</Text>
        <Text style={styles.headerTitle}>Historial</Text>
      </View>

      {/* Lista de alto rendimiento */}
      <View style={styles.listContainer}>
        {loading && historyData.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primaryDark} />
        ) : (
          <FlashList
            data={historyData}
            renderItem={({ item }) => <WorkoutHistoryCard {...item} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: 50,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.xs,
  },

  // Estilos específicos para el Estado Vacío
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
