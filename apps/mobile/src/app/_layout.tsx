// Per-weight imports so only the 6 used faces are bundled.
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { SessionProvider, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (n, e) => n < 2 && !(e instanceof ApiError && e.status >= 400 && e.status < 500),
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium, Fraunces_600SemiBold, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold,
  });
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <SessionProvider>
          <Shell ready={fontsLoaded || !!fontError} />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Shell({ ready }: { ready: boolean }) {
  const { booting } = useSession();
  const t = useTheme();
  const show = ready && !booting;
  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);
  if (!show) return null;
  return (
    <>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.canvas } }} />
      <ToastHost />
    </>
  );
}
