import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { CircleCheck, CircleX, Delete, LogIn, LogOut, UserRoundPlus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, I, Screen, Txt } from '@/components/ui';
import { api, ApiError, type GateResult } from '@/lib/api';
import { formatDate, formatTime, humanize } from '@/lib/format';
import { useAct } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

type Outcome = { ok: boolean; title: string; body: string; icon: typeof CircleCheck };

const describe = (r: GateResult): Outcome =>
  r.kind === 'VISITOR'
    ? { ok: true, icon: CircleCheck, title: 'Passcode accepted',
        body: `${r.visitor.name}, ${humanize(r.visitor.type).toLowerCase()} of ${r.visitor.flat.label}. Checked in at ${formatTime(r.visitor.checkInAt ?? new Date())}.` }
    : { ok: true, icon: r.action === 'CHECK_IN' ? LogIn : LogOut, title: r.action === 'CHECK_IN' ? 'Staff checked in' : 'Staff checked out',
        body: `${r.staff.name} (${humanize(r.staff.category).toLowerCase()}) checked ${r.action === 'CHECK_IN' ? 'in' : 'out'} at ${formatTime(r.action === 'CHECK_IN' ? r.attendance.checkInAt : r.attendance.checkOutAt ?? new Date())}${r.staff.flats.length ? ` · ${r.staff.flats.map((f) => f.label).join(', ')}` : ''}.` };

const failure = (e: unknown): Outcome => {
  const reason = e instanceof ApiError ? e.details?.reason : undefined;
  if (!(e instanceof ApiError) || e.code !== 'PASSCODE_INVALID')
    return { ok: false, icon: CircleX, title: 'Not verified', body: e instanceof ApiError ? e.message : "Couldn't reach Gatekeeper. Passcodes can't be checked offline. Log the visitor manually." };
  if (reason === 'EXPIRED') return { ok: false, icon: CircleX, title: 'Passcode expired', body: 'This passcode has expired. Ask the resident to send a new invite.' };
  if (reason === 'NOT_YET_VALID') return { ok: false, icon: CircleX, title: 'Not valid yet', body: "This invite isn't valid yet. Check the time on the guest's pass or call the flat." };
  return { ok: false, icon: CircleX, title: 'No match', body: "That passcode doesn't match any active invite. Check the digits or log the visitor manually." };
};

export default function Gate() {
  const t = useTheme();
  const [code, setCode] = useState('');
  const [out, setOut] = useState<Outcome | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verify = useAct((passcode: string) => api<GateResult>('/gate/verify', { method: 'POST', body: { passcode } }), {
    quiet: true,
    invalidate: ['visitors', 'staff', 'preapprovals'],
    onSuccess: (r) => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); show(describe(r)); },
  });
  useEffect(() => {
    if (verify.isError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      show(failure(verify.error));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verify.isError]);

  function show(o: Outcome) {
    setOut(o);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(reset, 6000);
  }
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setOut(null);
    setCode('');
    verify.reset();
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Auto-verify on the 6th digit after 250 ms so the guard sees the last digit.
  useEffect(() => {
    if (code.length !== 6) return;
    const id = setTimeout(() => verify.mutate(code), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const press = (k: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (k === 'clear') setCode('');
    else if (k === 'back') setCode((c) => c.slice(0, -1));
    else setCode((c) => (c.length < 6 ? c + k : c));
  };

  if (out) {
    const tone = t.colors.status[out.ok ? 'success' : 'danger'];
    return (
      <Screen title="Verify passcode" refresh={false}>
        <View accessibilityLiveRegion="assertive" style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: tone.dot }}>
          <View style={{ backgroundColor: out.ok ? t.colors.brand : t.colors.danger, padding: 20, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <I icon={out.icon} size={40} color="#fff" />
            <Txt v="guardXl" color="#fff" style={{ flex: 1, fontSize: 28 }}>{out.title}</Txt>
          </View>
          <View style={{ backgroundColor: t.colors.surface, padding: 20, gap: 20 }}>
            <Txt v="guardBody">{out.body}</Txt>
            <Button title={out.ok ? 'Done' : 'Try again'} size="xl" variant={out.ok ? 'secondary' : 'primary'} onPress={reset} />
            {!out.ok && <Button title="Log visitor manually" size="xl" variant="outline" icon={UserRoundPlus} onPress={() => { reset(); router.navigate('/log'); }} />}
          </View>
        </View>
        <Txt v="body" c="fgMuted" style={{ textAlign: 'center' }}>Closes automatically in a few seconds · {formatDate(new Date())}</Txt>
      </Screen>
    );
  }

  return (
    <Screen title="Verify passcode" refresh={false}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }} accessible accessibilityLabel={`Passcode entered: ${code.split('').join(' ') || 'none'}`}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={{ flex: 1, maxWidth: 64, height: 76, borderRadius: 12, borderWidth: i === code.length ? 3 : 2, borderColor: i === code.length ? t.colors.focus : t.colors.lineStrong, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="guardXl" c="fgHeading" style={{ fontVariant: ['tabular-nums'] }}>{code[i] ?? ''}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((k) => (
          <Pressable key={k} onPress={() => press(k)} disabled={verify.isPending}
            accessibilityRole="button" accessibilityLabel={k === 'clear' ? 'Clear' : k === 'back' ? 'Backspace' : k}
            style={({ pressed }) => ({
              width: '31%', flexGrow: 1, height: 72, borderRadius: 12, borderWidth: 1, borderColor: t.colors.lineStrong,
              backgroundColor: pressed ? t.colors.surfaceSunken : t.colors.surface, alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            {k === 'back' ? <I icon={Delete} size={32} color={t.colors.fgHeading} />
              : <Txt v={k === 'clear' ? 'guardBody' : 'guardXl'} c="fgHeading">{k === 'clear' ? 'Clear' : k}</Txt>}
          </Pressable>
        ))}
      </View>
      <Button title={verify.isPending ? 'Verifying…' : 'Verify'} size="xl" disabled={code.length !== 6} loading={verify.isPending} onPress={() => verify.mutate(code)} />
      <Button title="Log a walk-in visitor" size="xl" variant="secondary" icon={UserRoundPlus} onPress={() => router.navigate('/log')} />
    </Screen>
  );
}
