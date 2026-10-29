import { router } from 'expo-router';
import { Bell, CalendarDays, IndianRupee, LifeBuoy, Megaphone, Pin, Ticket, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { SosButton } from '@/components/sos';
import { Button, Card, Empty, I, IconButton, Q, Screen, Section, Skeleton, StatusChip, Txt } from '@/components/ui';
import { ApprovalCard, VisitorRow } from '@/components/visitor';
import { api, type Invoice, type Notice, type Notification, type Visitor } from '@/lib/api';
import { formatDate, formatINR, formatRelative, formatWeekdayDate, greeting, istDay } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { STATUS } from '@/lib/status';
import { useTheme } from '@/lib/theme';
import { useQuery } from '@tanstack/react-query';

export default function Home() {
  const t = useTheme();
  const { user, member } = useSession();
  const flat = member?.flat ? `${member.flat.block.name}-${member.flat.number}` : '';
  const pending = useList<Visitor>(['visitors', 'pending'], '/visitors?status=PENDING_APPROVAL', { live: true });
  const today = useList<Visitor>(['visitors', 'today'], `/visitors?date=${istDay().key}&limit=5`, { live: true });
  const notices = useList<Notice>(['notices', 'latest'], '/notices?limit=2');
  const dues = useList<Invoice>(['invoices', 'due'], '/invoices?limit=24');
  const unread = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api<{ unreadCount: number; items: Notification[] }>('/notifications?limit=1', { society: false }),
  }).data?.unreadCount ?? 0;
  const unpaid = dues.data?.filter((i) => i.status !== 'PAID') ?? [];
  const totalDue = unpaid.reduce((s, i) => s + i.amount, 0);

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, minHeight: 56 }}>
          <Txt v="label" c="fgMuted" style={{ flex: 1 }} numberOfLines={1}>{member?.society.name} · {flat}</Txt>
          <IconButton icon={Bell} label={unread ? `Notifications, ${unread} unread` : 'Notifications'} badge={unread} color={t.colors.fgHeading} onPress={() => router.push('/notifications')} />
        </View>
      }
    >
      <View>
        <Txt v="displayLg" c="fgHeading" accessibilityRole="header">{greeting()}, {user?.name.split(' ')[0]}</Txt>
        <Txt v="bodySm" c="fgMuted">{formatWeekdayDate()}</Txt>
      </View>

      {pending.data?.map((v) => <ApprovalCard key={v.id} v={v} />)}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Quick icon={Ticket} label="Invite guest" onPress={() => router.push('/invite')} />
        <Quick icon={LifeBuoy} label="Raise ticket" onPress={() => router.push('/ticket-new')} />
        <Quick icon={CalendarDays} label="Book amenity" onPress={() => router.push('/amenities')} />
        <SosButton />
      </View>

      <Section title={`Today at ${flat}`} action={{ label: 'See all', onPress: () => router.navigate('/visitors') }}>
        <Q q={today} rows={2} empty={
          <Empty icon={Ticket} title="No visitors yet today" body="Expecting someone? Pre-approve them for a faster entry."
            action={<Button title="Invite guest" variant="outline" onPress={() => router.push('/invite')} />} />
        }>
          {(items) => items.map((v) => <VisitorRow key={v.id} v={v} />)}
        </Q>
      </Section>

      {dues.isPending ? <Skeleton rows={1} height={120} /> : unpaid.length > 0 && (
        <Card accent={unpaid.some((i) => i.status === 'OVERDUE') ? t.colors.status.warning.dot : undefined} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt v="h3" c="fgHeading">Maintenance dues</Txt>
            <StatusChip spec={STATUS.invoice[unpaid.some((i) => i.status === 'OVERDUE') ? 'OVERDUE' : 'UNPAID']} />
          </View>
          <Txt v="numericLg" c="fgHeading">{formatINR(totalDue)}</Txt>
          <Txt v="bodySm" c="fgMuted">{unpaid.length} invoice{unpaid.length > 1 ? 's' : ''} · next due {formatDate(unpaid[unpaid.length - 1].dueDate)}</Txt>
          <Button title={`Pay ${formatINR(totalDue)}`} icon={IndianRupee} onPress={() => router.push('/payments')} />
        </Card>
      )}

      <Section title="Notices" action={{ label: 'See all', onPress: () => router.navigate('/community') }}>
        <Q q={notices} rows={2} empty={<Empty icon={Megaphone} title="No notices yet" body="Notices from the committee will appear here." />}>
          {(items) => items.map((n) => (
            <Card key={n.id} onPress={() => router.navigate('/community')} style={{ gap: 4, paddingVertical: 14 }} a11y={`${n.isPinned ? 'Pinned. ' : ''}${n.title}`}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {n.isPinned && <I icon={Pin} size={14} color={t.colors.status.info.dot} />}
                <Txt v="h4" style={{ flex: 1 }} numberOfLines={1}>{n.title}</Txt>
              </View>
              <Txt v="bodySm" c="fgMuted" numberOfLines={2}>{n.body}</Txt>
              <Txt v="caption" c="fgSubtle">{formatRelative(n.createdAt)}</Txt>
            </Card>
          ))}
        </Q>
      </Section>
    </Screen>
  );
}

function Quick({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center', ...(t.isDark ? { borderWidth: 1, borderColor: t.colors.line } : t.shadows.card) }}>
        <I icon={icon} size={26} color={t.colors.brandFg} />
      </View>
      <Txt v="caption" c="fg" style={{ textAlign: 'center' }}>{label}</Txt>
    </Pressable>
  );
}
