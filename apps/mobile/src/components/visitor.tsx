import * as Haptics from 'expo-haptics';
import { Car, Check, Package, UserRound, Wrench, X, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { api, type Visitor, type VisitorType } from '@/lib/api';
import { formatCountdown, formatRelative, formatTime, humanize, maskPhone } from '@/lib/format';
import { useAct } from '@/lib/hooks';
import { STATUS } from '@/lib/status';
import { useTheme } from '@/lib/theme';
import { Button, Card, confirm, I, Row, StatusChip, Threshold, Txt, useNow } from './ui';

export const VTYPE: Record<VisitorType, LucideIcon> = { GUEST: UserRound, DELIVERY: Package, CAB: Car, SERVICE: Wrench };

const DONE: Partial<Record<Visitor['status'], string>> = {
  APPROVED: 'Entry approved. The guard has been told.',
  DENIED: 'Entry denied. The guard has been told.',
  LEFT_AT_GATE: "The guard will keep the parcel at the gate. We'll remind you to collect it.",
};

/** §4.20 Visitor approval card — the hero component (pinned on Home and in Visitors → Pending). */
export function ApprovalCard({ v }: { v: Visitor }) {
  const t = useTheme();
  const now = useNow(1000);
  const left = v.expiresAt ? new Date(v.expiresAt).getTime() - now : 0;
  const decide = useAct(
    (decision: 'APPROVE' | 'DENY' | 'LEAVE_AT_GATE') => api<Visitor>(`/visitors/${v.id}/decision`, { method: 'POST', body: { decision } }),
    {
      invalidate: ['visitors'],
      success: (r) => DONE[r.status] ?? 'Response sent.',
      onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
    },
  );
  const busy = decide.isPending ? decide.variables : null;
  const deny = async () => {
    if (await confirm(`Deny entry to ${v.name}?`, 'The guard will ask them to leave.', 'Deny entry')) decide.mutate('DENY');
  };

  return (
    <Card style={{ gap: 14 }}>
      <Threshold />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt v="caption" c="fgMuted" style={{ flex: 1 }}>At the gate · logged by {v.loggedBy.name}</Txt>
        <StatusChip spec={{ ...STATUS.visitor.PENDING_APPROVAL, tone: left < 120_000 ? 'danger' : 'warning' }} label={`${formatCountdown(left)} left`} />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }} accessible accessibilityLabel={`Visitor at the gate: ${v.name}, ${humanize(v.type)}${v.company ? ` from ${v.company}` : ''} for ${v.flat.label}`}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.status.neutral.bg, alignItems: 'center', justifyContent: 'center' }}>
          <I icon={VTYPE[v.type]} size={30} color={t.colors.fgHeading} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="displayLg" c="fgHeading" numberOfLines={1}>{v.name}</Txt>
          <Txt v="bodySm" c="fgMuted">{humanize(v.type)}{v.company ? ` · ${v.company}` : ''} · For {v.flat.label}</Txt>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Fact k="Arrived" val={formatTime(v.createdAt)} />
        {v.phone && <Fact k="Phone" val={maskPhone(v.phone)} />}
        {v.vehicleNo && <Fact k="Vehicle" val={v.vehicleNo} />}
        {v.purpose && <Fact k="Purpose" val={v.purpose} />}
      </View>
      <View style={{ gap: 10 }}>
        {v.type === 'DELIVERY' && (
          <Button title="Leave at gate" variant="outline" size="lg" icon={Package} loading={busy === 'LEAVE_AT_GATE'} disabled={!!busy} onPress={() => decide.mutate('LEAVE_AT_GATE')} />
        )}
        <Button title="Deny" variant="dangerOutline" size="lg" icon={X} loading={busy === 'DENY'} disabled={!!busy} onPress={deny} />
        <Button title="Approve entry" size="lg" icon={Check} loading={busy === 'APPROVE'} disabled={!!busy} onPress={() => decide.mutate('APPROVE')} />
      </View>
      <Txt v="caption" c="fgSubtle">Respond within 10 minutes. After that the request expires and the guard will call you.</Txt>
    </Card>
  );
}

function Fact({ k, val }: { k: string; val: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Txt v="bodySm" c="fgSubtle" style={{ width: 72 }}>{k}</Txt>
      <Txt v="bodySm" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>{val}</Txt>
    </View>
  );
}

/** One visitor in a history/feed list. */
export function VisitorRow({ v, children, masked }: { v: Visitor; children?: ReactNode; masked?: boolean }) {
  const t = useTheme();
  const when = v.checkInAt
    ? `In ${formatTime(v.checkInAt)}${v.checkOutAt ? ` · Out ${formatTime(v.checkOutAt)}` : ''}`
    : formatRelative(v.createdAt);
  const sub = [`${humanize(v.type)}${v.company ? ` · ${v.company}` : ''}`, v.flat.label, when, masked && v.phone ? maskPhone(v.phone) : null]
    .filter(Boolean).join(' · ');
  return (
    <Row icon={VTYPE[v.type]} title={v.name} subtitle={sub} right={<StatusChip spec={STATUS.visitor[v.status]} />}
      iconBg={t.colors.status[STATUS.visitor[v.status].tone].bg} iconColor={t.colors.status[STATUS.visitor[v.status].tone].fg}
      a11y={`${v.name}, ${humanize(v.type)}, ${v.flat.label}, ${STATUS.visitor[v.status].label}, ${when}`}>
      {children}
    </Row>
  );
}

