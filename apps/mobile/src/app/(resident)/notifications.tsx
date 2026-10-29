import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Button, Card, Empty, Q, Screen, Txt } from '@/components/ui';
import { api, type Notification } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useAct } from '@/lib/hooks';
import { useTheme } from '@/lib/theme';

export default function Notifications() {
  const t = useTheme();
  const q = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api<{ items: Notification[]; unreadCount: number }>('/notifications?limit=100', { society: false }),
  });
  const read = useAct((id: string) => api(`/notifications/${id}/read`, { method: 'POST', society: false }), { invalidate: ['notifications'] });
  const readAll = useAct(() => api('/notifications/read-all', { method: 'POST', society: false }), { invalidate: ['notifications'], success: 'All caught up.' });

  return (
    <Screen back title="Notifications" right={q.data?.unreadCount ? (
      <Button title="Mark all read" variant="ghost" icon={CheckCheck} loading={readAll.isPending} onPress={() => readAll.mutate(undefined)} />
    ) : undefined}>
      <Q q={q} rows={5}>
        {(d) => d.items.length === 0 ? (
          <Empty icon={Bell} title="You're up to date." body="Visitor requests, notices and payment receipts will appear here." />
        ) : d.items.map((n) => (
          <Pressable key={n.id} onPress={() => !n.readAt && read.mutate(n.id)} accessibilityRole="button"
            accessibilityLabel={`${n.readAt ? '' : 'Unread. '}${n.title}. ${n.body}`}>
            <Card style={{ flexDirection: 'row', gap: 12, paddingVertical: 14 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: n.readAt ? 'transparent' : t.colors.navy }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="h4" c={n.readAt ? 'fgMuted' : 'fgHeading'}>{n.title}</Txt>
                <Txt v="bodySm" c="fgMuted">{n.body}</Txt>
                <Txt v="caption" c="fgSubtle">{formatRelative(n.createdAt)}</Txt>
              </View>
            </Card>
          </Pressable>
        ))}
      </Q>
    </Screen>
  );
}
