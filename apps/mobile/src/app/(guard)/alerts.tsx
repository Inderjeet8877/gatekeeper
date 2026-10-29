import { CircleCheck, Flame, HeartPulse, Phone, ShieldAlert, ShieldCheck, Siren, TriangleAlert } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { Button, Card, Empty, I, Q, Screen, Section, StatusChip, Txt } from '@/components/ui';
import { api, type SosAlert, type SosType } from '@/lib/api';
import { formatRelative, formatTime, maskPhone } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { sosTitle } from '@/lib/realtime';
import { STATUS } from '@/lib/status';
import { useTheme } from '@/lib/theme';

const SOS_ICON: Record<SosType, typeof Siren> = { MEDICAL: HeartPulse, FIRE: Flame, THEFT: ShieldAlert, OTHER: TriangleAlert };

export default function Alerts() {
  const q = useList<SosAlert>(['sos', 'all'], '/sos?limit=50', { live: true });
  const act = useAct(({ id, status }: { id: string; status: 'ACKNOWLEDGED' | 'RESOLVED' }) => api<SosAlert>(`/sos/${id}`, { method: 'PATCH', body: { status } }), {
    invalidate: ['sos'], success: (a) => (a.status === 'ACKNOWLEDGED' ? 'Acknowledged. The resident has been told you are on the way.' : 'Marked resolved.'),
  });
  return (
    <Screen title="SOS alerts">
      <Q q={q} rows={3} empty={<Empty icon={CircleCheck} title="No active alerts" body="Emergency alerts from residents appear here and on every screen." />}>
        {(items) => {
          const active = items.filter((a) => a.status !== 'RESOLVED').sort((a, b) => (a.status === 'RAISED' ? -1 : 0) - (b.status === 'RAISED' ? -1 : 0));
          const past = items.filter((a) => a.status === 'RESOLVED');
          return (
            <>
              {active.length === 0 && <Empty icon={CircleCheck} title="No active alerts" body="Emergency alerts from residents appear here and on every screen." />}
              {active.map((a) => (
                <AlertCard key={a.id} a={a} busy={act.isPending && act.variables?.id === a.id} onSet={(status) => act.mutate({ id: a.id, status })} />
              ))}
              {past.length > 0 && <Section title="Resolved">{past.map((a) => <AlertCard key={a.id} a={a} />)}</Section>}
            </>
          );
        }}
      </Q>
    </Screen>
  );
}

function AlertCard({ a, busy, onSet }: { a: SosAlert; busy?: boolean; onSet?: (s: 'ACKNOWLEDGED' | 'RESOLVED') => void }) {
  const t = useTheme();
  const raised = a.status === 'RAISED';
  return (
    <Card style={{ padding: 0, overflow: 'hidden', borderWidth: raised ? 2 : 1, borderColor: raised ? t.colors.danger : t.colors.lineStrong }}>
      {a.status !== 'RESOLVED' && (
        <View style={{ backgroundColor: raised ? t.colors.danger : t.colors.status.warning.bg, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <I icon={SOS_ICON[a.type]} size={36} color={raised ? '#fff' : t.colors.status.warning.fg} />
          <Txt v="guardBody" color={raised ? '#fff' : t.colors.status.warning.fg} style={{ flex: 1, fontFamily: t.fonts.bold, fontSize: 22 }}>{sosTitle(a)}</Txt>
        </View>
      )}
      <View style={{ padding: 16, gap: 12 }}>
        {a.status === 'RESOLVED' && <Txt v="guardBody" style={{ fontFamily: t.fonts.semibold }}>{sosTitle(a)}</Txt>}
        <StatusChip spec={STATUS.sos[a.status]} icon />
        <Txt v="guardBody">Raised by {a.raisedBy.name} at {formatTime(a.createdAt)} ({formatRelative(a.createdAt)}).</Txt>
        {!!a.message && <Txt v="guardBody" c="fgMuted">“{a.message}”</Txt>}
        {a.acknowledgedBy && <Txt v="body" c="fgMuted">Acknowledged by {a.acknowledgedBy.name}{a.acknowledgedAt ? ` at ${formatTime(a.acknowledgedAt)}` : ''}.</Txt>}
        {a.resolvedAt && <Txt v="body" c="fgMuted">Resolved at {formatTime(a.resolvedAt)}.</Txt>}
        {onSet && (
          <>
            <Button title={`Call ${maskPhone(a.raisedBy.phone)}`} size="xl" variant="outline" icon={Phone} onPress={() => Linking.openURL(`tel:${a.raisedBy.phone}`)} />
            {raised && <Button title="Acknowledge — I'm on the way" size="xl" icon={ShieldCheck} loading={busy} onPress={() => onSet('ACKNOWLEDGED')} />}
            <Button title="Mark resolved" size="xl" variant="secondary" icon={CircleCheck} loading={busy && !raised} disabled={busy} onPress={() => onSet('RESOLVED')} />
          </>
        )}
      </View>
    </Card>
  );
}
