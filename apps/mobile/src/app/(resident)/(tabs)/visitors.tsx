import { router } from 'expo-router';
import { CircleCheck, PackageCheck, Share2, Ticket, UserRoundCheck, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { shareInvite } from '@/components/invite';
import { Button, confirm, Empty, Q, Row, Screen, Segmented, StatusChip } from '@/components/ui';
import { ApprovalCard, VisitorRow, VTYPE } from '@/components/visitor';
import { api, type PreApproval, type Visitor } from '@/lib/api';
import { formatDateTime, formatPasscode, humanize } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { STATUS } from '@/lib/status';

type Seg = 'pending' | 'history' | 'invites';

export default function Visitors() {
  const [seg, setSeg] = useState<Seg>('pending');
  const { member } = useSession();
  const pending = useList<Visitor>(['visitors', 'pending'], '/visitors?status=PENDING_APPROVAL', { live: true });
  const history = useList<Visitor>(['visitors', 'history'], '/visitors?limit=100', { live: true, enabled: seg === 'history' });
  const invites = useList<PreApproval>(['preapprovals'], '/preapprovals?limit=100', { enabled: seg === 'invites' });
  const collect = useAct((id: string) => api<Visitor>(`/visitors/${id}/collect`, { method: 'POST' }), { invalidate: ['visitors'], success: 'Marked as collected.' });
  const cancel = useAct((id: string) => api<PreApproval>(`/preapprovals/${id}`, { method: 'DELETE' }), { invalidate: ['preapprovals'], success: 'Invite cancelled.' });

  return (
    <Screen title="Visitors" footer={<Button title="Invite guest" size="lg" icon={Ticket} onPress={() => router.push('/invite')} />}>
      <Segmented<Seg> value={seg} onChange={setSeg} options={[
        { value: 'pending', label: pending.data?.length ? `Pending ${pending.data.length}` : 'Pending' },
        { value: 'history', label: 'History' },
        { value: 'invites', label: 'Invites' },
      ]} />

      {seg === 'pending' && (
        <Q q={pending} empty={<Empty icon={CircleCheck} title="Nothing waiting for you" body="When the guard logs a visitor for your flat, you'll approve or deny them here." />}>
          {(items) => items.map((v) => <ApprovalCard key={v.id} v={v} />)}
        </Q>
      )}

      {seg === 'history' && (
        <Q q={history} rows={5} empty={<Empty icon={UserRoundCheck} title="No visitors yet" body="Expecting someone? Pre-approve them for a faster entry." />}>
          {(items) => items.map((v) => (
            <VisitorRow key={v.id} v={v}>
              {v.status === 'LEFT_AT_GATE' && (
                <Button title="Mark collected" variant="outline" icon={PackageCheck}
                  loading={collect.isPending && collect.variables === v.id} onPress={() => collect.mutate(v.id)} />
              )}
            </VisitorRow>
          ))}
        </Q>
      )}

      {seg === 'invites' && (
        <Q q={invites} rows={4} empty={<Empty icon={Ticket} title="No invites yet" body="Invite a guest and share a 6-digit passcode. The guard lets them in with one tap." />}>
          {(items) => items.map((p) => (
            <Row key={p.id} icon={VTYPE[p.type]} title={p.guestName}
              subtitle={`${humanize(p.type)} · ${p.passcode ? `Passcode ${formatPasscode(p.passcode)} · ` : ''}Until ${formatDateTime(p.validTo)} · ${p.usedCount}/${p.maxUses} used`}
              right={<StatusChip spec={STATUS.preApproval[p.status]} />}>
              {p.status === 'ACTIVE' && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button title="Share" variant="outline" icon={Share2} style={{ flex: 1 }} onPress={() => shareInvite(p, member?.society.name ?? '')} />
                  <Button title="Cancel" variant="dangerOutline" icon={X} style={{ flex: 1 }} loading={cancel.isPending && cancel.variables === p.id}
                    onPress={async () => (await confirm(`Cancel ${p.guestName}'s invite?`, 'The passcode will stop working at the gate.', 'Cancel invite')) && cancel.mutate(p.id)} />
                </View>
              )}
            </Row>
          ))}
        </Q>
      )}
    </Screen>
  );
}
