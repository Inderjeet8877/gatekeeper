import { Tabs } from 'expo-router/js-tabs';
import { CircleUserRound, ConciergeBell, House, UserRoundCheck, UsersRound, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Visitor } from '@/lib/api';
import { useList } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

export default function ResidentTabs() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useList<Visitor>(['visitors', 'pending'], '/visitors?status=PENDING_APPROVAL', { live: true }).data?.length ?? 0;

  const icon = (Icon: LucideIcon) => ({ focused, color }: { focused: boolean; color: unknown }) => (
    <View style={{ alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: -9, width: 24, height: 3, borderRadius: 2, backgroundColor: focused ? t.colors.brand : 'transparent' }} />
      <Icon size={24} color={color as string} strokeWidth={1.75} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.colors.canvas },
        tabBarActiveTintColor: t.colors.fgHeading,
        tabBarInactiveTintColor: t.colors.fgSubtle,
        tabBarLabelStyle: { fontFamily: t.fonts.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.line, height: 64 + insets.bottom, paddingTop: 8 },
        tabBarBadgeStyle: { backgroundColor: t.colors.navy, fontFamily: t.fonts.bold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon(House) }} />
      <Tabs.Screen name="visitors" options={{
        title: 'Visitors', tabBarIcon: icon(UserRoundCheck), tabBarBadge: pending || undefined,
        tabBarAccessibilityLabel: pending ? `Visitors, ${pending} pending` : 'Visitors',
      }} />
      <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: icon(UsersRound) }} />
      <Tabs.Screen name="services" options={{ title: 'Services', tabBarIcon: icon(ConciergeBell) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon(CircleUserRound) }} />
    </Tabs>
  );
}
