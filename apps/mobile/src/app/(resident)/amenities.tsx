import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { Empty, Q, Row, Screen } from '@/components/ui';
import type { Amenity } from '@/lib/api';
import { amenityLine } from '@/lib/format';
import { useList } from '@/lib/hooks';

export default function Amenities() {
  const q = useList<Amenity>(['amenities'], '/amenities');
  return (
    <Screen back title="Amenities">
      <Q q={q} rows={3} empty={<Empty icon={CalendarDays} title="No amenities yet" body="When the committee adds the clubhouse, pool or courts, you can book them here." />}>
        {(items) => items.map((a) => (
          <Row key={a.id} icon={CalendarDays} title={a.name} subtitle={`${a.description ? `${a.description}\n` : ''}${amenityLine(a)}`}
            onPress={() => router.push({ pathname: '/amenity/[id]', params: { id: a.id } })} />
        ))}
      </Q>
    </Screen>
  );
}
