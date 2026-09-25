import { StatusBar } from 'expo-status-bar';
import { Activity, AlarmClock, Bike, CirclePlus, Dumbbell, History, Minus, Pause, Play, RotateCcw, Save, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { eliminarSesion, guardarSesion, obtenerSesiones } from './database';
import { Cardio, Ejercicio, SesionEntrenamiento, Serie } from './types';

type Tab = 'entrenar' | 'historial';
const modes: Cardio['modalidad'][] = ['Trotar', 'Caminar', 'Bicicleta', 'Cuerda', 'Otro'];
const c = { ink: '#18221d', muted: '#66736b', paper: '#f5f7f2', white: '#fff', line: '#dce5dc', lime: '#c7ef6b', green: '#58742c', orange: '#f5a15a', orangeSoft: '#fff0df', red: '#c9554e' };
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const serie = (): Serie => ({ id: id(), reps: 10, pesoKg: 0 });
const ejercicio = (): Ejercicio => ({ id: id(), nombre: '', series: [serie()] });
const normalizarNumero = (txt: string) => parseFloat(txt.replace(',', '.')) || 0;
const clock = (s: number) => `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export default function App() {
  const [tab, setTab] = useState<Tab>('entrenar');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [week, setWeek] = useState<'carga' | 'descarga'>('carga');
  const [exercises, setExercises] = useState<Ejercicio[]>([ejercicio()]);
  const [cardio, setCardio] = useState<Cardio | null>(null);
  const [history, setHistory] = useState<SesionEntrenamiento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => { void loadHistory(); }, []);
  async function loadHistory() {
    setLoading(true);
    try { setHistory(await obtenerSesiones()); }
    catch { Alert.alert('No se pudo abrir el historial', 'La base de datos local no respondió.'); }
    finally { setLoading(false); }
  }
  function selectWeek(value: 'carga' | 'descarga') {
    if (value === 'carga' && history[0]?.tipoSemana === 'carga') Alert.alert('Revisa la carga', 'Tu última sesión también fue de carga. Considera una semana de descarga si notas fatiga.');
    setWeek(value);
  }
  function updateExercise(exerciseId: string, name: string) { setExercises((items) => items.map((item) => item.id === exerciseId ? { ...item, nombre: name } : item)); }
  function updateSet(exerciseId: string, setId: string, field: 'reps' | 'pesoKg', value: string) {
    const number = normalizarNumero(value);
    setExercises((items) => items.map((item) => item.id === exerciseId ? { ...item, series: item.series.map((set) => set.id === setId ? { ...set, [field]: number } : set) } : item));
  }
  function addSet(exerciseId: string) { setExercises((items) => items.map((item) => item.id === exerciseId ? { ...item, series: [...item.series, serie()] } : item)); }
  function removeSet(exerciseId: string, setId: string) { setExercises((items) => items.map((item) => item.id === exerciseId && item.series.length > 1 ? { ...item, series: item.series.filter((set) => set.id !== setId) } : item)); }
  function removeExercise(exerciseId: string) { setExercises((items) => items.length > 1 ? items.filter((item) => item.id !== exerciseId) : items); }
  async function saveWorkout() {
    const validExercises = exercises.filter((item) => item.nombre.trim());
    if (!validExercises.length) { Alert.alert('Agrega un ejercicio', 'Escribe al menos un nombre antes de guardar.'); return; }
    setLoading(true);
    const workout: SesionEntrenamiento = { id: id(), fecha: new Date().toISOString().slice(0, 10), duracionSegundos: seconds, tipoSemana: week, ejercicios: validExercises, cardio };
    try { await guardarSesion(workout); setHistory((items) => [workout, ...items]); Alert.alert('Sesión guardada', 'Tu entrenamiento ya está en el historial.'); }
    catch { Alert.alert('No se pudo guardar', 'Comprueba la base de datos local.'); }
    finally { setLoading(false); }
  }
  async function deleteWorkout(workoutId: string) {
    try { await eliminarSesion(workoutId); setHistory((items) => items.filter((item) => item.id !== workoutId)); }
    catch { Alert.alert('No se pudo eliminar', 'Inténtalo de nuevo.'); }
  }
  function confirmDeleteWorkout(workoutId: string) {
    Alert.alert('Eliminar sesión', '¿Deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { void deleteWorkout(workoutId); } },
    ]);
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <View style={styles.header}><View><Text style={styles.kicker}>MI ENTRENAMIENTO</Text><Text style={styles.title}>{tab === 'entrenar' ? 'Entrena con intención.' : 'Tu constancia.'}</Text></View><View style={styles.logo}><Dumbbell color={c.ink} size={22} /></View></View>
    {tab === 'entrenar' ? <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.timerCard}><View style={styles.rowBetween}><View style={styles.live}><View style={[styles.dot, running && styles.dotOn]} /><Text style={styles.liveText}>{running ? 'EN CURSO' : 'LISTO PARA EMPEZAR'}</Text></View><AlarmClock color={c.lime} size={19} /></View><Text style={styles.timer}>{clock(seconds)}</Text><View style={styles.row}><Pressable style={styles.start} onPress={() => setRunning((value) => !value)}>{running ? <Pause color={c.ink} size={17} /> : <Play color={c.ink} size={17} />}<Text style={styles.startText}>{running ? 'Pausar' : 'Comenzar'}</Text></Pressable><Pressable accessibilityLabel="Reiniciar cronómetro" style={styles.reset} onPress={() => { setSeconds(0); setRunning(false); }}><RotateCcw color={c.white} size={18} /></Pressable></View></View>
      <View style={styles.heading}><Text style={styles.headingText}>Semana</Text><Text style={styles.hint}>Planifica tu esfuerzo</Text></View><View style={styles.row}><Pressable style={[styles.week, week === 'carga' && styles.weekLoad]} onPress={() => selectWeek('carga')}><TrendingUp color={week === 'carga' ? c.ink : c.muted} size={18} /><Text style={styles.weekText}>Carga</Text></Pressable><Pressable style={[styles.week, week === 'descarga' && styles.weekDeload]} onPress={() => selectWeek('descarga')}><TrendingDown color={week === 'descarga' ? c.ink : c.muted} size={18} /><Text style={styles.weekText}>Descarga</Text></Pressable></View>
      <View style={styles.heading}><Text style={styles.headingText}>Ejercicios</Text><Text style={styles.hint}>{exercises.length} movimientos</Text></View>
      {exercises.map((item, index) => <View style={styles.exercise} key={item.id}><View style={styles.exerciseHead}><Text style={styles.number}>0{index + 1}</Text><TextInput value={item.nombre} onChangeText={(value) => updateExercise(item.id, value)} placeholder="Nombre del ejercicio" placeholderTextColor="#9aa59d" style={styles.exerciseInput} /><Pressable accessibilityLabel="Eliminar ejercicio" onPress={() => removeExercise(item.id)}><X color={c.muted} size={19} /></Pressable></View><View style={styles.tableHead}><Text style={styles.tableLabel}>SERIE</Text><Text style={styles.tableLabel}>REPS</Text><Text style={styles.tableLabel}>PESO (KG)</Text><View style={styles.endSpace} /></View>{item.series.map((set, setIndex) => <View style={styles.setRow} key={set.id}><Text style={styles.setNumber}>{setIndex + 1}</Text><TextInput value={String(set.reps)} onChangeText={(value) => updateSet(item.id, set.id, 'reps', value)} keyboardType="numeric" style={styles.numberInput} /><TextInput value={String(set.pesoKg)} onChangeText={(value) => updateSet(item.id, set.id, 'pesoKg', value)} keyboardType="decimal-pad" style={styles.numberInput} /><Pressable accessibilityLabel="Eliminar serie" onPress={() => removeSet(item.id, set.id)}><Minus color={c.muted} size={17} /></Pressable></View>)}<Pressable style={styles.addSet} onPress={() => addSet(item.id)}><CirclePlus color={c.green} size={17} /><Text style={styles.addSetText}>Añadir serie</Text></Pressable></View>)}
      <Pressable style={styles.outline} onPress={() => setExercises((items) => [...items, ejercicio()])}><CirclePlus color={c.ink} size={18} /><Text style={styles.outlineText}>Añadir ejercicio</Text></Pressable>
      <View style={styles.cardio}><View style={styles.cardioHead}><View style={styles.live}><Bike color={c.orange} size={20} /><Text style={styles.cardioTitle}>Cardio</Text></View><Switch value={cardio !== null} onValueChange={(enabled) => setCardio(enabled ? { realizado: true, modalidad: 'Trotar', tiempoMin: 20 } : null)} trackColor={{ false: '#d5ddd6', true: c.orange }} thumbColor={c.white} /></View>{cardio && <View style={styles.cardioBody}><Text style={styles.label}>MODALIDAD</Text><View style={styles.chips}>{modes.map((mode) => <Pressable key={mode} style={[styles.chip, cardio.modalidad === mode && styles.chipActive]} onPress={() => setCardio({ ...cardio, modalidad: mode })}><Text style={styles.chipText}>{mode}</Text></Pressable>)}</View><View style={styles.row}><View style={styles.field}><Text style={styles.label}>MINUTOS</Text><TextInput value={String(cardio.tiempoMin)} onChangeText={(value) => setCardio({ ...cardio, tiempoMin: normalizarNumero(value) })} keyboardType="numeric" style={styles.input} /></View><View style={styles.field}><Text style={styles.label}>DISTANCIA KM</Text><TextInput value={String(cardio.distanciaKm ?? 0)} onChangeText={(value) => setCardio({ ...cardio, distanciaKm: normalizarNumero(value) })} keyboardType="decimal-pad" style={styles.input} /></View></View></View>}</View>
      <Pressable style={[styles.save, loading && styles.disabled]} disabled={loading} onPress={saveWorkout}><Save color={c.ink} size={19} /><Text style={styles.saveText}>{loading ? 'Guardando...' : 'Guardar sesión'}</Text></Pressable>
    </ScrollView> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.historyIntro}><Text style={styles.count}>{history.length}</Text><View><Text style={styles.historyLabel}>SESIONES REGISTRADAS</Text><Text style={styles.historySub}>Cada entrenamiento cuenta.</Text></View></View>{loading ? <Text style={styles.emptyText}>Cargando historial...</Text> : history.length === 0 ? <View style={styles.empty}><History color={c.muted} size={32} /><Text style={styles.emptyTitle}>Aún no hay sesiones</Text><Text style={styles.emptyText}>Guarda tu primer entrenamiento para verlo aquí.</Text></View> : history.map((workout) => <View style={styles.historyCard} key={workout.id}><View style={styles.rowBetween}><View><Text style={styles.date}>{workout.fecha}</Text><Text style={styles.meta}>{workout.tipoSemana === 'carga' ? 'Semana de carga' : 'Semana de descarga'} · {Math.floor(workout.duracionSegundos / 60)} min</Text></View><Pressable accessibilityLabel="Eliminar sesión" onPress={() => confirmDeleteWorkout(workout.id)}><Trash2 color={c.red} size={18} /></Pressable></View><View style={styles.historyLines}>{workout.ejercicios.map((item) => <View style={styles.live} key={item.id}><Dumbbell color={c.green} size={14} /><Text style={styles.lineText}>{item.nombre} · {item.series.length} series</Text></View>)}{workout.cardio && <View style={styles.live}><Activity color={c.orange} size={14} /><Text style={styles.lineText}>{workout.cardio.modalidad} · {workout.cardio.tiempoMin} min</Text></View>}</View></View>)}</ScrollView>}
    <View style={styles.nav}><Pressable style={styles.navItem} onPress={() => setTab('entrenar')}><Dumbbell color={tab === 'entrenar' ? c.ink : c.muted} size={21} /><Text style={styles.navText}>Entrenar</Text></Pressable><Pressable style={styles.navItem} onPress={() => { setTab('historial'); void loadHistory(); }}><History color={tab === 'historial' ? c.ink : c.muted} size={21} /><Text style={styles.navText}>Historial</Text></Pressable></View>
    </SafeAreaView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.paper }, header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: c.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 }, title: { color: c.ink, fontSize: 25, fontWeight: '800', marginTop: 5 }, logo: { width: 44, height: 44, backgroundColor: c.lime, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, content: { padding: 18, paddingBottom: 110, gap: 18 }, timerCard: { backgroundColor: c.ink, borderRadius: 22, padding: 20 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, row: { flexDirection: 'row', gap: 10 }, live: { flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#748078' }, dotOn: { backgroundColor: c.lime }, liveText: { color: '#aab6ad', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, timer: { color: c.white, fontSize: 46, fontWeight: '800', marginTop: 16, marginBottom: 18 }, start: { flex: 1, height: 46, borderRadius: 13, backgroundColor: c.lime, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, startText: { color: c.ink, fontWeight: '800' }, reset: { width: 46, height: 46, borderWidth: 1, borderColor: '#526058', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }, headingText: { color: c.ink, fontSize: 19, fontWeight: '800' }, hint: { color: c.muted, fontSize: 12 }, week: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, weekLoad: { backgroundColor: c.lime, borderColor: c.lime }, weekDeload: { backgroundColor: c.orange, borderColor: c.orange }, weekText: { color: c.ink, fontWeight: '700' }, exercise: { backgroundColor: c.white, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: c.line }, exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 13 }, number: { color: c.green, fontSize: 12, fontWeight: '900' }, exerciseInput: { flex: 1, color: c.ink, fontSize: 16, fontWeight: '800', padding: 0 }, tableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: '#eef2ee' }, tableLabel: { color: c.muted, fontSize: 9, fontWeight: '800', flex: 1, textAlign: 'center' }, endSpace: { width: 18 }, setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }, setNumber: { width: 20, color: c.muted, textAlign: 'center' }, numberInput: { flex: 1, backgroundColor: c.paper, color: c.ink, borderRadius: 9, padding: 9, textAlign: 'center', fontWeight: '700' }, addSet: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 7 }, addSetText: { color: c.green, fontSize: 12, fontWeight: '800' }, outline: { height: 48, borderWidth: 1, borderColor: c.ink, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, outlineText: { color: c.ink, fontWeight: '800' }, cardio: { backgroundColor: c.orangeSoft, borderRadius: 18, borderWidth: 1, borderColor: '#f9d7b4', overflow: 'hidden' }, cardioHead: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardioTitle: { color: c.ink, fontWeight: '800', fontSize: 16 }, cardioBody: { borderTopWidth: 1, borderTopColor: '#f9d7b4', padding: 16, gap: 12 }, label: { color: c.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderRadius: 9, backgroundColor: c.white, paddingHorizontal: 11, paddingVertical: 8 }, chipActive: { backgroundColor: c.orange }, chipText: { color: c.muted, fontSize: 12, fontWeight: '700' }, field: { flex: 1 }, input: { backgroundColor: c.white, borderRadius: 10, color: c.ink, padding: 11, fontWeight: '700' }, save: { height: 54, borderRadius: 16, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 }, saveText: { color: c.ink, fontWeight: '900', fontSize: 15 }, disabled: { opacity: 0.6 }, historyIntro: { backgroundColor: c.ink, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }, count: { color: c.lime, fontSize: 44, fontWeight: '900' }, historyLabel: { color: c.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.8 }, historySub: { color: '#aab6ad', marginTop: 4, fontSize: 12 }, historyCard: { backgroundColor: c.white, borderWidth: 1, borderColor: c.line, borderRadius: 17, padding: 16 }, date: { color: c.ink, fontSize: 16, fontWeight: '800' }, meta: { color: c.muted, fontSize: 12, marginTop: 4 }, historyLines: { gap: 8, borderTopWidth: 1, borderTopColor: '#eef2ee', marginTop: 14, paddingTop: 12 }, lineText: { color: c.ink, fontSize: 12, fontWeight: '600' }, empty: { alignItems: 'center', paddingVertical: 45, gap: 10 }, emptyTitle: { color: c.ink, fontSize: 18, fontWeight: '800' }, emptyText: { color: c.muted, textAlign: 'center', fontSize: 13 }, nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 76, backgroundColor: c.white, borderTopWidth: 1, borderTopColor: c.line, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 8 }, navItem: { alignItems: 'center', gap: 5, minWidth: 90 }, navText: { color: c.muted, fontSize: 11, fontWeight: '700' },
});
