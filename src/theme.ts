import { StyleSheet } from 'react-native';

export const COLORS = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceHighlight: '#2C2C2E',
  primary: '#3B82F6', // Azul de acción
  success: '#10B981', // Verde esmeralda para completado
  danger: '#EF4444',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  border: '#333333',
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
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
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
    fontVariant: ['tabular-nums'], // Evita el salto horizontal al cambiar números (crítico para cronómetros y cargas)
  },
  input: {
    backgroundColor: COLORS.surfaceHighlight,
    color: COLORS.textPrimary,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: 18,
    textAlign: 'center',
    minWidth: 60,
  },
});

export const c = {
  ink: '#18221d',
  muted: '#66736b',
  paper: '#f5f7f2',
  white: '#fff',
  line: '#dce5dc',
  lime: '#c7ef6b',
  green: '#58742c',
  orange: '#f5a15a',
  orangeSoft: '#fff0df',
  red: '#c9554e',
};
