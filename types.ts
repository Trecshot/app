import type { CardioBlock, MuscleGroup } from './types/workout';
export * from './types/workout';

export type WeekType = 'carga' | 'descarga';

/** Periodo cronológico fijo de 7 días, independiente del número de sesiones realizadas. */
export interface TrainingBlock {
  id: string;
  type: WeekType;
  /** ISO 8601 (inclusive). */
  startDate: string;
  /** ISO 8601 (exclusive): startDate + 7 días. */
  endDate: string;
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
}