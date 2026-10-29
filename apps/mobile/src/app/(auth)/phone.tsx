import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, LogoMark, Screen, Txt } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { digits } from '@/lib/format';

export default function Phone() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = digits(phone);
  const valid = d.length >= 10 && d.length <= 15;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ sent: boolean; devCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone: d }, society: false });
      router.push({ pathname: '/otp', params: { phone: d, devCode: r.devCode ?? '' } });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? 'Too many requests. Try again in a few minutes.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back refresh={false} footer={<Button title="Send code" size="lg" disabled={!valid} loading={busy} onPress={send} />}>
      <View style={{ gap: 12, marginTop: 8 }}>
        <LogoMark size={48} />
        <Txt v="displayMd" c="fgHeading" accessibilityRole="header">Sign in with your phone</Txt>
        <Txt v="body" c="fgMuted">We'll send a 6-digit code by SMS. Use the number your society admin registered.</Txt>
      </View>
      <Field
        label="Mobile number"
        prefix="+91"
        value={phone}
        onChangeText={(v) => setPhone(digits(v).slice(0, 15))}
        keyboardType="number-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="98765 43210"
        autoFocus
        error={error}
        onSubmitEditing={() => valid && send()}
      />
    </Screen>
  );
}
