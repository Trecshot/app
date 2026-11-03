import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Trash2, Dumbbell, Sparkles } from 'lucide-react-native';
import { COLORS, SPACING } from '../../theme';
import {
  EXERCISE_CATALOG,
  MUSCLE_GROUPS,
  MuscleGroup,
  CatalogExercise,
  getCatalogExerciseName,
} from '../../../types';
import { sanitizeTacticalNote } from '../../utils/textSanitizer';

export interface SessionConfigData {
  note: string;
  targetMuscles: MuscleGroup[];
  presetExerciseIds: string[];
}

export interface SessionConfigModalProps {
  visible: boolean;
  weekNumber: number;
  sessionOrdinal: number;
  totalPlannedSessions: number;
  initialNote: string;
  initialTargetMuscles: MuscleGroup[];
  initialPresetExerciseIds: string[];
  onSave: (data: SessionConfigData) => void;
  onClose: () => void;
}

function SessionConfigForm({
  weekNumber,
  sessionOrdinal,
  totalPlannedSessions,
  initialNote,
  initialTargetMuscles,
  initialPresetExerciseIds,
  onSave,
  onClose,
}: SessionConfigModalProps) {
  const [note, setNote] = useState(initialNote || '');
  const [targetMuscles, setTargetMuscles] = useState<MuscleGroup[]>(
    initialTargetMuscles || [],
  );
  const [presetExerciseIds, setPresetExerciseIds] = useState<string[]>(
    initialPresetExerciseIds || [],
  );
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatalogGroup, setSelectedCatalogGroup] = useState<
    MuscleGroup | 'TODOS'
  >(
    initialTargetMuscles && initialTargetMuscles.length > 0
      ? initialTargetMuscles[0]
      : 'TODOS',
  );

  const toggleMuscleFocus = (group: MuscleGroup) => {
    setTargetMuscles((prev) => {
      if (prev.includes(group)) {
        return prev.filter((g) => g !== group);
      }
      return [...prev, group];
    });
  };

  const handleAddPresetExercise = (exerciseId: string) => {
    setPresetExerciseIds((prev) => {
      if (prev.includes(exerciseId)) return prev;
      return [...prev, exerciseId];
    });
    setIsExercisePickerOpen(false);
    setSearchQuery('');
  };

  const handleRemovePresetExercise = (indexToRemove: number) => {
    setPresetExerciseIds((prev) =>
      prev.filter((_, idx) => idx !== indexToRemove),
    );
  };

  const handleSave = () => {
    const cleanNote = sanitizeTacticalNote(note);
    onSave({
      note: cleanNote,
      targetMuscles,
      presetExerciseIds,
    });
    onClose();
  };

  // Filtrado optimizado para el catálogo
  const filteredCatalog = useMemo(() => {
    return EXERCISE_CATALOG.filter((ex: CatalogExercise) => {
      const matchesGroup =
        selectedCatalogGroup === 'TODOS' ||
        ex.muscleGroup === selectedCatalogGroup;
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGroup && matchesSearch;
    });
  }, [selectedCatalogGroup, searchQuery]);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheetContainer}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* Grabber superior */}
          <View style={styles.grabberContainer}>
            <View style={styles.grabber} />
          </View>

          {/* Cabecera */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                SEMANA {weekNumber} • SESIÓN ORDINAL
              </Text>
              <Text style={styles.title}>
                Configurar Sesión {sessionOrdinal}/{totalPlannedSessions}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sección 1: Nota Táctica */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>NOTA TÁCTICA</Text>
                <Text style={styles.optionalTag}>Opcional</Text>
              </View>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={`Directriz táctica para la Sesión ${sessionOrdinal}/${totalPlannedSessions} (ej. Hack 80 kg x 8 y Prensa 160 kg)`}
                placeholderTextColor={COLORS.textSecondary}
                multiline
              />
            </View>

            <View style={styles.divider} />

            {/* Sección 2: Pre-carga Opcional (Enfoque y Ejercicios) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Sparkles size={16} color={COLORS.primary} />
                  <Text style={styles.sectionTitle}>PRE-CARGA OPCIONAL</Text>
                </View>
                <Text style={styles.optionalTag}>Automática</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Al entrar a la pantalla Entrenar en esta sesión, se seleccionarán
                estos enfoques y se precargarán estos ejercicios listos para
                registrar.
              </Text>

              {/* Sub-sección: Enfoque Muscular */}
              <Text style={styles.subFieldLabel}>
                ENFOQUE (GRUPOS MUSCULARES)
              </Text>
              <View style={styles.chipsWrap}>
                {MUSCLE_GROUPS.map((group) => {
                  const isSelected = targetMuscles.includes(group);
                  return (
                    <TouchableOpacity
                      key={group}
                      style={[
                        styles.muscleChip,
                        isSelected && styles.muscleChipActive,
                      ]}
                      onPress={() => toggleMuscleFocus(group)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.muscleChipText,
                          isSelected && styles.muscleChipTextActive,
                        ]}
                      >
                        {group} {isSelected ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sub-sección: Ejercicios Pre-cargados */}
              <View style={styles.exercisesHeaderRow}>
                <Text style={styles.subFieldLabel}>
                  EJERCICIOS PRE-CARGADOS ({presetExerciseIds.length})
                </Text>
                {!isExercisePickerOpen && (
                  <TouchableOpacity
                    style={styles.addExerciseMiniBtn}
                    onPress={() => setIsExercisePickerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={14} color={COLORS.primary} />
                    <Text style={styles.addExerciseMiniBtnText}>
                      Añadir Ejercicio
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Selector desplegable de ejercicios del catálogo */}
              {isExercisePickerOpen && (
                <View style={styles.catalogPickerBox}>
                  <View style={styles.catalogPickerHeader}>
                    <Text style={styles.catalogPickerTitle}>
                      Seleccionar del Catálogo
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setIsExercisePickerOpen(false);
                        setSearchQuery('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Filtro por grupo muscular */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.catalogFilterScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.catalogFilterChip,
                        selectedCatalogGroup === 'TODOS' &&
                          styles.catalogFilterChipActive,
                      ]}
                      onPress={() => setSelectedCatalogGroup('TODOS')}
                    >
                      <Text
                        style={[
                          styles.catalogFilterChipText,
                          selectedCatalogGroup === 'TODOS' &&
                            styles.catalogFilterChipTextActive,
                        ]}
                      >
                        Todos
                      </Text>
                    </TouchableOpacity>
                    {MUSCLE_GROUPS.map((g) => {
                      const isSelected = selectedCatalogGroup === g;
                      const isFocused = targetMuscles.includes(g);
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[
                            styles.catalogFilterChip,
                            isSelected && styles.catalogFilterChipActive,
                          ]}
                          onPress={() => setSelectedCatalogGroup(g)}
                        >
                          <Text
                            style={[
                              styles.catalogFilterChipText,
                              isSelected && styles.catalogFilterChipTextActive,
                            ]}
                          >
                            {g} {isFocused ? '★' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Input de Búsqueda */}
                  <TextInput
                    style={styles.catalogSearchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Buscar ejercicio..."
                    placeholderTextColor={COLORS.textSecondary}
                  />

                  {/* Lista con scroll dentro del picker */}
                  <View style={styles.catalogItemsList}>
                    {filteredCatalog.length === 0 ? (
                      <Text style={styles.catalogEmptyText}>
                        No se encontraron ejercicios
                      </Text>
                    ) : (
                      filteredCatalog.slice(0, 15).map((item) => {
                        const isAlreadyPreset = presetExerciseIds.includes(
                          item.id,
                        );
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.catalogItemRow,
                              isAlreadyPreset && styles.catalogItemRowDisabled,
                            ]}
                            onPress={() => handleAddPresetExercise(item.id)}
                            disabled={isAlreadyPreset}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.catalogItemName,
                                  isAlreadyPreset &&
                                    styles.catalogItemNameDisabled,
                                ]}
                              >
                                {item.name}
                              </Text>
                              <Text style={styles.catalogItemMuscle}>
                                {item.muscleGroup}
                              </Text>
                            </View>
                            {isAlreadyPreset ? (
                              <Text style={styles.alreadyAddedBadge}>
                                Añadido
                              </Text>
                            ) : (
                              <Plus size={16} color={COLORS.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>
              )}

              {/* Lista de ejercicios pre-cargados actuales */}
              {presetExerciseIds.length === 0 ? (
                <View style={styles.emptyPresetsBox}>
                  <Dumbbell size={18} color={COLORS.textSecondary} />
                  <Text style={styles.emptyPresetsText}>
                    Sin ejercicios pre-cargados. (Puedes añadir ejercicios fijos
                    para no buscarlos en cada sesión).
                  </Text>
                </View>
              ) : (
                <View style={styles.presetsList}>
                  {presetExerciseIds.map((exId, idx) => {
                    const name = getCatalogExerciseName(exId, exId);
                    const catalogObj = EXERCISE_CATALOG.find(
                      (e) => e.id === exId,
                    );
                    return (
                      <View
                        key={`${exId}_${idx}`}
                        style={styles.presetItemRow}
                      >
                        <View style={styles.presetItemNumberBadge}>
                          <Text style={styles.presetItemNumberText}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.presetItemName} numberOfLines={1}>
                            {name}
                          </Text>
                          {catalogObj?.muscleGroup ? (
                            <Text style={styles.presetItemMuscle}>
                              {catalogObj.muscleGroup}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemovePresetExercise(idx)}
                          style={styles.presetDeleteBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer con Acciones */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>Guardar Configuración</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

export function SessionConfigModal(props: SessionConfigModalProps) {
  if (!props.visible) return null;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={props.onClose}
    >
      <SessionConfigForm
        key={`${props.weekNumber}_${props.sessionOrdinal}`}
        {...props}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    height: '88%',
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  grabberContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabber: {
    width: 40,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.8,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sectionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  noteInput: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#FFFFFF',
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E1E1E',
    marginVertical: SPACING.sm,
  },
  subFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
    marginTop: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  muscleChip: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  muscleChipActive: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    borderColor: COLORS.primary,
  },
  muscleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  muscleChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  exercisesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: SPACING.xs,
  },
  addExerciseMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addExerciseMiniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  catalogPickerBox: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  catalogPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  catalogPickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  catalogFilterScroll: {
    gap: 6,
    paddingVertical: 4,
  },
  catalogFilterChip: {
    backgroundColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  catalogFilterChipActive: {
    backgroundColor: COLORS.primary,
  },
  catalogFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  catalogFilterChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  catalogSearchInput: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 12,
    marginVertical: 6,
  },
  catalogItemsList: {
    maxHeight: 180,
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  catalogItemRowDisabled: {
    opacity: 0.4,
  },
  catalogItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  catalogItemNameDisabled: {
    color: COLORS.textSecondary,
  },
  catalogItemMuscle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  alreadyAddedBadge: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  catalogEmptyText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  emptyPresetsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    borderStyle: 'dashed',
  },
  emptyPresetsText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  presetsList: {
    gap: 6,
  },
  presetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  presetItemNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  presetItemNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  presetItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  presetItemMuscle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  presetDeleteBtn: {
    padding: 6,
  },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    backgroundColor: '#121212',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
