import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { COLORS, SPACING } from '../../theme';

interface BottomSheetItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

interface ExerciseBottomSheetProps<T extends BottomSheetItem> {
  visible: boolean;
  title: string;
  subtitle?: string;
  data: T[];
  selectedId?: string | null;
  onSelect: (item: T) => void;
  onClose: () => void;
  emptyText?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function ExerciseBottomSheet<T extends BottomSheetItem>({
  visible,
  title,
  subtitle,
  data,
  selectedId,
  onSelect,
  onClose,
  emptyText = 'No hay opciones disponibles',
}: ExerciseBottomSheetProps<T>) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop táctil para cerrar */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Hoja Inferior */}
        <View style={styles.sheetContainer}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Grabber superior */}
            <View style={styles.grabberContainer}>
              <View style={styles.grabber} />
            </View>

            {/* Header de la hoja */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            {/* Lista optimizada con FlatList (Lazy Loading y Virtualización) */}
            <FlatList
              data={data}
              keyExtractor={(item) => item.id}
              initialNumToRender={10}
              windowSize={5}
              maxToRenderPerBatch={10}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selectedId === item.id;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.itemRow,
                      isSelected && styles.itemRowSelected,
                      pressed && styles.itemRowPressed,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.itemTitle,
                          isSelected && styles.itemTitleSelected,
                        ]}
                      >
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                      ) : null}
                    </View>

                    {item.badge ? (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : null}

                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Check size={18} color={COLORS.primaryDark} strokeWidth={2.5} />
                      </View>
                    )}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{emptyText}</Text>
                </View>
              }
            />
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
    minHeight: SCREEN_HEIGHT * 0.35,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  grabberContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  grabber: {
    width: 44,
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: SPACING.xs,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: 20,
  },
  listContent: {
    paddingVertical: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    marginVertical: 2,
  },
  itemRowSelected: {
    backgroundColor: 'rgba(193, 225, 79, 0.18)',
  },
  itemRowPressed: {
    backgroundColor: COLORS.surfaceHighlight,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemTitleSelected: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeContainer: {
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  checkIcon: {
    marginLeft: SPACING.xs,
  },
  emptyContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
