import { AlarmClock, RotateCcw } from 'lucide-react-native';
import { memo, useEffect, useImperativeHandle, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTime, useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { useSessionStore } from '../../store/useSessionStore';
import { c } from '../../theme';

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
 * El estado de los segundos vive aquí dentro: el tick de cada segundo solo
 * re-renderiza este banner, no la lista de ejercicios ni sus TextInput.
 */
function SessionTimerBannerBase({ ref, onSessionActiveChange }: SessionTimerBannerProps) {
  const elapsedSeconds = useWorkoutTimer();
  const { isActive, isRunning, isHydrated, toggleSession, endSession } = useSessionStore();
  const formattedTime = formatTime(elapsedSeconds);

  useImperativeHandle(
    ref,
    () => ({
      getElapsedSeconds: () => elapsedSeconds,
      reset: async () => {
        endSession();
      },
    }),
    [elapsedSeconds, endSession],
  );

  useEffect(() => {
    if (isHydrated && onSessionActiveChange) {
      onSessionActiveChange(isActive);
    }
  }, [isHydrated, isActive, onSessionActiveChange]);

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
      <Text style={styles.timer}>{formattedTime}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.start, timerButtonStyle, !isHydrated && styles.disabled]}
          disabled={!isHydrated}
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
  timer: { color: c.white, fontSize: 46, fontWeight: '800', marginTop: 16, marginBottom: 18, fontVariant: ['tabular-nums'] },
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
  disabled: { opacity: 0.6 },
});
