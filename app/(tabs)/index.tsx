import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Settings, Maximize } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { TimerDisplay } from '../../src/components/workout/TimerDisplay';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { useWorkoutStore } from '../../src/store/useWorkoutStore';

export default function ActiveWorkoutScreen() {
  const { exercises, addExercise } = useWorkoutStore();

  return (
    <View style={GLOBAL_STYLES.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Superior */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.headerSubtitle}>MI ENTRENAMIENTO</Text>
            <Text style={styles.headerTitle}>Entrena con intención.</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}><Maximize size={20} color={COLORS.textPrimary}/></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}><Settings size={20} color={COLORS.textPrimary}/></TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta Oscura del Cronómetro */}
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>• LISTO PARA EMPEZAR</Text>
          <View style={styles.timerCenter}>
            <Text style={styles.timerText}><TimerDisplay /></Text>
          </View>
          <TouchableOpacity style={styles.startButton}>
            <Text style={styles.startButtonText}>▶ Comenzar</Text>
          </TouchableOpacity>
        </View>

        {/* Componentes de la Rutina (Vinculados a Zustand) */}
        <Text style={styles.sectionTitle}>Ejercicios</Text>

        {exercises.length === 0 ? (
          <Text style={{ color: COLORS.textSecondary, marginBottom: SPACING.md, fontStyle: 'italic' }}>
            Tu rutina está vacía. Añade un ejercicio para empezar.
          </Text>
        ) : (
          exercises.map((exercise, index) => (
            <ExerciseCard 
              key={exercise.id}
              exerciseIndex={`0${index + 1}`.slice(-2)} 
              exercise={exercise} 
            />
          ))
        )}
        
        {/* Botón Funcional */}
        <TouchableOpacity style={styles.outlineButton} onPress={addExercise}>
          <Text style={styles.outlineButtonText}>⊕ Añadir ejercicio</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.solidButton, { backgroundColor: COLORS.primaryDark, marginTop: SPACING.xl }]}>
          <Text style={[styles.solidButtonText, { color: COLORS.textInverted }]}>Finalizar entrenamiento</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.md,
    paddingTop: 50,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
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
  headerIcons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconButton: {
    padding: 8,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 8,
  },
  timerCard: {
    backgroundColor: COLORS.timerSurface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  timerLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerCenter: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  timerText: {
    color: COLORS.textInverted,
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.timerSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  outlineButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  solidButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  solidButtonText: {
    fontWeight: '700',
    fontSize: 16,
  }
});
