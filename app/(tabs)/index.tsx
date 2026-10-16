import { Bike, CirclePlus, Dumbbell, Minus, Save, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getIsoWeekNumber, guardarSesion } from '../../database';
import { SessionTimerBanner, type SessionTimerHandle } from '../../src/components/SessionTimerBanner';
import { clearDraft, loadDraft, saveDraft, type WorkoutDraft } from '../../src/storage/workoutDraft';
import { c } from '../../src/theme';
import type { Cardio, Ejercicio, Serie, SesionEntrenamiento } from '../../types';

const modes: Cardio['modalidad'][] = ['Trotar', 'Caminar', 'Bicicleta', 'Cuerda', 'Otro'];
const DRAFT_SAVE_DELAY_MS = 400;
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const serie = (): Serie => ({ id: id(), reps: 10, pesoKg: 0 });
const ejercicio = (): Ejercicio => ({ id: id(), nombre: '', grupoMuscular: '', series: [serie()] });
const normalizarNumero = (txt: string) => parseFloat(txt.replace(',', '.')) || 0;
const fechaHoyLocal = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};
const esFechaValida = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export default function WorkoutScreen() {
  const timerRef = useRef<SessionTimerHandle>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [week, setWeek] = useState<'carga' | 'descarga'>('carga');
  const [sessionDate, setSessionDate] = useState(fechaHoyLocal);
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<Ejercicio[]>([ejercicio()]);
  const [cardio, setCardio] = useState<Cardio | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const handleSessionActiveChange = useCallback((active: boolean) => setSessionActive(active), []);

  // Restaurar el borrador del entrenamiento en curso
  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((draft) => {
      if (cancelled) return;
      if (draft) {
        setWeek(draft.week);
        setSessionDate(draft.sessionDate);
        setNotes(draft.notes);
        setExercises(draft.exercises);
        setCardio(draft.cardio);
      }
      setDraftHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Guardar el borrador en segundo plano con debounce y forzar al salir
  const latestDraftRef = useRef<WorkoutDraft | null>(null);
  useEffect(() => {
    if (!draftHydrated) return undefined;
    const draft: WorkoutDraft = { week, sessionDate, notes, exercises, cardio };
    latestDraftRef.current = draft;
    const handle = setTimeout(() => {
      void saveDraft(draft);
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(handle);
  }, [draftHydrated, week, sessionDate, notes, exercises, cardio]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && latestDraftRef.current) void saveDraft(latestDraftRef.current);
    });
    return () => subscription.remove();
  }, []);

  function selectWeek(value: 'carga' | 'descarga') {
    setWeek(value);
  }

  function updateExercise(exerciseId: string, name: string) {
    setExercises((items) => items.map((item) => (item.id === exerciseId ? { ...item, nombre: name } : item)));
  }

  function updateMuscleGroup(exerciseId: string, muscleGroup: string) {
    setExercises((items) => (items.map((item) => (item.id === exerciseId ? { ...item, grupoMuscular: muscleGroup } : item))));
  }

  function updateSet(exerciseId: string, setId: string, field: 'reps' | 'pesoKg', value: string) {
    const number = normalizarNumero(value);
    setExercises((items) =>
      items.map((item) =>
        item.id === exerciseId
          ? { ...item, series: item.series.map((set) => (set.id === setId ? { ...set, [field]: number } : set)) }
          : item,
      ),
    );
  }

  function addSet(exerciseId: string) {
    setExercises((items) => items.map((item) => (item.id === exerciseId ? { ...item, series: [...item.series, serie()] } : item)));
  }

  function removeSet(exerciseId: string, setId: string) {
    setExercises((items) =>
      items.map((item) =>
        item.id === exerciseId && item.series.length > 1
          ? { ...item, series: item.series.filter((set) => set.id !== setId) }
          : item,
      ),
    );
  }

  function removeExercise(exerciseId: string) {
    setExercises((items) => (items.length > 1 ? items.filter((item) => item.id !== exerciseId) : items));
  }

  async function finishWorkout() {
    if (!sessionActive) {
      Alert.alert('Sesión no iniciada', 'Pulsa Comenzar para iniciar el entrenamiento antes de finalizarlo.');
      return;
    }
    if (!esFechaValida(sessionDate)) {
      Alert.alert('Fecha no válida', 'Escribe la fecha con el formato AAAA-MM-DD.');
      return;
    }
    const validExercises = exercises.filter((item) => item.nombre.trim());
    if (!validExercises.length) {
      Alert.alert('Agrega un ejercicio', 'Escribe al menos un nombre antes de guardar.');
      return;
    }
    setLoading(true);
    const duracionSegundos = timerRef.current?.getElapsedSeconds() ?? 0;
    const workout: SesionEntrenamiento = {
      id: id(),
      fecha: sessionDate,
      ...(notes.trim() ? { notas: notes.trim() } : {}),
      duracionSegundos,
      tipoSemana: week,
      cycleWeek: getIsoWeekNumber(sessionDate),
      ejercicios: validExercises,
      cardio,
    };
    try {
      await guardarSesion(workout);
      await timerRef.current?.reset();
      await clearDraft();
      setNotes('');
      setExercises([ejercicio()]);
      setCardio(null);
      setSessionDate(fechaHoyLocal());
      Alert.alert('¡Entrenamiento finalizado!', 'La sesión se guardó correctamente.');
    } catch {
      Alert.alert('No se pudo guardar', 'Comprueba la base de datos local.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>MI ENTRENAMIENTO</Text>
            <Text style={styles.title}>Entrena con intención.</Text>
          </View>
          <View style={styles.logo}>
            <Dumbbell color={c.ink} size={22} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SessionTimerBanner ref={timerRef} onSessionActiveChange={handleSessionActiveChange} />

          <View style={styles.heading}>
            <Text style={styles.headingText}>Semana</Text>
            <Text style={styles.hint}>Planifica tu esfuerzo</Text>
          </View>
          <View style={styles.row}>
            <Pressable style={[styles.week, week === 'carga' && styles.weekLoad]} onPress={() => selectWeek('carga')}>
              <TrendingUp color={week === 'carga' ? c.ink : c.muted} size={18} />
              <Text style={styles.weekText}>Carga</Text>
            </Pressable>
            <Pressable style={[styles.week, week === 'descarga' && styles.weekDeload]} onPress={() => selectWeek('descarga')}>
              <TrendingDown color={week === 'descarga' ? c.ink : c.muted} size={18} />
              <Text style={styles.weekText}>Descarga</Text>
            </Pressable>
          </View>

          <View style={sessionInfoStyles.card}>
            <Text style={styles.label}>FECHA · AAAA-MM-DD</Text>
            <TextInput
              value={sessionDate}
              onChangeText={setSessionDate}
              placeholder="2026-10-02"
              keyboardType="numbers-and-punctuation"
              style={styles.input}
              accessibilityLabel="Fecha del entrenamiento"
            />
            <Text style={styles.label}>NOTAS (OPCIONAL)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Sensaciones, descanso o comentarios"
              multiline
              textAlignVertical="top"
              style={[styles.input, sessionInfoStyles.notes]}
              accessibilityLabel="Notas de la sesión"
            />
          </View>
          <Text style={styles.hint}>Semana del año: {esFechaValida(sessionDate) ? getIsoWeekNumber(sessionDate) : '—'}</Text>

          <View style={styles.heading}>
            <Text style={styles.headingText}>Ejercicios</Text>
            <Text style={styles.hint}>{exercises.length} movimientos</Text>
          </View>
          {exercises.map((item, index) => (
            <View style={styles.exercise} key={item.id}>
              <View style={styles.exerciseHead}>
                <Text style={styles.number}>0{index + 1}</Text>
                <TextInput
                  value={item.nombre}
                  onChangeText={(value) => updateExercise(item.id, value)}
                  placeholder="Nombre del ejercicio"
                  placeholderTextColor="#9aa59d"
                  style={styles.exerciseInput}
                />
                <Pressable accessibilityLabel="Eliminar ejercicio" onPress={() => removeExercise(item.id)}>
                  <X color={c.muted} size={19} />
                </Pressable>
              </View>
              <TextInput
                value={item.grupoMuscular ?? ''}
                onChangeText={(value) => updateMuscleGroup(item.id, value)}
                placeholder="Grupo muscular (p. ej. Pecho)"
                placeholderTextColor="#9aa59d"
                style={styles.input}
                accessibilityLabel={`Grupo muscular del ejercicio ${index + 1}`}
              />
              <View style={styles.tableHead}>
                <Text style={styles.tableLabel}>SERIE</Text>
                <Text style={styles.tableLabel}>REPS</Text>
                <Text style={styles.tableLabel}>PESO (KG)</Text>
                <View style={styles.endSpace} />
              </View>
              {item.series.map((set, setIndex) => (
                <View style={styles.setRow} key={set.id}>
                  <Text style={styles.setNumber}>{setIndex + 1}</Text>
                  <TextInput
                    value={String(set.reps)}
                    onChangeText={(value) => updateSet(item.id, set.id, 'reps', value)}
                    keyboardType="numeric"
                    style={styles.numberInput}
                  />
                  <TextInput
                    value={String(set.pesoKg)}
                    onChangeText={(value) => updateSet(item.id, set.id, 'pesoKg', value)}
                    keyboardType="decimal-pad"
                    style={styles.numberInput}
                  />
                  <Pressable accessibilityLabel="Eliminar serie" onPress={() => removeSet(item.id, set.id)}>
                    <Minus color={c.muted} size={17} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addSet} onPress={() => addSet(item.id)}>
                <CirclePlus color={c.green} size={17} />
                <Text style={styles.addSetText}>Añadir serie</Text>
              </Pressable>
            </View>
          ))}

          <Pressable style={styles.outline} onPress={() => setExercises((items) => [...items, ejercicio()])}>
            <CirclePlus color={c.ink} size={18} />
            <Text style={styles.outlineText}>Añadir ejercicio</Text>
          </Pressable>

          <View style={styles.cardio}>
            <View style={styles.cardioHead}>
              <View style={styles.live}>
                <Bike color={c.orange} size={20} />
                <Text style={styles.cardioTitle}>Cardio</Text>
              </View>
              <Switch
                value={cardio !== null}
                onValueChange={(enabled) =>
                  setCardio(enabled ? { realizado: true, modalidad: 'Trotar', tiempoMin: 20 } : null)
                }
                trackColor={{ false: '#d5ddd6', true: c.orange }}
                thumbColor={c.white}
              />
            </View>
            {cardio && (
              <View style={styles.cardioBody}>
                <Text style={styles.label}>MODALIDAD</Text>
                <View style={styles.chips}>
                  {modes.map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.chip, cardio.modalidad === mode && styles.chipActive]}
                      onPress={() => setCardio({ ...cardio, modalidad: mode })}
                    >
                      <Text style={styles.chipText}>{mode}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.row}>
                  <View style={styles.field}>
                    <Text style={styles.label}>MINUTOS</Text>
                    <TextInput
                      value={String(cardio.tiempoMin)}
                      onChangeText={(value) => setCardio({ ...cardio, tiempoMin: normalizarNumero(value) })}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>DISTANCIA KM</Text>
                    <TextInput
                      value={String(cardio.distanciaKm ?? 0)}
                      onChangeText={(value) => setCardio({ ...cardio, distanciaKm: normalizarNumero(value) })}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            style={[styles.save, styles.finish, (!sessionActive || loading) && styles.disabled]}
            disabled={!sessionActive || loading}
            onPress={finishWorkout}
          >
            <Save color={c.white} size={19} />
            <Text style={[styles.saveText, styles.finishText]}>{loading ? 'Guardando...' : 'Finalizar entrenamiento'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.paper },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: { color: c.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: c.ink, fontSize: 25, fontWeight: '800', marginTop: 5 },
  logo: { width: 44, height: 44, backgroundColor: c.lime, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 40, gap: 18 },
  row: { flexDirection: 'row', gap: 10 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headingText: { color: c.ink, fontSize: 19, fontWeight: '800' },
  hint: { color: c.muted, fontSize: 12 },
  week: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  weekLoad: { backgroundColor: c.lime, borderColor: c.lime },
  weekDeload: { backgroundColor: c.orange, borderColor: c.orange },
  weekText: { color: c.ink, fontWeight: '700' },
  exercise: { backgroundColor: c.white, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: c.line },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 13 },
  number: { color: c.green, fontSize: 12, fontWeight: '900' },
  exerciseInput: { flex: 1, color: c.ink, fontSize: 16, fontWeight: '800', padding: 0 },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2ee',
  },
  tableLabel: { color: c.muted, fontSize: 9, fontWeight: '800', flex: 1, textAlign: 'center' },
  endSpace: { width: 18 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  setNumber: { width: 20, color: c.muted, textAlign: 'center' },
  numberInput: {
    flex: 1,
    backgroundColor: c.paper,
    color: c.ink,
    borderRadius: 9,
    padding: 9,
    textAlign: 'center',
    fontWeight: '700',
  },
  addSet: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 7 },
  addSetText: { color: c.green, fontSize: 12, fontWeight: '800' },
  outline: {
    height: 48,
    borderWidth: 1,
    borderColor: c.ink,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineText: { color: c.ink, fontWeight: '800' },
  cardio: { backgroundColor: c.orangeSoft, borderRadius: 18, borderWidth: 1, borderColor: '#f9d7b4', overflow: 'hidden' },
  cardioHead: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardioTitle: { color: c.ink, fontWeight: '800', fontSize: 16 },
  cardioBody: { borderTopWidth: 1, borderTopColor: '#f9d7b4', padding: 16, gap: 12 },
  label: { color: c.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 9, backgroundColor: c.white, paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: c.orange },
  chipText: { color: c.muted, fontSize: 12, fontWeight: '700' },
  field: { flex: 1 },
  input: { backgroundColor: c.white, borderRadius: 10, color: c.ink, padding: 11, fontWeight: '700' },
  save: {
    height: 54,
    borderRadius: 16,
    backgroundColor: c.lime,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  saveText: { color: c.ink, fontWeight: '900', fontSize: 15 },
  finish: { backgroundColor: c.green },
  finishText: { color: c.white },
  disabled: { opacity: 0.6 },
});

const sessionInfoStyles = StyleSheet.create({
  card: { backgroundColor: c.white, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  notes: { minHeight: 88, paddingTop: 10 },
});
