import AsyncStorage from '@react-native-async-storage/async-storage';
import { Cardio, Ejercicio, WeekType } from '../../types';

const DRAFT_KEY = '@active_workout_draft';

/** Formulario en curso; se guarda en segundo plano para no perderlo si se cierra la app. */
export interface WorkoutDraft {
  week: WeekType;
  sessionDate: string;
  notes: string;
  exercises: Ejercicio[];
  cardio: Cardio | null;
}

const isDraft = (value: unknown): value is WorkoutDraft => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.week === 'carga' || v.week === 'descarga')
    && typeof v.sessionDate === 'string'
    && typeof v.notes === 'string'
    && Array.isArray(v.exercises) && v.exercises.length > 0
    && (v.cardio === null || typeof v.cardio === 'object');
};

export async function loadDraft(): Promise<WorkoutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isDraft(parsed) ? parsed : null;
  } catch (error) {
    console.error('Error al cargar el borrador del entrenamiento:', error);
    return null;
  }
}

export async function saveDraft(draft: WorkoutDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error('Error al guardar el borrador del entrenamiento:', error);
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error('Error al borrar el borrador del entrenamiento:', error);
  }
}
