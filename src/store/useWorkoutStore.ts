import { create } from 'zustand';

// Estructura de una serie
export interface WorkoutSet {
  id: string;
  reps: string;
  weight: string;
  isCompleted: boolean;
}

// Estructura de un ejercicio
export interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: WorkoutSet[];
}

interface WorkoutStore {
  exercises: WorkoutExercise[];
  addExercise: () => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
}

// Generador de IDs únicos cortos
const generateId = () => Math.random().toString(36).substring(2, 9);

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  exercises: [],
  
  addExercise: () => set((state) => ({
    exercises: [
      ...state.exercises,
      {
        id: generateId(),
        name: 'Nuevo Ejercicio', // Más adelante conectaremos esto a una base de datos de ejercicios
        muscleGroup: 'General',
        sets: [{ id: generateId(), reps: '', weight: '', isCompleted: false }]
      }
    ]
  })),

  removeExercise: (exerciseId) => set((state) => ({
    exercises: state.exercises.filter(ex => ex.id !== exerciseId)
  })),

  addSet: (exerciseId) => set((state) => ({
    exercises: state.exercises.map(ex => {
      if (ex.id === exerciseId) {
        // Copiar inteligentemente el peso y reps de la última serie registrada
        const lastSet = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, { 
            id: generateId(), 
            reps: lastSet ? lastSet.reps : '', 
            weight: lastSet ? lastSet.weight : '', 
            isCompleted: false 
          }]
        };
      }
      return ex;
    })
  })),

  removeSet: (exerciseId, setId) => set((state) => ({
    exercises: state.exercises.map(ex => 
      ex.id === exerciseId 
        ? { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
        : ex
    )
  })),

  updateSet: (exerciseId, setId, field, value) => set((state) => ({
    exercises: state.exercises.map(ex => 
      ex.id === exerciseId 
        ? {
            ...ex,
            sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
          }
        : ex
    )
  })),

  toggleSetComplete: (exerciseId, setId) => set((state) => ({
    exercises: state.exercises.map(ex => 
      ex.id === exerciseId 
        ? {
            ...ex,
            sets: ex.sets.map(s => s.id === setId ? { ...s, isCompleted: !s.isCompleted } : s)
          }
        : ex
    )
  }))
}));
