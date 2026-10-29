import { router } from 'expo-router';
import { CalendarCheck, CalendarDays, HandHelping, LifeBuoy, type LucideIcon } from 'lucide-react-native';
import { Row, Screen } from '@/components/ui';
import type { Booking, Staff, Ticket } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function Services() {
  const { member } = useSession();
  const tickets = useList<Ticket>(['tickets'], '/tickets?limit=100');
  const bookings = useList<Booking>(['bookings'], '/bookings?status=CONFIRMED&limit=50');
  const staff = useList<Staff>(['staff'], `/staff?flatId=${member?.flat?.id ?? ''}`);
  const open = tickets.data?.filter((x) => x.status === 'OPEN' || x.status === 'IN_PROGRESS').length;
  const next = bookings.data?.filter((b) => new Date(b.startAt).getTime() > Date.now()).at(-1);
  const inside = staff.data?.filter((s) => s.isInside).length;

  return (
    <Screen title="Services">
      <Hub icon={LifeBuoy} title="Helpdesk" sub={open === undefined ? 'Raise and track requests' : open ? `${open} open request${open > 1 ? 's' : ''}` : 'No open requests'} to="/tickets" />
      <Hub icon={CalendarDays} title="Amenities" sub="Book the clubhouse, courts and pool" to="/amenities" />
      <Hub icon={CalendarCheck} title="My bookings" sub={next ? `Next: ${next.amenity.name}, ${formatRelative(next.startAt)}` : 'No upcoming bookings'} to="/bookings" />
      <Hub icon={HandHelping} title="Daily help" sub={inside === undefined ? 'Your staff and attendance' : `${inside} inside now · ${staff.data?.length ?? 0} linked`} to="/staff" />
    </Screen>
  );
}

function Hub({ icon, title, sub, to }: { icon: LucideIcon; title: string; sub: string; to: string }) {
  const t = useTheme();
  return <Row icon={icon} iconBg={t.colors.status.success.bg} iconColor={t.colors.brandFg} title={title} subtitle={sub} onPress={() => router.push(to as never)} />;
}
