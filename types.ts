export interface Serie {
  id: string;
  reps: number;
  pesoKg: number;
}

export interface Ejercicio {
  id: string;
  nombre: string;
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
  duracionSegundos: number;
  tipoSemana: 'carga' | 'descarga';
  ejercicios: Ejercicio[];
  cardio: Cardio | null;
}