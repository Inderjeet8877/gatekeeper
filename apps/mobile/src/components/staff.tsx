import { Baby, Car, ChefHat, House, SprayCan, Sprout, UserRound, type LucideIcon } from 'lucide-react-native';
import { Row, StatusChip, Txt } from '@/components/ui';
import type { Staff, StaffAttendance, StaffCategory } from '@/lib/api';
import { formatTime, humanize, istDay } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { STATUS } from '@/lib/status';

const STAFF_ICON: Record<StaffCategory, LucideIcon> = {
  MAID: House, COOK: ChefHat, DRIVER: Car, NANNY: Baby, CLEANER: SprayCan, GARDENER: Sprout, OTHER: UserRound,
};

/** Daily-help row: inside/not-in chip plus today's (IST) check-ins and check-outs. */
export function StaffRow({ s, flats }: { s: Staff; flats?: boolean }) {
  const att = useList<StaffAttendance>(['staff', s.id, 'attendance'], `/staff/${s.id}/attendance?date=${istDay().key}`);
  const today = att.data ?? [];
  const subtitle = humanize(s.category) + (flats ? ` · ${s.flats.map((f) => f.label).join(', ') || 'No flat'}` : '');
  return (
    <Row icon={STAFF_ICON[s.category]} title={s.name} subtitle={subtitle} right={<StatusChip spec={STATUS.staff[s.isInside ? 'IN' : 'OUT']} />}>
      <Txt v="bodySm" c="fgMuted" style={{ fontVariant: ['tabular-nums'] }}>
        {att.isPending ? 'Loading today…' : att.isError ? "Couldn't load today's attendance." : today.length === 0 ? 'Not seen today.'
          : today.map((a) => `In ${formatTime(a.checkInAt)}${a.checkOutAt ? ` · Out ${formatTime(a.checkOutAt)}` : ''}`).join('\n')}
      </Txt>
    </Row>
  );
}
