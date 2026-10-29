import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Archive, RotateCcw, Send } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, confirm, Field, Q, Screen, Section, StatusChip, Txt } from '@/components/ui';
import { api, type Ticket, type TicketComment, type TicketStatus } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { useAct } from '@/lib/hooks';
import { STATUS, TICKET_ICON } from '@/lib/status';
import { useTheme } from '@/lib/theme';

export default function TicketDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ['tickets', id], queryFn: () => api<Ticket>(`/tickets/${id}`) });
  const [body, setBody] = useState('');
  const comment = useAct(() => api<TicketComment>(`/tickets/${id}/comments`, { method: 'POST', body: { body: body.trim() } }), {
    invalidate: ['tickets'], onSuccess: () => setBody(''),
  });
  const setStatus = useAct((status: TicketStatus) => api<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: { status } }), {
    invalidate: ['tickets'], success: (r) => (r.status === 'CLOSED' ? 'Request closed.' : 'Request reopened.'),
  });

  return (
    <Screen back title="Request" footer={
      q.data && q.data.status !== 'CLOSED' ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Add a comment" value={body} onChangeText={setBody} maxLength={2000} multiline placeholder="Write an update" />
          </View>
          <Button title="Send" icon={Send} disabled={!body.trim()} loading={comment.isPending} onPress={() => comment.mutate(undefined)} style={{ minHeight: 52 }} />
        </View>
      ) : undefined
    }>
      <Q q={q} rows={3}>
        {(x) => (
          <>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <StatusChip spec={STATUS.ticket[x.status]} icon />
                <StatusChip spec={STATUS.priority[x.priority]} icon label={`${STATUS.priority[x.priority].label} priority`} />
                <Badge label={humanize(x.category)} icon={TICKET_ICON[x.category]} />
              </View>
              <Txt v="h2" c="fgHeading">{x.title}</Txt>
              <Txt v="body">{x.description}</Txt>
              <Txt v="caption" c="fgSubtle">
                Raised by {x.raisedBy.name} · {formatDateTime(x.createdAt)}{x.assignedTo ? ` · Assigned to ${x.assignedTo.name}` : ''}
              </Txt>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {x.status === 'RESOLVED' && (
                  <Button title="Reopen" variant="outline" icon={RotateCcw} style={{ flex: 1 }} loading={setStatus.isPending && setStatus.variables === 'OPEN'} onPress={() => setStatus.mutate('OPEN')} />
                )}
                {x.status !== 'CLOSED' && (
                  <Button title="Close request" variant="ghost" icon={Archive} style={{ flex: 1 }} loading={setStatus.isPending && setStatus.variables === 'CLOSED'}
                    onPress={async () => (await confirm('Close this request?', 'Closed requests cannot be reopened. Raise a new one if the issue returns.', 'Close request')) && setStatus.mutate('CLOSED')} />
                )}
              </View>
            </Card>
            <Section title={`Comments${x.comments?.length ? ` · ${x.comments.length}` : ''}`}>
              {!x.comments?.length && <Txt v="bodySm" c="fgMuted">No comments yet. The committee will post updates here.</Txt>}
              {x.comments?.map((c) => (
                <View key={c.id} style={{ backgroundColor: c.author.role === 'ADMIN' ? t.colors.status.info.bg : t.colors.surface, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: t.colors.line }}>
                  <Txt v="label">{c.author.name}{c.author.role === 'ADMIN' ? ' · Committee' : ''}</Txt>
                  <Txt v="body">{c.body}</Txt>
                  <Txt v="caption" c="fgSubtle">{formatDateTime(c.createdAt)}</Txt>
                </View>
              ))}
            </Section>
          </>
        )}
      </Q>
    </Screen>
  );
}
