import { Redirect, Stack, useSegments } from 'expo-router';
import { homeFor, useSession } from '@/lib/session';

export default function AuthLayout() {
  const s = useSession();
  const screen = useSegments().at(-1);
  // Signed-in users only belong on the society picker; a selected membership goes home.
  if (s.member || (s.token && screen !== 'societies')) return <Redirect href={homeFor(s)} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
