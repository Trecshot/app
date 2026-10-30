import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SectionList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Dumbbell, ChevronDown } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { WorkoutHistoryCard, type WorkoutHistoryCardProps } from '../../src/components/workout/WorkoutHistoryCard';
import { useWorkoutHistory, type WorkoutBlockSection } from '../../src/hooks/useWorkoutHistory';
import type { SesionEntrenamiento } from '../../types';

// Mapear un registro de SQLite a las props de la tarjeta del historial
function toCardProps(session: SesionEntrenamiento): WorkoutHistoryCardProps & { id: string } {
  const totalMinutes = Math.floor(session.duracionSegundos / 60);
  const remainingSeconds = session.duracionSegundos % 60;
  const durationStr =
    totalMinutes > 0
      ? `${totalMinutes} min`
      : `${remainingSeconds} s`;

  const totalVolumeKg = session.ejercicios.reduce((accEx, ex) => {
    return (
      accEx +
      ex.series.reduce((accSet, s) => {
        const reps = Number(s.reps) || 0;
        const peso = Number(s.pesoKg) || 0;
        return reps > 0 && peso >= 0 ? accSet + reps * peso : accSet;
      }, 0)
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

  const cardioData = session.cardioBlocks && session.cardioBlocks.length > 0
    ? session.cardioBlocks
    : session.cardio
    ? [
        {
          id: 'legacy-cardio',
          type: (session.cardio.modalidad === 'Trotar'
            ? 'Trote'
            : session.cardio.modalidad === 'Cuerda'
            ? 'Salto en cuerda'
            : 'Trote') as any,
          minutos: session.cardio.tiempoMin,
          kilometros: session.cardio.distanciaKm,
          velocidad: session.cardio.velocidadNivel,
        },
      ]
    : [];

  const totalPrs =
    session.tipoSemana === 'carga'
      ? session.ejercicios.reduce(
          (acc, ex) =>
            acc +
            ex.series.filter(
              (s) =>
                (s.setType ?? 'NORMAL') === 'NORMAL' &&
                Boolean(s.isPr) &&
                s.reps >= 1 &&
                s.reps <= 5 &&
                s.pesoKg > 0,
            ).length,
          0,
        )
      : 0;

  return {
    id: session.id,
    title: titleStr,
    focus: focusStr,
    date: session.fecha,
    duration: durationStr,
    volume: `${Math.round(totalVolumeKg)} kg`,
    prs: totalPrs,
    exercises: exercisesSummary,
    detailedExercises: session.ejercicios,
    notes: session.notas,
    cardio: cardioData,
  };
}

export default function HistoryScreen() {
  const { sections, loading, refreshHistory, deleteWorkout } = useWorkoutHistory();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Actualizar el historial cada vez que la pantalla gana el foco
  useFocusEffect(
    useCallback(() => {
      void refreshHistory();
    }, [refreshHistory]),
  );

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

  const renderSectionHeader = ({ section }: { section: WorkoutBlockSection }) => {
    const isCarga = section.block?.type === 'carga';
    const isCollapsed = collapsedSections[section.key] ?? false;

    return (
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(section.key)}
        activeOpacity={0.8}
      >
        <View style={[styles.sectionAccent, { backgroundColor: isCarga ? COLORS.primary : COLORS.primaryDark }]} />
        <Text style={styles.sectionTitle} numberOfLines={1}>{section.title}</Text>
        <Text style={styles.sectionCount}>
          {section.sessionCount} {section.sessionCount === 1 ? 'sesión' : 'sesiones'}
        </Text>
        {/* Icono de flecha para indicar que es desplegable */}
        <ChevronDown
          size={18}
          color={COLORS.textSecondary}
          style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }], marginLeft: 4 }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={GLOBAL_STYLES.container}>
      {/* Header Superior */}
      <View style={styles.topHeader}>
        <Text style={styles.headerSubtitle}>TUS REGISTROS</Text>
        <Text style={styles.headerTitle}>Historial</Text>
      </View>

      {/* Lista agrupada por bloques de 7 días */}
      <View style={styles.listContainer}>
        {loading && sections.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primaryDark} />
        ) : (
          <SectionList<SesionEntrenamiento, WorkoutBlockSection>
            sections={sections.map((sec) => ({
              ...sec,
              data: collapsedSections[sec.key] ? [] : sec.data, // Oculta las tarjetas si está contraído
            }))}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <WorkoutHistoryCard {...toCardProps(item)} onDelete={() => deleteWorkout(item.id)} />
            )}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
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
    paddingBottom: 100,
    paddingTop: SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCount: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
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
