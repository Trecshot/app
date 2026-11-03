import type { Ejercicio, Serie, SetType, WeekType, WorkoutExerciseBlock, WorkoutSet } from '../../types';

export interface TrainingSet {
  id: string | number;
  weight: number;
  reps: number;
  type: SetType;
}

export interface PREvaluationResult {
  isPR: boolean;
  prSetId: string | number | null;
  prWeight: number | null;
}

/**
 * Evalúa si alguna serie dentro de un ejercicio califica como PR Absoluto en la sesión actual.
 *
 * Condiciones requeridas:
 * 1. Filtro de tipo: Únicamente series 'NORMAL'.
 * 2. Rango de repeticiones: Estrictamente entre 1 y 3 repeticiones (1 <= reps <= 3).
 * 3. Carga estrictamente mayor al récord histórico previo.
 * 4. Carga máxima de la sesión: Es el peso más alto entre las series normales del ejercicio.
 * 5. Criterio de Singularidad / Unicidad Absoluta: Solo puede haber exactamente 1 serie con
 *    ese peso máximo en la sesión. Si hay 2 o más series con el mismo kilaje (ej: 3x3 con 100 kg),
 *    se clasifica como bloque de volumen pesado y NO califica como PR individual.
 */
export function evaluateExercisePR(
  sets: TrainingSet[],
  previousRecordWeight: number = 0,
): PREvaluationResult {
  // 1. Filtrar únicamente series elegibles: tipo NORMAL, 1 a 3 reps y peso > 0
  const eligibleSets = sets.filter(
    (s) => s.type === 'NORMAL' && s.reps >= 1 && s.reps <= 3 && s.weight > 0,
  );

  if (eligibleSets.length === 0) {
    return { isPR: false, prSetId: null, prWeight: null };
  }

  // 2. Determinar el peso máximo dentro de las series elegibles de la sesión
  const maxSessionWeight = Math.max(...eligibleSets.map((s) => s.weight));

  // Verificar que ninguna otra serie NORMAL de la sesión haya superado este peso
  const normalSets = sets.filter((s) => s.type === 'NORMAL' && s.weight > 0);
  const maxNormalWeightInSession = Math.max(...normalSets.map((s) => s.weight));
  if (maxSessionWeight < maxNormalWeightInSession) {
    return { isPR: false, prSetId: null, prWeight: null };
  }

  // 3. Regla histórica: debe superar estrictamente la marca previa registrada en 1-3 reps
  if (maxSessionWeight <= previousRecordWeight) {
    return { isPR: false, prSetId: null, prWeight: null };
  }

  // 4. Regla de Unicidad Absoluta:
  // Contar cuántas series NORMAL en la sesión alcanzaron este peso máximo
  const setsAtMaxWeight = normalSets.filter((s) => s.weight === maxSessionWeight);

  // Si hay más de una serie con ese peso (ej: 3 series de 3 con 100 kg), no es PR individual
  if (setsAtMaxWeight.length > 1) {
    return { isPR: false, prSetId: null, prWeight: null };
  }

  // 5. Asignar la marca a la serie única ganadora
  const winningSet = setsAtMaxWeight[0];

  // Comprobar que la serie ganadora pertenezca al rango de 1 a 3 reps
  if (winningSet.reps < 1 || winningSet.reps > 3) {
    return { isPR: false, prSetId: null, prWeight: null };
  }

  return {
    isPR: true,
    prSetId: winningSet.id,
    prWeight: winningSet.weight,
  };
}

/**
 * Excluye explícitamente aproximaciones (APPROACH), calentamiento (WARMUP) y drop sets (DROP_SET)
 * antes de procesar el cálculo algorítmico del récord absoluto en el rango de 1 a 3 reps.
 */
export const calculateAbsolutePR = (sets: WorkoutSet[]): number => {
  const effectiveSets = sets.filter(
    (set) =>
      (set.setType ?? 'NORMAL') === 'NORMAL' &&
      set.isCompleted &&
      toStrictIntegerReps(set.reps) >= 1 &&
      toStrictIntegerReps(set.reps) <= 3,
  );
  if (effectiveSets.length === 0) return 0;

  return Math.max(...effectiveSets.map((s) => toStrictRealWeight(s.weight)));
};

/**
 * Categoría de validación de una serie frente al historial de SQLite:
 * - `PR_ABSOLUTO`: Cumple las condiciones de PR (Carga, 1-3 reps, > histórico, serie NORMAL única).
 * - `NORMATIVO`: Cualquier serie que no califique como PR; se almacena como volumen normal.
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
 * Evalúa si una serie individual cumple las condiciones de PR Absoluto (1 a 3 reps, tipo NORMAL).
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
  const estaEnRangoReps = cleanReps >= 1 && cleanReps <= 3;
  const superaPesoMaximo = cleanWeight > 0 && cleanWeight > cleanHistoricalMax;

  return esSemanaCarga && estaEnRangoReps && superaPesoMaximo;
}

/**
 * Motor de validación de Récords Personales (PRs) para una sesión completa.
 *
 * Aplica rigurosamente:
 * 1. Solo en semana de 'carga'.
 * 2. Solo series de tipo 'NORMAL'.
 * 3. Rango de repeticiones de 1 a 3 (1 <= reps <= 3).
 * 4. Supera estrictamente el máximo histórico previo en 1-3 reps.
 * 5. Criterio de Singularidad / Unicidad Absoluta (solo si la carga máxima no se repitió).
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

    // En semana de descarga no se activan PRs
    if (tipoSemana !== 'carga') {
      const evaluatedSets: EvaluatedSetRecord[] = exercise.series.map((serie) => ({
        id: serie.id,
        reps: toStrictIntegerReps(serie.reps),
        pesoKg: toStrictRealWeight(serie.pesoKg),
        setType: serie.setType ?? 'NORMAL',
        isPr: false,
        category: 'NORMATIVO',
        historicalMaxWeight: pesoMaximoHistoricoDelEjercicio,
      }));

      return {
        ...exercise,
        series: evaluatedSets,
        historicalMaxWeight: pesoMaximoHistoricoDelEjercicio,
        sessionMaxWeight: 0,
        achievedAbsolutePr: false,
      };
    }

    const trainingSets: TrainingSet[] = exercise.series.map((serie) => ({
      id: serie.id,
      reps: toStrictIntegerReps(serie.reps),
      weight: toStrictRealWeight(serie.pesoKg),
      type: serie.setType ?? 'NORMAL',
    }));

    const prResult = evaluateExercisePR(trainingSets, pesoMaximoHistoricoDelEjercicio);
    const achievedAbsolutePr = Boolean(recordKey) && prResult.isPR;

    if (achievedAbsolutePr && prResult.prWeight) {
      totalPrs += 1;
      if (recordKey && prResult.prWeight > (runningMaxByKey[recordKey] ?? 0)) {
        runningMaxByKey[recordKey] = prResult.prWeight;
      }
    }

    const maxValidWeightInExercise = Math.max(
      0,
      ...trainingSets
        .filter((s) => s.type === 'NORMAL' && s.reps >= 1 && s.reps <= 3)
        .map((s) => s.weight),
    );

    const evaluatedSets: EvaluatedSetRecord[] = exercise.series.map((serie) => {
      const reps = toStrictIntegerReps(serie.reps);
      const pesoKg = toStrictRealWeight(serie.pesoKg);
      const setType: SetType = serie.setType ?? 'NORMAL';
      const isPr = achievedAbsolutePr && String(serie.id) === String(prResult.prSetId);

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
