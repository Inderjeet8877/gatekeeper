// §4.21 SOS: press-and-hold 2 s with a progress ring → type sheet → POST /sos → live status.
import * as Haptics from 'expo-haptics';
import { CircleCheck, Flame, HeartPulse, ShieldAlert, Siren, TriangleAlert } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api, errMsg, type SosAlert, type SosType } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { STATUS } from '@/lib/status';
import { useTheme } from '@/lib/theme';
import { Banner, Button, Chips, Field, I, Sheet, StatusChip, Txt, type Option } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 40;
const C = 2 * Math.PI * R;
const TYPES: Option<SosType>[] = [
  { value: 'MEDICAL', label: 'Medical', icon: HeartPulse },
  { value: 'FIRE', label: 'Fire', icon: Flame },
  { value: 'THEFT', label: 'Theft', icon: ShieldAlert },
  { value: 'OTHER', label: 'Other', icon: TriangleAlert },
];

export function SosButton() {
  const t = useTheme();
  const p = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  const [hint, setHint] = useState(false);
  const [open, setOpen] = useState(false);

  const start = () => {
    setHint(false);
    done.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    timer.current = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 1000);
    Animated.timing(p, { toValue: 1, duration: t.motion.duration.sosHold, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      done.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      p.setValue(0);
      setOpen(true);
    });
  };
  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    if (done.current) return;
    p.stopAnimation();
    setHint(true);
    Animated.timing(p, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  return (
    <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
      <Pressable
        onPressIn={start}
        onPressOut={release}
        accessibilityRole="button"
        accessibilityLabel="SOS"
        accessibilityHint="Press and hold for 2 seconds to alert security."
        accessibilityActions={[{ name: 'activate', label: 'Raise SOS' }]}
        onAccessibilityAction={() => setOpen(true)}
        style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginVertical: -8 }}
      >
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.danger, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#D14343', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
        }}>
          <I icon={Siren} size={28} color="#fff" />
        </View>
        <Svg width={88} height={88} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <AnimatedCircle cx={44} cy={44} r={R} stroke={t.colors.danger} strokeWidth={4} fill="none" strokeLinecap="round"
            strokeDasharray={`${C} ${C}`} strokeDashoffset={p.interpolate({ inputRange: [0, 1], outputRange: [C, 0] })} />
        </Svg>
      </Pressable>
      <Txt v="label" c="dangerFg">SOS</Txt>
      <Txt v="caption" c="fgSubtle">Hold 2 s</Txt>
      {hint && <Txt v="caption" c="fgMuted" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">Press and hold for 2 seconds to alert security.</Txt>}
      <SosSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

function SosSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [type, setType] = useState<SosType | null>(null);
  const [message, setMessage] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);
  const send = useAct((b: { type: SosType; message?: string }) => api<SosAlert>('/sos', { method: 'POST', body: b }), {
    invalidate: ['sos'], quiet: true, onSuccess: (a) => setSentId(a.id),
  });
  const close = () => {
    setType(null); setMessage(''); setSentId(null); send.reset();
    onClose();
  };
  const title = sentId ? 'Alert sent' : "What's the emergency?";
  return (
    <Sheet visible={visible} onClose={close} title={title} locked={!sentId}>
      {sentId ? (
        <SosStatus id={sentId} onDone={close} />
      ) : (
        <>
          <Txt v="bodySm" c="fgMuted">Guards on duty and the committee will be alerted with your flat number.</Txt>
          <Chips tiles tone="danger" options={TYPES} value={type} onChange={setType} />
          <Field label="Message" optional value={message} onChangeText={setMessage} maxLength={300} placeholder="e.g. Elderly parent fainted" />
          {send.isError && <Banner tone="danger" title="Alert not sent." body={`${errMsg(send.error)} You can also call security directly.`} />}
          <Button title="Send alert" variant="danger" size="lg" icon={Siren} disabled={!type} loading={send.isPending}
            onPress={() => type && send.mutate({ type, message: message.trim() || undefined })} />
          <Button title="Cancel" variant="ghost" onPress={close} disabled={send.isPending} />
        </>
      )}
    </Sheet>
  );
}

function SosStatus({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTheme();
  const q = useList<SosAlert>(['sos', 'mine'], '/sos?limit=20', { live: true });
  const a = q.data?.find((x) => x.id === id);
  const steps: [string, string | null | undefined][] = [
    ['Raised', a && `Alert sent at ${formatTime(a.createdAt)}`],
    ['Acknowledged', a?.acknowledgedAt && `${a.acknowledgedBy?.name ?? 'Security'} is on the way. Acknowledged at ${formatTime(a.acknowledgedAt)}.`],
    ['Resolved', a?.resolvedAt && `Marked resolved at ${formatTime(a.resolvedAt)}.`],
  ];
  return (
    <>
      <Banner tone="danger" icon={Siren} title={a ? `Alert sent at ${formatTime(a.createdAt)}` : 'Alert sent'} body="Security has been notified. Stay where you are if it is safe." />
      {a && <StatusChip spec={STATUS.sos[a.status]} icon />}
      <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
        {steps.map(([label, detail]) => (
          <View key={label} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <I icon={CircleCheck} color={detail ? t.colors.status.success.dot : t.colors.lineStrong} />
            <View style={{ flex: 1 }}>
              <Txt v="h4">{label}</Txt>
              <Txt v="bodySm" c="fgMuted">{detail ?? 'Waiting…'}</Txt>
            </View>
          </View>
        ))}
      </View>
      <Txt v="caption" c="fgSubtle">Alerts can't be cancelled from the app. Security will mark it resolved.</Txt>
      <Button title="Done" variant="outline" onPress={onDone} />
    </>
  );
}
