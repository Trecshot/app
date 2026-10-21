import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Dumbbell } from 'lucide-react-native';
import { COLORS, GLOBAL_STYLES, SPACING } from '../../src/theme';
import { WorkoutHistoryCard } from '../../src/components/workout/WorkoutHistoryCard';

export default function HistoryScreen() {
  // Arreglo vacío simulando que la base de datos aún no tiene registros
  const historyData: any[] = [];

  // Componente visual que se muestra solo cuando no hay datos
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.iconCircle}>
        <Dumbbell size={40} color={COLORS.primaryDark} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>Aún no hay registros</Text>
      <Text style={styles.emptySubtitle}>
        Tus entrenamientos finalizados aparecerán aquí. ¡Ve a la pestaña &quot;Entrenar&quot; y completa tu primera sesión!
      </Text>
    </View>
  );

  return (
    <View style={GLOBAL_STYLES.container}>
      {/* Header Superior */}
      <View style={styles.topHeader}>
        <Text style={styles.headerSubtitle}>TUS REGISTROS</Text>
        <Text style={styles.headerTitle}>Historial</Text>
      </View>

      {/* Lista de alto rendimiento */}
      <View style={styles.listContainer}>
        <FlashList
          data={historyData}
          renderItem={({ item }) => <WorkoutHistoryCard {...item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState} // Muestra el estado vacío si la data está vacía
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: 50,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.xs,
  },
  
  // Estilos específicos para el Estado Vacío
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
