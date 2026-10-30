import { StyleSheet } from 'react-native';

export const COLORS = {
  background: '#F9FAFB', // Fondo gris muy claro de la app
  surface: '#FFFFFF', // Fondo blanco de las tarjetas
  surfaceHighlight: '#F3F4F6', // Fondo de inputs
  timerSurface: '#18271E', // Verde oscuro casi negro para la tarjeta del reloj
  primary: '#C1E14F', // Verde lima vibrante (Comenzar, Añadir Serie)
  primaryDark: '#8F9B7A', // Verde salvia/oliva (Finalizar entrenamiento)
  textPrimary: '#111827', // Negro/Gris oscuro para títulos
  textSecondary: '#6B7280', // Gris para subtítulos y placeholders
  textInverted: '#FFFFFF', // Blanco para textos sobre fondos oscuros
  border: '#E5E7EB', // Líneas divisorias sutiles
  danger: '#EF4444', // Rojo para acciones destructivas / eliminar
  dropSetIndicator: 'rgba(220, 38, 38, 0.12)', // Crimson traslúcido para fila Drop Set
  dropSetAccent: '#DC2626', // Crimson sólido para etiqueta/borde Drop Set
  warmupIndicator: 'rgba(245, 158, 11, 0.14)', // Amber traslúcido para fila Warmup
  warmupAccent: '#D97706', // Amber sólido para etiqueta/borde Warmup
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
    borderRadius: 16, // Bordes más redondeados según tu diseño original
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2, // Sombra suave en Android
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
    backgroundColor: COLORS.surface,
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
