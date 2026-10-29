import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeftRight, Bell, IndianRupee, LogOut } from 'lucide-react-native';
import { View } from 'react-native';
import { Badge, Button, Card, confirm, Row, Screen, Txt } from '@/components/ui';
import { api, API_URL, type Invoice, type Notification } from '@/lib/api';
import { formatINR, formatPhone, humanize } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function Profile() {
  const t = useTheme();
  const s = useSession();
  const m = s.member!;
  const flat = m.flat ? `${m.flat.block.name}-${m.flat.number}` : '';
  const due = (useList<Invoice>(['invoices', 'due'], '/invoices?limit=24').data ?? []).filter((i) => i.status !== 'PAID').reduce((a, i) => a + i.amount, 0);
  const unread = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api<{ unreadCount: number; items: Notification[] }>('/notifications?limit=1', { society: false }),
  }).data?.unreadCount ?? 0;
  const initials = (s.user?.name ?? '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Screen title="Profile">
      <Card style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.status.info.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="h2" color={t.colors.status.info.fg}>{initials}</Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt v="h3" c="fgHeading">{s.user?.name}</Txt>
          <Txt v="bodySm" c="fgMuted">{s.user ? formatPhone(s.user.phone) : ''}</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Badge label={flat} />
            {m.residentType && <Badge label={humanize(m.residentType)} />}
          </View>
        </View>
      </Card>
      <Txt v="bodySm" c="fgMuted">{m.society.name}, {m.society.city}</Txt>

      <Row icon={IndianRupee} title="Payments" subtitle={due ? `${formatINR(due)} due` : "You're all paid up"} onPress={() => router.push('/payments')} />
      <Row icon={Bell} title="Notifications" subtitle={unread ? `${unread} unread` : "You're up to date"} onPress={() => router.push('/notifications')} />
      {s.memberships.length > 1 && (
        <Row icon={ArrowLeftRight} title="Switch society" subtitle={`${s.memberships.length} memberships`} onPress={() => s.select(null)} />
      )}
      <Button title="Sign out" variant="outline" icon={LogOut}
        onPress={async () => (await confirm('Sign out?', 'You will stop receiving visitor requests on this phone.', 'Sign out')) && s.signOut()} />
      <Txt v="caption" c="fgSubtle" style={{ textAlign: 'center' }}>Gatekeeper · {API_URL.replace(/^https?:\/\//, '')}</Txt>
    </Screen>
  );
}
