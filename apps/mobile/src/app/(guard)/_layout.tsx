import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { CalendarClock, DoorOpen, HandHelping, KeyRound, LogOut, Moon, Siren, Sun, UserRoundPlus, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirm, I, IconButton, Txt, useNow } from '@/components/ui';
import type { SosAlert } from '@/lib/api';
import { formatTime, isNightIST } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { RealtimeProvider, useLive } from '@/lib/realtime';
import { homeFor, useSession } from '@/lib/session';
import { GuardContext, useTheme } from '@/lib/theme';

type Mode = 'day' | 'night';

export default function GuardLayout() {
  const s = useSession();
  // Night auto 7 pm–6 am IST (§5.3). A manual pick holds until the next automatic switch.
  const auto: Mode = isNightIST(new Date(useNow(60_000))) ? 'night' : 'day';
  const [manual, setManual] = useState<{ mode: Mode; auto: Mode } | null>(null);
  const mode = manual?.auto === auto ? manual.mode : auto;
  if (s.member?.role !== 'GUARD') return <Redirect href={homeFor(s)} />;
  return (
    <GuardContext.Provider value={mode}>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <RealtimeProvider>
        <Console toggle={() => setManual({ mode: mode === 'night' ? 'day' : 'night', auto })} />
      </RealtimeProvider>
    </GuardContext.Provider>
  );
}

function Console({ toggle }: { toggle: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sos = useList<SosAlert>(['sos', 'active'], '/sos?status=RAISED,ACKNOWLEDGED', { live: true }).data ?? [];
  const raised = sos.filter((a) => a.status === 'RAISED').length;
  const icon = (Icon: LucideIcon) => ({ color }: { color: unknown }) => <I icon={Icon} size={28} color={color as string} />;
  return (
    <Tabs
      screenOptions={{
        header: () => <Header raised={raised} toggle={toggle} />,
        sceneStyle: { backgroundColor: t.colors.canvas },
        tabBarActiveTintColor: t.isDark ? '#FFFFFF' : t.colors.navy,
        tabBarInactiveTintColor: t.colors.fgMuted,
        tabBarActiveBackgroundColor: t.colors.status.success.bg,
        tabBarLabelStyle: { fontFamily: t.fonts.semibold, fontSize: 13 },
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.lineStrong, height: 80 + insets.bottom },
        tabBarItemStyle: { paddingVertical: 8 },
      }}
    >
      <Tabs.Screen name="gate" options={{ title: 'Gate', tabBarIcon: icon(KeyRound) }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarAccessibilityLabel: 'Log visitor', tabBarIcon: icon(UserRoundPlus) }} />
      <Tabs.Screen name="inside" options={{ title: 'Inside', tabBarIcon: icon(DoorOpen) }} />
      <Tabs.Screen name="expected" options={{ title: 'Expected', tabBarIcon: icon(CalendarClock) }} />
      <Tabs.Screen name="staff" options={{ title: 'Staff', tabBarIcon: icon(HandHelping) }} />
      <Tabs.Screen name="alerts" options={{
        title: 'Alerts', tabBarIcon: icon(Siren), tabBarBadge: sos.length || undefined,
        tabBarBadgeStyle: { backgroundColor: t.colors.danger, fontFamily: t.fonts.bold },
        tabBarAccessibilityLabel: sos.length ? `Alerts, ${sos.length} active` : 'Alerts',
      }} />
    </Tabs>
  );
}

function Header({ raised, toggle }: { raised: number; toggle: () => void }) {
  const t = useTheme();
  const s = useSession();
  const live = useLive();
  const insets = useSafeAreaInsets();
  const now = useNow(15_000);
  return (
    <View style={{ backgroundColor: t.colors.canvas, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: t.colors.lineStrong }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt v="h4" c="fgHeading" numberOfLines={1}>{s.member?.society.name}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? t.colors.status.success.dot : t.colors.fgMuted }} />
            <Txt v="bodySm" c="fgMuted" numberOfLines={1}>
              {live ? 'Live' : 'Reconnecting…'} · {s.user?.name} · on duty
            </Txt>
          </View>
        </View>
        <Txt v="h3" c="fgHeading" style={{ fontVariant: ['tabular-nums'] }}>{formatTime(new Date(now))}</Txt>
        <IconButton icon={t.isDark ? Sun : Moon} label={t.isDark ? 'Switch to Day theme' : 'Switch to Night theme'} size={56} color={t.colors.fgHeading} onPress={toggle} />
        <IconButton icon={LogOut} label="End shift and sign out" size={56} color={t.colors.fgHeading}
          onPress={async () => (await confirm('End shift?', 'You will be signed out of this gate device.', 'End shift')) && s.signOut()} />
      </View>
      {raised > 0 && (
        <Pressable onPress={() => router.navigate('/alerts')} accessibilityRole="button" accessibilityLiveRegion="assertive"
          style={{ backgroundColor: t.colors.danger, minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <I icon={Siren} size={28} color="#fff" />
          <Txt v="guardBody" color="#fff" style={{ flex: 1, fontFamily: t.fonts.bold }}>
            {raised} new SOS alert{raised > 1 ? 's' : ''} — tap to respond
          </Txt>
        </Pressable>
      )}
    </View>
  );
}
