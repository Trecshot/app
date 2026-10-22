import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { Settings, Maximize, RotateCcw } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { TimerDisplay } from '../../src/components/workout/TimerDisplay';
import { ExerciseCard } from '../../src/components/workout/ExerciseCard';
import { useWorkoutStore } from '../../src/store/useWorkoutStore';
import { useSessionStore } from '../../src/store/useSessionStore';
import { WorkoutRepository } from '../../src/db/repositories/WorkoutRepository';
import { clearDraft } from '../../src/storage/workoutDraft';
import type { Ejercicio, SesionEntrenamiento } from '../../types';

export default function ActiveWorkoutScreen() {
  const { exercises, addExercise, resetWorkout } = useWorkoutStore();
  const {
    isActive,
    isRunning,
    toggleSession,
    endSession,
    getElapsedSeconds,
    startTimestamp,
  } = useSessionStore();

  const [isSaving, setIsSaving] = useState(false);

  const timerStatus = isRunning
    ? '• ENTRENAMIENTO EN CURSO'
    : isActive
    ? '• SESIÓN PAUSADA'
    : '• LISTO PARA EMPEZAR';

  const timerButtonText = isRunning
    ? '⏸ Pausar'
    : isActive
    ? '▶ Reanudar'
    : '▶ Comenzar';

  const handleResetTimer = () => {
    Alert.alert(
      'Reiniciar cronómetro',
      '¿Deseas reiniciar el tiempo del entrenamiento a cero?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', style: 'destructive', onPress: endSession },
      ],
    );
  };

  const handleFinishWorkout = () => {
    if (exercises.length === 0) {
      Alert.alert(
        'Rutina vacía',
        'Añade al menos un ejercicio antes de finalizar el entrenamiento.',
      );
      return;
    }

    Alert.alert(
      'Finalizar entrenamiento',
      '¿Deseas guardar la sesión y finalizar el entrenamiento?',
      [
        { text: 'Continuar entrenando', style: 'cancel' },
        {
          text: 'Finalizar y guardar',
          onPress: async () => {
            try {
              setIsSaving(true);
              const elapsedSeconds = getElapsedSeconds();
              const now = new Date();
              const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

              // Mapear y validar ejercicios
              const validExercises: Ejercicio[] = exercises
                .filter((ex) => ex.name.trim().length > 0)
                .map((ex) => ({
                  id: ex.id,
                  nombre: ex.name.trim(),
                  grupoMuscular: ex.muscleGroup || 'General',
                  series: ex.sets.map((s) => ({
                    id: s.id,
                    reps: parseInt(s.reps, 10) || 0,
                    pesoKg: parseFloat(s.weight) || 0,
                  })),
                }));

              if (validExercises.length === 0) {
                Alert.alert(
                  'Sin ejercicios válidos',
                  'Asegúrate de que al menos un ejercicio tenga nombre.',
                );
                setIsSaving(false);
                return;
              }

              const session: SesionEntrenamiento = {
                id: Crypto.randomUUID(),
                fecha: todayDate,
                duracionSegundos: elapsedSeconds,
                tipoSemana: 'carga',
                cycleWeek: WorkoutRepository.getIsoWeekNumber(todayDate),
                ejercicios: validExercises,
                cardio: null,
              };

              await WorkoutRepository.saveSession(session, startTimestamp);
              await clearDraft();

              // Reiniciar estados globales
              endSession();
              resetWorkout();

              Alert.alert(
                '¡Excelente trabajo! 🎉',
                'Tu entrenamiento se guardó correctamente y ya está disponible en el Historial.',
              );
            } catch (error) {
              console.error('Error al guardar sesión:', error);
              Alert.alert(
                'Error al guardar',
                'Ocurrió un problema al persistir el entrenamiento en la base de datos local. Por favor inténtalo de nuevo.',
              );
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

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
            <TouchableOpacity style={styles.iconButton}>
              <Maximize size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Settings size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta Oscura del Cronómetro */}
        <View style={styles.timerCard}>
          <View style={styles.timerHeaderRow}>
            <Text style={styles.timerLabel}>{timerStatus}</Text>
            {isActive && (
              <TouchableOpacity
                onPress={handleResetTimer}
                style={styles.resetIconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RotateCcw size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.timerCenter}>
            <TimerDisplay />
          </View>

          <TouchableOpacity
            style={[
              styles.startButton,
              isRunning && { backgroundColor: COLORS.primaryDark },
            ]}
            onPress={toggleSession}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.startButtonText,
                isRunning && { color: COLORS.textInverted },
              ]}
            >
              {timerButtonText}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Componentes de la Rutina (Vinculados a Zustand) */}
        <Text style={styles.sectionTitle}>Ejercicios</Text>

        {exercises.length === 0 ? (
          <Text
            style={{
              color: COLORS.textSecondary,
              marginBottom: SPACING.md,
              fontStyle: 'italic',
            }}
          >
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

        {/* Botón Añadir Ejercicio */}
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={addExercise}
          activeOpacity={0.7}
        >
          <Text style={styles.outlineButtonText}>⊕ Añadir ejercicio</Text>
        </TouchableOpacity>

        {/* Botón Finalizar Entrenamiento */}
        <TouchableOpacity
          style={[
            styles.solidButton,
            { backgroundColor: COLORS.primaryDark, marginTop: SPACING.xl },
            isSaving && { opacity: 0.7 },
          ]}
          onPress={handleFinishWorkout}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.textInverted} />
          ) : (
            <Text style={[styles.solidButtonText, { color: COLORS.textInverted }]}>
              Finalizar entrenamiento
            </Text>
          )}
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
  timerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  resetIconButton: {
    padding: 4,
  },
  timerCenter: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
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
  },
});
