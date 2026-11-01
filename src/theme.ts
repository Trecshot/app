import { StyleSheet } from 'react-native';

export const COLORS = {
  background: '#000000', // Negro Puro AMOLED (píxeles apagados, ahorro de batería)
  surface: '#121212', // Gris Oscuro para tarjetas, modales y contenedores
  surfaceHighlight: '#1C1C1C', // Gris ligeramente más claro para inputs y chips secundarios
  timerSurface: '#121212', // Fondo oscuro para la tarjeta del cronómetro
  primary: '#A3E635', // Verde Lima vibrante (Botón Principal / Acento activo)
  primaryDark: '#84CC16', // Verde lima profundo para detalles secundarios
  pause: '#F97316', // Naranja sutil para estado de pausa / botón pausar
  textPrimary: '#FFFFFF', // Blanco puro para títulos, números, series, reps y peso
  textSecondary: '#A3A3A3', // Gris medio para subtítulos, notas y placeholders
  textInverted: '#000000', // Negro puro para alto contraste sobre fondo Verde Lima
  border: '#262626', // Gris oscuro sutil para bordes y separadores limpios
  btnSecondary: '#262626', // Gris oscuro para botones secundarios (+ Añadir ejercicio/cardio)
  danger: '#EF4444', // Rojo tenue para fallo, drop set o acciones destructivas
  dropSetIndicator: 'rgba(239, 68, 68, 0.16)', // Rojo tenue traslúcido para fila Drop Set
  dropSetAccent: '#EF4444', // Rojo tenue sólido para Drop Set / Fallo
  warmupIndicator: 'rgba(234, 179, 8, 0.16)', // Amarillo mostaza traslúcido para Warmup
  warmupAccent: '#EAB308', // Amarillo mostaza sólido para serie Calentamiento
  normalSet: 'transparent', // Base transparente para serie normal
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const GLOBAL_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  numberData: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  input: {
    backgroundColor: COLORS.surfaceHighlight,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.textPrimary,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export const theme = {
  colors: COLORS,
  spacing: SPACING,
  styles: GLOBAL_STYLES,
};

export default theme;
