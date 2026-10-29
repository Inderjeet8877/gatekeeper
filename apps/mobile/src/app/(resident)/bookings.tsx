import { router } from 'expo-router';
import { CalendarDays, CalendarX } from 'lucide-react-native';
import { Button, confirm, Empty, Q, Row, Screen, Section, StatusChip } from '@/components/ui';
import { api, type Booking } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { STATUS } from '@/lib/status';

export default function Bookings() {
  const q = useList<Booking>(['bookings', 'all'], '/bookings?limit=100');
  const cancel = useAct((id: string) => api<Booking>(`/bookings/${id}`, { method: 'DELETE' }), { invalidate: ['bookings'], success: 'Booking cancelled.' });
  const now = Date.now();
  const row = (b: Booking, upcoming: boolean) => (
    <Row key={b.id} icon={CalendarDays} title={b.amenity.name}
      subtitle={`${formatDate(b.startAt)}, ${formatTime(b.startAt)}–${formatTime(b.endAt)}`}
      right={<StatusChip spec={STATUS.booking[b.status]} />}>
      {upcoming && b.status === 'CONFIRMED' && (
        <Button title="Cancel booking" variant="dangerOutline" icon={CalendarX} loading={cancel.isPending && cancel.variables === b.id}
          onPress={async () => (await confirm(`Cancel ${b.amenity.name}?`, `${formatDate(b.startAt)}, ${formatTime(b.startAt)}. The slot will be released for others.`, 'Cancel booking')) && cancel.mutate(b.id)} />
      )}
    </Row>
  );
  return (
    <Screen back title="My bookings" footer={<Button title="Book an amenity" size="lg" onPress={() => router.push('/amenities')} />}>
      <Q q={q} rows={3} empty={<Empty icon={CalendarDays} title="No bookings yet" body="Book the clubhouse, courts or pool in a few taps." />}>
        {(items) => {
          const up = items.filter((b) => new Date(b.startAt).getTime() > now).reverse(); // soonest first
          const past = items.filter((b) => new Date(b.startAt).getTime() <= now);
          return (
            <>
              <Section title="Upcoming">
                {up.length ? up.map((b) => row(b, true)) : <Empty icon={CalendarDays} title="No upcoming bookings" />}
              </Section>
              {past.length > 0 && <Section title="Past">{past.map((b) => row(b, false))}</Section>}
            </>
          );
        }}
      </Q>
    </Screen>
  );
}
