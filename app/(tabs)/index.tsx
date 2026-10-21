import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { TimerDisplay } from '../../src/components/workout/TimerDisplay';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';

export default function ActiveWorkoutScreen() {
  return (
    <View style={GLOBAL_STYLES.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <ChevronDown color={COLORS.textPrimary} size={28} />
        </TouchableOpacity>
        
        {/* Aquí va tu cronómetro aislado de 1Hz */}
        <TimerDisplay /> 
        
        <TouchableOpacity style={styles.finishButton}>
          <Text style={styles.finishButtonText}>Finalizar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tarjetas de ejercicios de prueba */}
        <ExerciseCard exerciseName="Sentadilla Hack" />
        <ExerciseCard exerciseName="Press de Banca Inclinado" />
        
        <TouchableOpacity style={styles.addExerciseButton}>
          <Text style={styles.addExerciseText}>+ Añadir Ejercicio</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: 50, // Ajustar según el padding nativo (SafeArea)
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  finishButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  finishButtonText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  addExerciseButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // Fondo azul translúcido
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  addExerciseText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 16,
  }
});
