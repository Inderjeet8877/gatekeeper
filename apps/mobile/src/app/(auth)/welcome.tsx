import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, LogoMark, Threshold, Txt } from '@/components/ui';
import { palette } from '@/lib/theme';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: palette.navy[950], paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
        <LogoMark size={72} />
        <Txt v="displayXl" color={palette.paper} accessibilityRole="header">Every arrival,{'\n'}accounted for.</Txt>
        <Txt v="bodyLg" color={palette.navy[200]}>
          Approve visitors, invite guests, book the clubhouse and pay maintenance — quietly, precisely, with every entry on record.
        </Txt>
        <Threshold style={{ marginTop: 12 }} />
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Continue with phone" size="lg" onPress={() => router.push('/phone')} />
        <Txt v="caption" color={palette.navy[300]} style={{ textAlign: 'center' }}>For residents and security staff of Gatekeeper societies.</Txt>
      </View>
    </View>
  );
}
