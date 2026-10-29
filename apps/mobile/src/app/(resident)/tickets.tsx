import { router } from 'expo-router';
import { LifeBuoy, Plus } from 'lucide-react-native';
import { Button, Empty, Q, Row, Screen, StatusChip } from '@/components/ui';
import type { Ticket } from '@/lib/api';
import { formatRelative, humanize } from '@/lib/format';
import { useList } from '@/lib/hooks';
import { STATUS, TICKET_ICON } from '@/lib/status';

export default function Tickets() {
  const q = useList<Ticket>(['tickets'], '/tickets?limit=100');
  return (
    <Screen back title="Helpdesk" footer={<Button title="Raise request" size="lg" icon={Plus} onPress={() => router.push('/ticket-new')} />}>
      <Q q={q} rows={4} empty={<Empty icon={LifeBuoy} title="No open requests" body="If something in the society needs attention, raise a request." />}>
        {(items) => items.map((x) => (
          <Row key={x.id} icon={TICKET_ICON[x.category]} title={x.title}
            subtitle={`${humanize(x.category)} · ${STATUS.priority[x.priority].label} priority · ${formatRelative(x.createdAt)}${x.commentCount ? ` · ${x.commentCount} comment${x.commentCount > 1 ? 's' : ''}` : ''}`}
            right={<StatusChip spec={STATUS.ticket[x.status]} />}
            onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: x.id } })} />
        ))}
      </Q>
    </Screen>
  );
}
