import { AlarmClock, Pause, Play, RotateCcw } from 'lucide-react-native';
import { memo, useEffect, useImperativeHandle, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { c } from '../theme';

export interface SessionTimerHandle {
  /** Total exacto en segundos, calculado desde las marcas de tiempo. */
  getElapsedSeconds: () => number;
  /** Detiene el cronómetro, borra el estado persistido y vuelve a cero. */
  reset: () => Promise<void>;
}

interface SessionTimerBannerProps {
  ref?: Ref<SessionTimerHandle>;
  /** Solo se dispara al comenzar/finalizar/reiniciar, nunca por cada tick. */
  onSessionActiveChange: (active: boolean) => void;
}

/**
 * El estado de los segundos vive aquí dentro: el tick de cada segundo solo
 * re-renderiza este banner, no la lista de ejercicios ni sus TextInput.
 */
function SessionTimerBannerBase({ ref, onSessionActiveChange }: SessionTimerBannerProps) {
  const { formattedTime, isRunning, sessionActive, isHydrated, toggle, reset, getElapsedSeconds } = useWorkoutTimer();

  useImperativeHandle(ref, () => ({ getElapsedSeconds, reset }), [getElapsedSeconds, reset]);

  useEffect(() => { if (isHydrated) onSessionActiveChange(sessionActive); }, [isHydrated, sessionActive, onSessionActiveChange]);

  const status = isRunning ? 'EN CURSO' : sessionActive ? 'SESIÓN PAUSADA' : 'LISTO PARA EMPEZAR';
  const action = isRunning ? 'Pausar' : sessionActive ? 'Reanudar' : 'Comenzar';

  return <View style={styles.card}>
    <View style={styles.rowBetween}>
      <View style={styles.live}><View style={[styles.dot, isRunning && styles.dotOn]} /><Text style={styles.liveText}>{status}</Text></View>
      <AlarmClock color={c.lime} size={19} />
    </View>
    <Text style={styles.timer}>{formattedTime}</Text>
    <View style={styles.row}>
      <Pressable style={[styles.start, !isHydrated && styles.disabled]} disabled={!isHydrated} onPress={() => { void toggle(); }}>
        {isRunning ? <Pause color={c.ink} size={17} /> : <Play color={c.ink} size={17} />}
        <Text style={styles.startText}>{action}</Text>
      </Pressable>
      <Pressable accessibilityLabel="Reiniciar cronómetro" style={styles.reset} onPress={() => { void reset(); }}>
        <RotateCcw color={c.white} size={18} />
      </Pressable>
    </View>
  </View>;
}

export const SessionTimerBanner = memo(SessionTimerBannerBase);

const styles = StyleSheet.create({
  card: { backgroundColor: c.ink, borderRadius: 22, padding: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#748078' },
  dotOn: { backgroundColor: c.lime },
  liveText: { color: '#aab6ad', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  timer: { color: c.white, fontSize: 46, fontWeight: '800', marginTop: 16, marginBottom: 18, fontVariant: ['tabular-nums'] },
  start: { flex: 1, height: 46, borderRadius: 13, backgroundColor: c.lime, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  startText: { color: c.ink, fontWeight: '800' },
  reset: { width: 46, height: 46, borderWidth: 1, borderColor: '#526058', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
});
