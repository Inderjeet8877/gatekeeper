import { CalendarClock } from 'lucide-react-native';
import { Empty, Q, Row, Screen, Txt } from '@/components/ui';
import { VTYPE } from '@/components/visitor';
import type { PreApproval } from '@/lib/api';
import { formatRelative, humanize } from '@/lib/format';
import { useList } from '@/lib/hooks';

export default function Expected() {
  // Guards get today's ACTIVE invites with passcode hidden (spec §4.6).
  const q = useList<PreApproval>(['preapprovals', 'expected'], '/preapprovals?status=ACTIVE&limit=200', { live: true });
  return (
    <Screen title="Expected today">
      <Txt v="body" c="fgMuted">Ask the guest for their 6-digit passcode and verify it on the Gate tab.</Txt>
      <Q q={q} rows={4} empty={<Empty icon={CalendarClock} title="No guests expected today" body="Invites created by residents will appear here." />}>
        {(items) => items.map((p) => (
          <Row key={p.id} icon={VTYPE[p.type]} title={p.guestName}
            subtitle={`${humanize(p.type)} · ${p.flat.label} · Until ${formatRelative(p.validTo).replace(/^Today, /, '')} · ${p.maxUses - p.usedCount} entr${p.maxUses - p.usedCount === 1 ? 'y' : 'ies'} left`} />
        ))}
      </Q>
    </Screen>
  );
}
