import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Button, Field, Screen, Threshold, Txt, useNow } from '@/components/ui';
import { api, ApiError, type AuthResult } from '@/lib/api';
import { digits, formatCountdown, formatPhone } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const RESEND_MS = 30_000;

export default function Otp() {
  const t = useTheme();
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ phone: string; devCode?: string }>();
  const phone = params.phone ?? '';
  const [devCode, setDevCode] = useState(params.devCode || '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(Date.now());
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const now = useNow(1000);
  const resendIn = sentAt + RESEND_MS - now;

  const verify = async (c = code) => {
    if (c.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<AuthResult>('/auth/otp/verify', {
        method: 'POST', society: false, body: { phone, code: c, ...(needName && name.trim() ? { name: name.trim() } : {}) },
      });
      await signIn(r); // (auth) layout redirects once the session has a token
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'NAME_REQUIRED') setNeedName(true);
      else {
        setError(
          code === 'OTP_INVALID' ? "That code isn't right. Check the SMS and try again."
            : code === 'OTP_EXPIRED' ? 'This code expired. Request a new one.'
            : code === 'OTP_TOO_MANY_ATTEMPTS' ? 'Too many attempts. Request a new code.'
            : (e as Error).message,
        );
        setCode('');
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (code.length === 6 && !needName) verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    setError(null);
    try {
      const r = await api<{ devCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone }, society: false });
      setDevCode(r.devCode ?? '');
      setSentAt(Date.now());
      setCode('');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? 'Too many requests. Try again in a few minutes.' : (e as Error).message);
    }
  };

  return (
    <Screen
      back
      refresh={false}
      footer={
        <Button title={needName ? 'Continue' : 'Verify'} size="lg" loading={busy}
          disabled={code.length !== 6 || (needName && !name.trim())} onPress={() => verify()} />
      }
    >
      <View style={{ gap: 8 }}>
        <Txt v="displayMd" c="fgHeading" accessibilityRole="header">{needName ? 'Welcome to Gatekeeper' : 'Enter the code'}</Txt>
        <Txt v="body" c="fgMuted">
          {needName ? 'This number is new to Gatekeeper. Tell us your name to finish signing in.' : `We sent a 6-digit code to ${formatPhone(phone)}.`}
        </Txt>
      </View>
      <Threshold />

      {!!devCode && !needName && (
        <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: t.colors.gold, borderRadius: 10, padding: 12, backgroundColor: t.colors.status.gold.bg }}>
          <Txt v="label" color={t.colors.status.gold.fg}>Dev code: {devCode}</Txt>
        </View>
      )}

      {needName ? (
        <Field label="Your name" value={name} onChangeText={setName} autoFocus autoComplete="name" maxLength={80} placeholder="e.g. Rohan Mehta" onSubmitEditing={() => verify()} />
      ) : (
        <Pressable onPress={() => input.current?.focus()} accessibilityLabel="6-digit verification code" style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
            {Array.from({ length: 6 }, (_, i) => {
              const active = i === code.length;
              return (
                <View key={i} style={{
                  flex: 1, maxWidth: 52, height: 56, borderRadius: 10, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center',
                  borderWidth: active || error ? 2 : 1, borderColor: error ? t.colors.danger : active ? t.colors.focus : t.colors.lineStrong,
                }}>
                  <Txt v="passcode" c="fgHeading" style={{ fontSize: 26, letterSpacing: 0 }}>{code[i] ?? ''}</Txt>
                </View>
              );
            })}
          </View>
          <TextInput
            ref={input}
            value={code}
            onChangeText={(v) => setCode(digits(v).slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={6}
            style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
            accessibilityLabel="6-digit verification code"
          />
        </Pressable>
      )}
      {error && <Txt v="bodySm" c="dangerFg" accessibilityLiveRegion="assertive">{error}</Txt>}

      {!needName && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {resendIn > 0 ? (
            <Txt v="bodySm" c="fgSubtle" style={{ fontVariant: ['tabular-nums'] }}>Resend code in {formatCountdown(resendIn)}</Txt>
          ) : (
            <Pressable onPress={resend} hitSlop={12} accessibilityRole="button"><Txt v="label" c="brandFg">Resend code</Txt></Pressable>
          )}
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button"><Txt v="label" c="fgMuted">Change number</Txt></Pressable>
        </View>
      )}
    </Screen>
  );
}
