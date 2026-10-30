import { Tabs } from 'expo-router';
import { Dumbbell, History, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + Math.max(insets.bottom, 12),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Entrenar',
          tabBarLabel: 'Entrenar',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarLabel: 'Historial',
          tabBarIcon: ({ color, size }) => <History color={color} size={size ?? 22} />,
        }}
      />
      <Tabs.Screen
        name="planificacion"
        options={{
          title: 'Planificación',
          tabBarLabel: 'Planificación',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size ?? 22} />,
        }}
      />
    </Tabs>
  );
}
