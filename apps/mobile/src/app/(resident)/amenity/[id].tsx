import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Banner, Button, Card, Empty, I, Q, Screen, Section, Txt } from '@/components/ui';
import { api, errMsg, type Amenity, type Booking, type List, type Slot } from '@/lib/api';
import { amenityLine, formatINR, formatTime, istDay } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

export default function AmenityBook() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const amenity = useList<Amenity>(['amenities'], '/amenities').data?.find((a) => a.id === id);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => istDay(i)), []);
  const [day, setDay] = useState(days[0].key);
  const [pick, setPick] = useState<Slot | null>(null);
  const slots = useQuery({
    queryKey: ['bookings', 'availability', id, day],
    queryFn: () => api<List<Slot>>(`/amenities/${id}/availability?date=${day}`).then((r) => r.items),
  });
  const mine = useList<Booking>(['bookings', id, day], `/bookings?amenityId=${id}&date=${day}&status=CONFIRMED`);
  const book = useAct(() => api<Booking>('/bookings', { method: 'POST', body: { amenityId: id, startAt: pick!.startAt } }), {
    invalidate: ['bookings'], quiet: true, success: 'Slot booked.', onSuccess: () => router.replace('/bookings'),
  });
  const now = Date.now();
  const visible = (slots.data ?? []).filter((s) => new Date(s.startAt).getTime() > now);
  const fullErr = book.error && ['SLOT_FULL', 'CONFLICT'].includes((book.error as { code?: string }).code ?? '');

  return (
    <Screen back title={amenity?.name ?? 'Book'} subtitle={amenity ? amenityLine(amenity) : undefined} footer={
      pick && amenity ? (
        <>
          <Txt v="label" style={{ fontVariant: ['tabular-nums'] }}>
            {days.find((d) => d.key === day)?.weekday} {days.find((d) => d.key === day)?.day} {days.find((d) => d.key === day)?.month}, {formatTime(pick.startAt)}–{formatTime(pick.endAt)}
            {amenity.pricePerSlot ? ` · ${formatINR(amenity.pricePerSlot)}` : ''}
          </Txt>
          <Button title="Book slot" size="lg" loading={book.isPending} onPress={() => book.mutate(undefined)} />
        </>
      ) : undefined
    }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {days.map((d, i) => {
          const sel = d.key === day;
          return (
            <Pressable key={d.key} onPress={() => { setDay(d.key); setPick(null); book.reset(); }} accessibilityRole="radio" accessibilityState={{ selected: sel }}
              accessibilityLabel={i === 0 ? 'Today' : `${d.weekday} ${d.day} ${d.month}`}
              style={{ width: 56, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? t.colors.navy : t.colors.surface, borderWidth: 1, borderColor: sel ? t.colors.navy : t.colors.line }}>
              <Txt v="caption" color={sel ? '#fff' : t.colors.fgMuted}>{i === 0 ? 'Today' : d.weekday}</Txt>
              <Txt v="h4" color={sel ? '#fff' : t.colors.fgHeading}>{d.day}</Txt>
            </Pressable>
          );
        })}
        <View style={{ width: 8 }} />
      </ScrollView>

      {fullErr ? <Banner tone="warning" title="That slot just filled up. Pick another time." /> : book.isError && <Banner tone="danger" title="Not booked." body={errMsg(book.error)} />}

      <Section title="Available slots">
        <Q q={slots} rows={2}>
          {() => visible.length === 0 ? (
            <Empty icon={CalendarCheck} title="No slots left on this day" body="Pick another date from the strip above." />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
              {visible.map((s) => {
                const yours = mine.data?.some((b) => b.startAt === s.startAt);
                const full = s.available === 0;
                const sel = pick?.startAt === s.startAt;
                const bg = sel ? t.colors.brand : yours ? t.colors.status.success.bg : full ? t.colors.surfaceSunken : t.colors.surface;
                const fg = sel ? '#fff' : yours ? t.colors.status.success.fg : full ? t.colors.fgSubtle : t.colors.fg;
                const few = !full && s.available / s.capacity <= 0.25;
                return (
                  <Pressable key={s.startAt} disabled={full || yours} onPress={() => setPick(s)} accessibilityRole="radio"
                    accessibilityState={{ selected: sel, disabled: full || yours }}
                    accessibilityLabel={`${formatTime(s.startAt)} to ${formatTime(s.endAt)}, ${yours ? 'your booking' : full ? 'full' : `${s.available} of ${s.capacity} places left`}`}
                    style={{ flexBasis: '30%', flexGrow: 1, maxWidth: '32%', minHeight: 56, borderRadius: 10, padding: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: 1, borderColor: sel ? t.colors.brand : full ? t.colors.line : t.colors.lineStrong }}>
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      {(sel || yours) && <I icon={sel ? Check : CalendarCheck} size={14} color={fg} />}
                      <Txt v="label" color={fg} style={{ fontVariant: ['tabular-nums'] }}>{formatTime(s.startAt)}</Txt>
                    </View>
                    <Txt v="caption" color={few && !sel ? t.colors.status.warning.fg : fg}>
                      {yours ? 'Your booking' : full ? 'Full' : s.capacity > 1 ? `${s.available} of ${s.capacity} left` : 'Available'}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Q>
      </Section>
      {amenity?.description && <Card><Txt v="bodySm" c="fgMuted">{amenity.description} · Up to {amenity.capacity} flat{amenity.capacity > 1 ? 's' : ''} per slot.</Txt></Card>}
    </Screen>
  );
}
