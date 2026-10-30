import type { Ejercicio, Serie, SetType, WeekType, WorkoutExerciseBlock, WorkoutSet } from '../../types';

/**
 * Excluye explícitamente las series de calentamiento (WARMUP) y drop sets (DROP_SET)
 * antes de procesar el cálculo algorítmico del récord absoluto.
 */
export const calculateAbsolutePR = (sets: WorkoutSet[]): number => {
  const effectiveSets = sets.filter(
    (set) => (set.setType ?? 'NORMAL') === 'NORMAL' && set.isCompleted,
  );
  if (effectiveSets.length === 0) return 0;

  return Math.max(...effectiveSets.map((s) => toStrictRealWeight(s.weight)));
};

/**
 * Categoría de validación de una serie frente al historial de SQLite:
 * - `PR_ABSOLUTO`: Cumple simultáneamente:
 *   1) Semana de carga (`tipoSemana === 'carga'`).
 *   2) Rango de fuerza máxima de 1 a 5 repeticiones (`reps >= 1 && reps <= 5`).
 *   3) Supera estrictamente el `MAX(weight)` histórico del ejercicio (`pesoKg > maxHistorico`).
 * - `NORMATIVO`: Cualquier serie que no cumpla las 3 condiciones; se almacena como volumen normal.
 */
export type SetRecordCategory = 'PR_ABSOLUTO' | 'NORMATIVO';

export interface EvaluatedSetRecord extends Serie {
  isPr: boolean;
  category: SetRecordCategory;
  historicalMaxWeight: number;
}

export interface EvaluatedExerciseRecord extends Omit<Ejercicio, 'series'> {
  series: EvaluatedSetRecord[];
  historicalMaxWeight: number;
  sessionMaxWeight: number;
  achievedAbsolutePr: boolean;
}

export interface SessionPRValidationResult {
  totalPrs: number;
  exercises: EvaluatedExerciseRecord[];
  updatedMaxWeightsByCatalogId: Record<string, number>;
}

/**
 * Garantiza afinidad numérica entera (INTEGER) para repeticiones.
 */
export function toStrictIntegerReps(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.trunc(parsed);
}

/**
 * Garantiza afinidad numérica de punto flotante (REAL) para peso/carga (kg),
 * evitando comparaciones u ordenamientos alfabéticos en SQLite.
 */
export function toStrictRealWeight(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : parseFloat(String(value ?? '').replace(',', '.').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Clave de agrupación de ejercicio para consulta de récords:
 * prioriza `catalogExerciseId` y usa el nombre normalizado como respaldo.
 */
export function getExerciseRecordKey(
  catalogExerciseId?: string | null,
  exerciseName?: string | null,
): string {
  const trimmedId = catalogExerciseId?.trim();
  if (trimmedId) return trimmedId;
  const normName = exerciseName?.trim().toLowerCase();
  return normName ? `name:${normName}` : '';
}

/**
 * Evalúa si una serie individual cumple las 3 condiciones simultáneas de PR Absoluto.
 */
export function isSetAbsolutePR(
  tipoSemana: WeekType,
  reps: number,
  pesoKg: number,
  pesoMaximoHistoricoDelEjercicio: number,
  setType: SetType = 'NORMAL',
): boolean {
  if (setType !== 'NORMAL') return false;
  const cleanReps = toStrictIntegerReps(reps);
  const cleanWeight = toStrictRealWeight(pesoKg);
  const cleanHistoricalMax = toStrictRealWeight(pesoMaximoHistoricoDelEjercicio);

  const esSemanaCarga = tipoSemana === 'carga';
  const estaEnRangoReps = cleanReps >= 1 && cleanReps <= 5;
  const superaPesoMaximo = cleanWeight > 0 && cleanWeight > cleanHistoricalMax;

  const esPrAbsoluto = esSemanaCarga && estaEnRangoReps && superaPesoMaximo;
  return esPrAbsoluto;
}

/**
 * Motor de validación matemática de Récords Personales (PRs).
 *
 * Cumple rigurosamente las 3 condiciones simultáneas:
 * 1. `tipoSemana === 'carga'` (en semana de descarga nunca se activan PRs).
 * 2. `reps >= 1 && reps <= 5` (6 repeticiones o más se descartan automáticamente como PR).
 * 3. `pesoKg > pesoMaximoHistoricoDelEjercicio` (supera estrictamente el máximo histórico en SQLite).
 */
export function evaluateSessionPRs(
  exercises: readonly Ejercicio[],
  historicalMaxWeights: Readonly<Record<string, number>>,
  tipoSemana: WeekType = 'carga',
): SessionPRValidationResult {
  const runningMaxByKey: Record<string, number> = {};
  for (const [key, val] of Object.entries(historicalMaxWeights)) {
    runningMaxByKey[key] = toStrictRealWeight(val);
  }

  let totalPrs = 0;

  const evaluatedExercises: EvaluatedExerciseRecord[] = exercises.map((exercise) => {
    const recordKey = getExerciseRecordKey(exercise.catalogExerciseId, exercise.nombre);
    const pesoMaximoHistoricoDelEjercicio = recordKey
      ? toStrictRealWeight(runningMaxByKey[recordKey] ?? 0)
      : 0;

    let maxValidWeightInExercise = 0;
    let bestPrWeight = pesoMaximoHistoricoDelEjercicio;
    let peakPrSetIndex = -1;

    exercise.series.forEach((serie, idx) => {
      const setType: SetType = serie.setType ?? 'NORMAL';
      // Excluir explícitamente WARMUP y DROP_SET del cálculo de PR Absoluto
      if (setType !== 'NORMAL') {
        return;
      }

      const reps = toStrictIntegerReps(serie.reps);
      const pesoKg = toStrictRealWeight(serie.pesoKg);

      if (reps >= 1 && pesoKg > maxValidWeightInExercise) {
        maxValidWeightInExercise = pesoKg;
      }

      // Lógica de validación para una serie individual (3 condiciones simultáneas)
      const esSemanaCarga = tipoSemana === 'carga';
      const estaEnRangoReps = reps >= 1 && reps <= 5;
      const superaPesoMaximo = pesoKg > 0 && pesoKg > bestPrWeight;

      const esPrAbsoluto = esSemanaCarga && estaEnRangoReps && superaPesoMaximo;

      if (esPrAbsoluto) {
        bestPrWeight = pesoKg;
        peakPrSetIndex = idx;
      }
    });

    const achievedAbsolutePr = Boolean(recordKey) && peakPrSetIndex !== -1;

    if (achievedAbsolutePr) {
      totalPrs += 1;
    }

    // Actualizar el máximo histórico conocido del ejercicio para siguientes bloques de la misma sesión
    if (recordKey && maxValidWeightInExercise > (runningMaxByKey[recordKey] ?? 0)) {
      runningMaxByKey[recordKey] = maxValidWeightInExercise;
    }

    const evaluatedSets: EvaluatedSetRecord[] = exercise.series.map((serie, idx) => {
      const reps = toStrictIntegerReps(serie.reps);
      const pesoKg = toStrictRealWeight(serie.pesoKg);
      const setType: SetType = serie.setType ?? 'NORMAL';
      const isPr = setType === 'NORMAL' && achievedAbsolutePr && idx === peakPrSetIndex;

      return {
        id: serie.id,
        reps,
        pesoKg,
        setType,
        isPr,
        category: isPr ? 'PR_ABSOLUTO' : 'NORMATIVO',
        historicalMaxWeight: pesoMaximoHistoricoDelEjercicio,
      };
    });

    return {
      ...exercise,
      series: evaluatedSets,
      historicalMaxWeight: pesoMaximoHistoricoDelEjercicio,
      sessionMaxWeight: maxValidWeightInExercise,
      achievedAbsolutePr,
    };
  });

  return {
    totalPrs,
    exercises: evaluatedExercises,
    updatedMaxWeightsByCatalogId: runningMaxByKey,
  };
}

/**
 * Evalúa bloques de ejercicios de la UI activa (`WorkoutExerciseBlock[]`) frente al mapa histórico
 * de `MAX(weight)` considerando el `tipoSemana` actual.
 */
export function countPRsForActiveWorkoutBlocks(
  blocks: readonly WorkoutExerciseBlock[],
  historicalMaxWeights: Readonly<Record<string, number>>,
  tipoSemana: WeekType = 'carga',
): number {
  const mapped: Ejercicio[] = blocks.map((b) => ({
    id: b.id,
    catalogExerciseId: b.catalogExerciseId,
    nombre: b.name ?? '',
    grupoMuscular: b.selectedMuscleGroup,
    selectedMuscleGroup: b.selectedMuscleGroup,
    series: (b.sets ?? []).map((s) => ({
      id: s.id,
      reps: toStrictIntegerReps(s.reps),
      pesoKg: toStrictRealWeight(s.weight),
      setType: s.setType ?? 'NORMAL',
    })),
  }));

  return evaluateSessionPRs(mapped, historicalMaxWeights, tipoSemana).totalPrs;
}
