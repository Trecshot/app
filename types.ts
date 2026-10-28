import type { CardioBlock, MuscleGroup } from './types/workout';
export * from './types/workout';

export type WeekType = 'carga' | 'descarga';

/** Bloque de entrenamiento contabilizado por 7 sesiones efectivas completadas. */
export interface TrainingBlock {
  id: string;
  type: WeekType;
  /** ISO 8601: fecha exacta de inicio de la Sesión 1/7. */
  startDate: string;
  /** ISO 8601 referencial de cierre del bloque. */
  endDate: string;
  /** Sesiones efectivas completadas dentro del bloque (0 a 7). */
  sessionCount?: number;
  /** Meta de sesiones efectivas del bloque (por defecto 7). */
  targetSessions?: number;
}

export interface Workout {
  id?: number;
  clientId?: string;
  date: string;
  weekType: WeekType;
  cycleWeek: number;
  notes?: string;
  durationSeconds?: number;
  sessionFocus?: MuscleGroup[];
  blockId?: string;
  prs?: number;
}

export interface ExerciseLog {
  id?: number;
  workoutId: number;
  exerciseId?: string;
  catalogExerciseId?: string;
  exerciseOrder?: number;
  setId?: string;
  exerciseName: string;
  muscleGroup: string;
  setNumber: number;
  reps: number;
  weight: number;
  isPr?: boolean;
}

export interface CardioLog {
  id?: number;
  workoutId: number;
  cardioType: string;
  level?: number;
  distanceKm?: number;
  durationMinutes: number;
}

export interface WorkoutDetails {
  exercises: ExerciseLog[];
  cardio: CardioLog[];
  cardioBlocks?: CardioBlock[];
}

export interface WeeklySummary {
  weekYear: number;
  cycleWeek: number;
  weekType: WeekType;
  weekStart: string;
  weekEnd: string;
  trainingDays: number;
  dates: string;
}

export interface Serie {
  id: string;
  reps: number;
  pesoKg: number;
  isPr?: boolean;
}

export interface Ejercicio {
  id: string;
  catalogExerciseId?: string;
  nombre: string;
  grupoMuscular?: string;
  selectedMuscleGroup?: MuscleGroup;
  series: Serie[];
}

export interface Cardio {
  realizado: boolean;
  modalidad: 'Trotar' | 'Caminar' | 'Bicicleta' | 'Cuerda' | 'Otro';
  tiempoMin: number;
  velocidadNivel?: number;
  distanciaKm?: number;
}

export interface SesionEntrenamiento {
  id: string;
  fecha: string;
  notas?: string;
  duracionSegundos: number;
  tipoSemana: 'carga' | 'descarga';
  cycleWeek: number;
  sessionFocus?: MuscleGroup[];
  ejercicios: Ejercicio[];
  cardio: Cardio | null;
  cardioBlocks?: CardioBlock[];
  blockId?: string;
  block?: TrainingBlock;
  prs?: number;
}