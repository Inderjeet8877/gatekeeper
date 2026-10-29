import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Chips, Field, Screen, Segmented, Txt } from '@/components/ui';
import { api, errMsg, type Ticket, type TicketCategory, type TicketPriority } from '@/lib/api';
import { humanize } from '@/lib/format';
import { useAct } from '@/lib/hooks';
import { TICKET_ICON } from '@/lib/status';

const CATS = (Object.keys(TICKET_ICON) as TicketCategory[]).map((c) => ({ value: c, label: humanize(c), icon: TICKET_ICON[c] }));

export default function NewTicket() {
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const create = useAct(
    () => api<Ticket>('/tickets', { method: 'POST', body: { category, title: title.trim(), description: description.trim(), priority } }),
    { invalidate: ['tickets'], quiet: true, success: 'Request raised.', onSuccess: (t) => router.replace({ pathname: '/ticket/[id]', params: { id: t.id } }) },
  );
  const ok = category && title.trim() && description.trim();
  return (
    <Screen back title="Raise request" refresh={false} footer={<Button title="Raise request" size="lg" disabled={!ok} loading={create.isPending} onPress={() => create.mutate(undefined)} />}>
      <View style={{ gap: 8 }}>
        <Txt v="label">Category</Txt>
        <Chips value={category} onChange={setCategory} options={CATS} />
      </View>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} placeholder="e.g. Kitchen sink leaking" />
      <Field label="Description" value={description} onChangeText={setDescription} maxLength={2000} multiline
        style={{ minHeight: 96, textAlignVertical: 'top' }} placeholder="What happened, where, since when" helper={`${description.length} / 2000`} />
      <View style={{ gap: 8 }}>
        <Txt v="label">Priority</Txt>
        <Segmented<TicketPriority> value={priority} onChange={setPriority} options={[
          { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' },
        ]} />
      </View>
      {create.isError && <Banner tone="danger" title="Request not raised." body={errMsg(create.error)} />}
    </Screen>
  );
}
