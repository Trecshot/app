import { Bike, CirclePlus, Dumbbell, Minus, Save, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
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
import { getIsoWeekNumber } from '../../database';
import { SessionTimerBanner, type SessionTimerHandle } from '../../src/components/SessionTimerBanner';
import {
  createEmptyExercise,
  createEmptySet,
  useWorkoutSession,
} from '../../src/hooks/useWorkoutSession';
import { c } from '../../src/theme';
import type { Cardio } from '../../types';

const modes: Cardio['modalidad'][] = ['Trotar', 'Caminar', 'Bicicleta', 'Cuerda', 'Otro'];
const normalizarNumero = (txt: string) => parseFloat(txt.replace(',', '.')) || 0;

const esFechaValida = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export default function WorkoutScreen() {
  const timerRef = useRef<SessionTimerHandle>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const { state, dispatch, finishWorkout } = useWorkoutSession();
  const { week, sessionDate, notes, exercises, cardio } = state;

  const handleSessionActiveChange = useCallback((active: boolean) => {
    setSessionActive(active);
  }, []);

  async function handleFinishWorkout() {
    if (!sessionActive) {
      Alert.alert(
        'Sesión no iniciada',
        'Pulsa Comenzar para iniciar el entrenamiento antes de finalizarlo.',
      );
      return;
    }

    setLoading(true);
    const duracionSegundos = timerRef.current?.getElapsedSeconds() ?? 0;
    const success = await finishWorkout(duracionSegundos);
    if (success) {
      await timerRef.current?.reset();
    }
    setLoading(false);
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

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SessionTimerBanner ref={timerRef} onSessionActiveChange={handleSessionActiveChange} />

          <View style={styles.heading}>
            <Text style={styles.headingText}>Semana</Text>
            <Text style={styles.hint}>Planifica tu esfuerzo</Text>
          </View>
          <View style={styles.row}>
            <Pressable
              style={[styles.week, week === 'carga' && styles.weekLoad]}
              onPress={() => dispatch({ type: 'SET_METADATA', payload: { week: 'carga' } })}
            >
              <TrendingUp color={week === 'carga' ? c.ink : c.muted} size={18} />
              <Text style={styles.weekText}>Carga</Text>
            </Pressable>
            <Pressable
              style={[styles.week, week === 'descarga' && styles.weekDeload]}
              onPress={() => dispatch({ type: 'SET_METADATA', payload: { week: 'descarga' } })}
            >
              <TrendingDown color={week === 'descarga' ? c.ink : c.muted} size={18} />
              <Text style={styles.weekText}>Descarga</Text>
            </Pressable>
          </View>

          <View style={sessionInfoStyles.card}>
            <Text style={styles.label}>FECHA · AAAA-MM-DD</Text>
            <TextInput
              value={sessionDate}
              onChangeText={(text) => dispatch({ type: 'SET_METADATA', payload: { sessionDate: text } })}
              placeholder="2026-10-02"
              keyboardType="numbers-and-punctuation"
              style={styles.input}
              accessibilityLabel="Fecha del entrenamiento"
            />
            <Text style={styles.label}>NOTAS (OPCIONAL)</Text>
            <TextInput
              value={notes}
              onChangeText={(text) => dispatch({ type: 'SET_METADATA', payload: { notes: text } })}
              placeholder="Sensaciones, descanso o comentarios"
              multiline
              textAlignVertical="top"
              style={[styles.input, sessionInfoStyles.notes]}
              accessibilityLabel="Notas de la sesión"
            />
          </View>
          <Text style={styles.hint}>
            Semana del año: {esFechaValida(sessionDate) ? getIsoWeekNumber(sessionDate) : '—'}
          </Text>

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
                  onChangeText={(value) =>
                    dispatch({ type: 'UPDATE_EXERCISE', payload: { exerciseId: item.id, nombre: value } })
                  }
                  placeholder="Nombre del ejercicio"
                  placeholderTextColor="#9aa59d"
                  style={styles.exerciseInput}
                />
                <Pressable
                  accessibilityLabel="Eliminar ejercicio"
                  onPress={() => dispatch({ type: 'REMOVE_EXERCISE', payload: { exerciseId: item.id } })}
                >
                  <X color={c.muted} size={19} />
                </Pressable>
              </View>
              <TextInput
                value={item.grupoMuscular ?? ''}
                onChangeText={(value) =>
                  dispatch({ type: 'UPDATE_EXERCISE', payload: { exerciseId: item.id, grupoMuscular: value } })
                }
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
                    onChangeText={(value) =>
                      dispatch({
                        type: 'UPDATE_SET',
                        payload: {
                          exerciseId: item.id,
                          setId: set.id,
                          field: 'reps',
                          value: normalizarNumero(value),
                        },
                      })
                    }
                    keyboardType="numeric"
                    style={styles.numberInput}
                  />
                  <TextInput
                    value={String(set.pesoKg)}
                    onChangeText={(value) =>
                      dispatch({
                        type: 'UPDATE_SET',
                        payload: {
                          exerciseId: item.id,
                          setId: set.id,
                          field: 'pesoKg',
                          value: normalizarNumero(value),
                        },
                      })
                    }
                    keyboardType="decimal-pad"
                    style={styles.numberInput}
                  />
                  <Pressable
                    accessibilityLabel="Eliminar serie"
                    onPress={() =>
                      dispatch({
                        type: 'REMOVE_SET',
                        payload: { exerciseId: item.id, setId: set.id },
                      })
                    }
                  >
                    <Minus color={c.muted} size={17} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={styles.addSet}
                onPress={() =>
                  dispatch({
                    type: 'ADD_SET',
                    payload: { exerciseId: item.id, set: createEmptySet() },
                  })
                }
              >
                <CirclePlus color={c.green} size={17} />
                <Text style={styles.addSetText}>Añadir serie</Text>
              </Pressable>
            </View>
          ))}

          <Pressable
            style={styles.outline}
            onPress={() => dispatch({ type: 'ADD_EXERCISE', payload: createEmptyExercise() })}
          >
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
                  dispatch({
                    type: 'SET_CARDIO',
                    payload: enabled ? { realizado: true, modalidad: 'Trotar', tiempoMin: 20 } : null,
                  })
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
                      onPress={() =>
                        dispatch({
                          type: 'SET_CARDIO',
                          payload: { ...cardio, modalidad: mode },
                        })
                      }
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
                      onChangeText={(value) =>
                        dispatch({
                          type: 'SET_CARDIO',
                          payload: { ...cardio, tiempoMin: normalizarNumero(value) },
                        })
                      }
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>DISTANCIA KM</Text>
                    <TextInput
                      value={String(cardio.distanciaKm ?? 0)}
                      onChangeText={(value) =>
                        dispatch({
                          type: 'SET_CARDIO',
                          payload: { ...cardio, distanciaKm: normalizarNumero(value) },
                        })
                      }
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
            onPress={() => {
              void handleFinishWorkout();
            }}
          >
            <Save color={c.white} size={19} />
            <Text style={[styles.saveText, styles.finishText]}>
              {loading ? 'Guardando...' : 'Finalizar entrenamiento'}
            </Text>
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
