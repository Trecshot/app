// types/workout.ts

// 1. Definición estricta de grupos musculares
export type MuscleGroup = 'Pecho' | 'Espalda' | 'Hombros' | 'Piernas' | 'Brazos' | 'Core';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Pecho',
  'Espalda',
  'Hombros',
  'Piernas',
  'Brazos',
  'Core',
];

// 2. Interfaz del catálogo de ejercicios
export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
}

// 3. Catálogo predefinido (Inyectado en SQLite al iniciar la app)
export const EXERCISE_CATALOG: CatalogExercise[] = [
  // --- PECHO ---
  { id: 'p1', name: 'Press Banca Plano', muscleGroup: 'Pecho' },
  { id: 'p2', name: 'Press Inclinado con Mancuernas', muscleGroup: 'Pecho' },
  { id: 'p3', name: 'Aperturas en Máquina (Pec Deck)', muscleGroup: 'Pecho' },
  { id: 'p4', name: 'Press Inclinado con Barra', muscleGroup: 'Pecho' },
  { id: 'p5', name: 'Fondos en Paralelas (Pecho)', muscleGroup: 'Pecho' },
  { id: 'p6', name: 'Cruces en Polea (Crossover)', muscleGroup: 'Pecho' },
  { id: 'p7', name: 'Press Declinado con Mancuernas', muscleGroup: 'Pecho' },
  { id: 'p8', name: 'Flexiones (Push-ups)', muscleGroup: 'Pecho' },
  { id: 'chest_fly_dumbbell', name: 'Aperturas con Mancuernas (Plano/Inclinado)', muscleGroup: 'Pecho' },
  { id: 'chest_cable_crossover_low', name: 'Cruces en Polea Baja (Hacia arriba)', muscleGroup: 'Pecho' },
  { id: 'chest_cable_crossover_high', name: 'Cruces en Polea Alta (Hacia abajo)', muscleGroup: 'Pecho' },
  { id: 'chest_machine_press', name: 'Press de Pecho en Máquina', muscleGroup: 'Pecho' },
  { id: 'chest_dumbbell_pullover', name: 'Pullover con Mancuerna', muscleGroup: 'Pecho' },

  // --- HOMBROS ---
  { id: 'h1', name: 'Press Militar con Barra', muscleGroup: 'Hombros' },
  { id: 'h2', name: 'Elevaciones Laterales', muscleGroup: 'Hombros' },
  { id: 'h3', name: 'Press Arnold', muscleGroup: 'Hombros' },
  { id: 'h4', name: 'Pájaros / Elevaciones Posteriores', muscleGroup: 'Hombros' },
  { id: 'h5', name: 'Face Pulls en Polea', muscleGroup: 'Hombros' },
  { id: 'h6', name: 'Elevaciones Frontales con Mancuerna', muscleGroup: 'Hombros' },
  { id: 'h7', name: 'Remo al Mentón (Upright Row)', muscleGroup: 'Hombros' },
  { id: 'shoulder_cable_lateral_raise', name: 'Elevaciones Laterales en Polea', muscleGroup: 'Hombros' },
  { id: 'shoulder_cable_rear_delt', name: 'Pájaros (Delt. Posterior) en Polea', muscleGroup: 'Hombros' },

  // --- ESPALDA ---
  { id: 'e1', name: 'Dominadas (Pull-ups)', muscleGroup: 'Espalda' },
  { id: 'e2', name: 'Jalón al Pecho en Polea', muscleGroup: 'Espalda' },
  { id: 'e3', name: 'Remo con Barra', muscleGroup: 'Espalda' },
  { id: 'e4', name: 'Remo Gironda (Polea Baja)', muscleGroup: 'Espalda' },
  { id: 'e5', name: 'Remo Unilateral con Mancuerna', muscleGroup: 'Espalda' },
  { id: 'e6', name: 'Peso Muerto Convencional', muscleGroup: 'Espalda' },
  { id: 'e7', name: 'Pullover en Polea Alta', muscleGroup: 'Espalda' },
  { id: 'e8', name: 'Encogimientos de Trapecio', muscleGroup: 'Espalda' },
  { id: 'back_machine_row', name: 'Remo en Máquina Convergente', muscleGroup: 'Espalda' },
  { id: 'back_tbar_row', name: 'Remo en Barra T (Máquina/Barra)', muscleGroup: 'Espalda' },
  { id: 'back_straight_arm_pulldown', name: 'Pull-down con Brazos Rígidos en Polea', muscleGroup: 'Espalda' },
  { id: 'back_machine_pulldown', name: 'Jalón al Pecho en Máquina', muscleGroup: 'Espalda' },

  // --- PIERNAS ---
  { id: 'pi1', name: 'Sentadilla Trasera con Barra', muscleGroup: 'Piernas' },
  { id: 'pi2', name: 'Prensa Inclinada (Leg Press)', muscleGroup: 'Piernas' },
  { id: 'pi3', name: 'Extensiones de Cuádriceps', muscleGroup: 'Piernas' },
  { id: 'pi4', name: 'Curl Femoral Tumbado/Sentado', muscleGroup: 'Piernas' },
  { id: 'pi5', name: 'Zancadas con Mancuernas', muscleGroup: 'Piernas' },
  { id: 'pi6', name: 'Peso Muerto Rumano', muscleGroup: 'Piernas' },
  { id: 'pi7', name: 'Elevación de Talones (Gemelos)', muscleGroup: 'Piernas' },
  { id: 'pi8', name: 'Hip Thrust con Barra', muscleGroup: 'Piernas' },
  { id: 'legs_hack_squat', name: 'Sentadilla Hack en Máquina', muscleGroup: 'Piernas' },
  { id: 'legs_smith_machine_squat', name: 'Sentadilla en Máquina Smith', muscleGroup: 'Piernas' },
  { id: 'legs_machine_abductor', name: 'Abductores en Máquina', muscleGroup: 'Piernas' },
  { id: 'legs_machine_adductor', name: 'Aductores en Máquina', muscleGroup: 'Piernas' },
  { id: 'legs_barbell_front_squat', name: 'Sentadilla Frontal con Barra', muscleGroup: 'Piernas' },
  { id: 'legs_cable_glute_kickback', name: 'Patada de Glúteo en Polea Baja', muscleGroup: 'Piernas' },

  // --- BRAZOS ---
  { id: 'b1', name: 'Curl de Bíceps con Barra Z', muscleGroup: 'Brazos' },
  { id: 'b2', name: 'Curl Martillo con Mancuernas', muscleGroup: 'Brazos' },
  { id: 'b3', name: 'Extensiones de Tríceps en Polea', muscleGroup: 'Brazos' },
  { id: 'b4', name: 'Press Francés con Barra', muscleGroup: 'Brazos' },
  { id: 'b5', name: 'Curl Concentrado con Mancuerna', muscleGroup: 'Brazos' },
  { id: 'b6', name: 'Fondos entre Bancos para Tríceps', muscleGroup: 'Brazos' },
  { id: 'arms_machine_preacher_curl', name: 'Curl de Bíceps en Máquina Scott', muscleGroup: 'Brazos' },
  { id: 'arms_cable_bicep_curl', name: 'Curl de Bíceps en Polea Baja', muscleGroup: 'Brazos' },
  { id: 'arms_machine_tricep_ext', name: 'Extensión de Tríceps en Máquina', muscleGroup: 'Brazos' },
  { id: 'arms_cable_overhead_tricep', name: 'Extensión de Tríceps sobre la cabeza en Polea', muscleGroup: 'Brazos' },

  // --- CORE ---
  { id: 'c1', name: 'Plancha Abdominal', muscleGroup: 'Core' },
  { id: 'c2', name: 'Elevaciones de Piernas Colgado', muscleGroup: 'Core' },
  { id: 'c3', name: 'Rueda Abdominal (Ab Wheel)', muscleGroup: 'Core' },
  { id: 'c4', name: 'Crunch en Polea Alta', muscleGroup: 'Core' },
  { id: 'c5', name: 'Russian Twist con Disco', muscleGroup: 'Core' },
  { id: 'core_plank_weighted', name: 'Plancha (Plank) con Lastre', muscleGroup: 'Core' },
];

// Estructura y tipificación de una serie
export type SetType = 'NORMAL' | 'DROP_SET' | 'WARMUP';

export interface WorkoutSet {
  id: string;
  weight: number | string;
  reps: number | string;
  isCompleted: boolean;
  setType: SetType; // Nuevo campo
  restSeconds?: number; // Tiempo de descanso configurado para esta serie (60 a 300s)
}

// 5. Bloque de ejercicio instanciado
export interface WorkoutExerciseBlock {
  id: string;
  catalogExerciseId: string; // Referencia al catálogo en lugar de string libre
  selectedMuscleGroup: MuscleGroup; // Estado temporal para el filtro de la UI
  sets: WorkoutSet[];
  name?: string; // Nombre resuelto o de respaldo para compatibilidad legacy
}

// 6. Bloques de Cardio Polimórficos
export type CardioType = 'Trote' | 'Caminar' | 'Salto en cuerda';

export interface CardioBlock {
  id: string;
  type: CardioType;
  minutos: number; // Requerido para todos
  // Opcionales dependiendo del tipo
  velocidad?: number; // Para Trote/Caminar
  kilometros?: number; // Para Trote/Caminar
  saltos?: number;    // Para Salto en cuerda
}

// 4. Modificación de la sesión de entrenamiento
export interface WorkoutSession {
  id: string;
  startTime: number;
  endTime?: number;
  sessionFocus: MuscleGroup[]; // Ej: ['Pecho', 'Hombros']
  exercises: WorkoutExerciseBlock[];
  cardio: CardioBlock[]; // Array opcional para soportar múltiples sesiones de cardio
}

// Utilidades del catálogo
export function getCatalogExerciseById(id: string): CatalogExercise | undefined {
  return EXERCISE_CATALOG.find((ex) => ex.id === id);
}

export function getCatalogExerciseName(id: string, fallbackName?: string): string {
  const found = getCatalogExerciseById(id);
  if (found) return found.name;
  return fallbackName && fallbackName.trim().length > 0 ? fallbackName : 'Ejercicio no identificado';
}

export function filterExercisesByGroup(muscleGroup: MuscleGroup | null): CatalogExercise[] {
  if (!muscleGroup) return [];
  return EXERCISE_CATALOG.filter((ex) => ex.muscleGroup === muscleGroup);
}
