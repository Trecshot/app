export type WeekType = 'carga' | 'descarga';

export interface Workout {
  id?: number;
  clientId?: string;
  date: string;
  weekType: WeekType;
  cycleWeek: number;
  notes?: string;
  durationSeconds?: number;
}

export interface ExerciseLog {
  id?: number;
  workoutId: number;
  exerciseId?: string;
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
}

export interface WeeklySummary {
  weekYear: number;
  cycleWeek: number;
  weekType: WeekType;
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
  nombre: string;
  grupoMuscular?: string;
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
  ejercicios: Ejercicio[];
  cardio: Cardio | null;
}