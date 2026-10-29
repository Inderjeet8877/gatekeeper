import { Redirect, Stack } from 'expo-router';
import { RealtimeProvider } from '@/lib/realtime';
import { homeFor, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function ResidentLayout() {
  const s = useSession();
  const t = useTheme();
  if (s.member?.role !== 'RESIDENT') return <Redirect href={homeFor(s)} />;
  return (
    <RealtimeProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.canvas } }} />
    </RealtimeProvider>
  );
}
