import { AlarmClock, RotateCcw } from 'lucide-react-native';
import { memo, useEffect, useImperativeHandle, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '../../store/useSessionStore';
import { c } from '../../theme';
import { TimerDisplay } from './TimerDisplay';

export interface SessionTimerHandle {
  /** Total exacto en segundos, calculado desde las marcas de tiempo. */
  getElapsedSeconds: () => number;
  /** Detiene el cronómetro, borra el estado persistido y vuelve a cero. */
  reset: () => Promise<void>;
}

interface SessionTimerBannerProps {
  ref?: Ref<SessionTimerHandle>;
  /** Solo se dispara al comenzar/finalizar/reiniciar, nunca por cada tick. */
  onSessionActiveChange?: (active: boolean) => void;
}

/**
 * El tick de 1Hz está aislado en el nodo hoja <TimerDisplay />, por lo que
 * ni este banner ni la vista principal se re-renderizan cada segundo.
 */
function SessionTimerBannerBase({ ref, onSessionActiveChange }: SessionTimerBannerProps) {
  const { isActive, isRunning, toggleSession, endSession, getElapsedSeconds } = useSessionStore();

  useImperativeHandle(
    ref,
    () => ({
      getElapsedSeconds,
      reset: async () => {
        endSession();
      },
    }),
    [getElapsedSeconds, endSession],
  );

  useEffect(() => {
    if (onSessionActiveChange) {
      onSessionActiveChange(isActive);
    }
  }, [isActive, onSessionActiveChange]);

  const status = isRunning ? 'EN CURSO' : isActive ? 'SESIÓN PAUSADA' : 'LISTO PARA EMPEZAR';
  const timerButtonStyle = isRunning ? styles.timerButtonActive : styles.timerButtonIdle;
  const timerActionText = isRunning ? '⏸ Pausar' : isActive ? '▶ Reanudar' : '▶ Comenzar';

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.live}>
          <View style={[styles.dot, isRunning && styles.dotOn]} />
          <Text style={styles.liveText}>{status}</Text>
        </View>
        <AlarmClock color={c.lime} size={19} />
      </View>
      <TimerDisplay />
      <View style={styles.row}>
        <Pressable
          style={[styles.start, timerButtonStyle]}
          onPress={toggleSession}
        >
          <Text style={styles.startText}>{timerActionText}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Reiniciar cronómetro"
          style={styles.reset}
          onPress={endSession}
        >
          <RotateCcw color={c.white} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

export const SessionTimerBanner = memo(SessionTimerBannerBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: c.ink,
    borderRadius: 22,
    padding: 20,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#748078' },
  dotOn: { backgroundColor: c.lime },
  liveText: { color: '#aab6ad', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  start: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButtonIdle: { backgroundColor: '#D9F99D' },
  timerButtonActive: { backgroundColor: '#FDE047' },
  startText: { color: c.ink, fontWeight: '800', fontSize: 15 },
  reset: { width: 46, height: 46, borderWidth: 1, borderColor: '#526058', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
