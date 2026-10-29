import { Baby, Car, ChefHat, HandHelping, House, SprayCan, Sprout, UserRound, type LucideIcon } from 'lucide-react-native';
import { Empty, Q, Row, Screen, StatusChip, Txt } from '@/components/ui';
import type { Staff, StaffAttendance, StaffCategory } from '@/lib/api';
import { formatTime, humanize, istDay } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { STATUS } from '@/lib/status';

const STAFF_ICON: Record<StaffCategory, LucideIcon> = {
  MAID: House, COOK: ChefHat, DRIVER: Car, NANNY: Baby, CLEANER: SprayCan, GARDENER: Sprout, OTHER: UserRound,
};

export default function DailyHelp() {
  const { member } = useSession();
  const flat = member?.flat ? `${member.flat.block.name}-${member.flat.number}` : 'your flat';
  const q = useList<Staff>(['staff'], `/staff?flatId=${member?.flat?.id ?? ''}`);
  return (
    <Screen back title="Daily help" subtitle={`Staff linked to ${flat} · today's attendance`}>
      <Q q={q} rows={3} empty={<Empty icon={HandHelping} title={`No daily help linked to ${flat}`} body="Ask the society admin to register your maid, cook or driver and link them to your flat." />}>
        {(items) => items.map((s) => <StaffRow key={s.id} s={s} />)}
      </Q>
    </Screen>
  );
}

function StaffRow({ s }: { s: Staff }) {
  const att = useList<StaffAttendance>(['staff', s.id, 'attendance'], `/staff/${s.id}/attendance?date=${istDay().key}`);
  const today = att.data ?? [];
  return (
    <Row icon={STAFF_ICON[s.category]} title={s.name} subtitle={humanize(s.category)} right={<StatusChip spec={STATUS.staff[s.isInside ? 'IN' : 'OUT']} />}>
      <Txt v="bodySm" c="fgMuted" style={{ fontVariant: ['tabular-nums'] }}>
        {att.isPending ? 'Loading today…' : att.isError ? "Couldn't load today's attendance." : today.length === 0 ? 'Not seen today.'
          : today.map((a) => `In ${formatTime(a.checkInAt)}${a.checkOutAt ? ` · Out ${formatTime(a.checkOutAt)}` : ''}`).join('\n')}
      </Txt>
    </Row>
  );
}
