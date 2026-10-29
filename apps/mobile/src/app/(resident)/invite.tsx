import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Car, Copy, Minus, Package, Plus, Share2, UserRound, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { InvitePass, shareInvite } from '@/components/invite';
import { Banner, Button, Chips, confirm, Field, IconButton, Screen, toast, Txt } from '@/components/ui';
import { api, errMsg, type PreApproval, type VisitorType } from '@/lib/api';
import { digits } from '@/lib/format';
import { useAct } from '@/lib/hooks';
import { useSession } from '@/lib/session';

const WINDOWS = [
  { value: '4', label: 'Next 4 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '72', label: '3 days' },
];

export default function Invite() {
  const { member } = useSession();
  const society = member?.society.name ?? '';
  const [type, setType] = useState<VisitorType>('GUEST');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('4');
  const [uses, setUses] = useState(1);
  const [pass, setPass] = useState<PreApproval | null>(null);

  const create = useAct(
    () => {
      const validFrom = new Date();
      return api<PreApproval>('/preapprovals', {
        method: 'POST',
        body: {
          type, guestName: name.trim(), guestPhone: digits(phone) || undefined, maxUses: uses,
          validFrom: validFrom.toISOString(), validTo: new Date(validFrom.getTime() + Number(hours) * 3_600_000).toISOString(),
        },
      });
    },
    { invalidate: ['preapprovals'], quiet: true, onSuccess: setPass, success: 'Invite created.' },
  );
  const cancel = useAct(() => api<PreApproval>(`/preapprovals/${pass!.id}`, { method: 'DELETE' }), {
    invalidate: ['preapprovals'], success: 'Invite cancelled.', onSuccess: () => router.back(),
  });
  const phoneOk = !phone || (digits(phone).length >= 10 && digits(phone).length <= 15);

  if (pass) {
    return (
      <Screen back title="Invite ready" refresh={false} footer={
        <>
          <Button title="Share invite" size="lg" icon={Share2} onPress={() => shareInvite(pass, society)} />
          <Button title="Copy passcode" variant="outline" icon={Copy} onPress={async () => {
            await Clipboard.setStringAsync(pass.passcode ?? '');
            toast('Passcode copied.');
          }} />
        </>
      }>
        <InvitePass p={pass} society={society} />
        <Button title="Cancel invite" variant="ghost" loading={cancel.isPending}
          onPress={async () => (await confirm('Cancel this invite?', 'The passcode will stop working at the gate.', 'Cancel invite')) && cancel.mutate(undefined)} />
      </Screen>
    );
  }

  return (
    <Screen back title="Invite guest" refresh={false} footer={
      <Button title="Create invite" size="lg" disabled={!name.trim() || !phoneOk} loading={create.isPending} onPress={() => create.mutate(undefined)} />
    }>
      <Field label="Guest name" value={name} onChangeText={setName} maxLength={80} placeholder="e.g. Meera Shah" autoFocus />
      <Field label="Phone" optional prefix="+91" value={phone} onChangeText={(v) => setPhone(digits(v).slice(0, 15))} keyboardType="number-pad"
        placeholder="98450 11223" error={phoneOk ? null : 'Enter a 10-digit mobile number.'} />
      <View style={{ gap: 8 }}>
        <Txt v="label">Visitor type</Txt>
        <Chips<VisitorType> value={type} onChange={setType} options={[
          { value: 'GUEST', label: 'Guest', icon: UserRound }, { value: 'CAB', label: 'Cab', icon: Car },
          { value: 'DELIVERY', label: 'Delivery', icon: Package }, { value: 'SERVICE', label: 'Service', icon: Wrench },
        ]} />
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="label">Valid for</Txt>
        <Chips value={hours} onChange={setHours} options={WINDOWS} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="label">Number of entries</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton icon={Minus} label="Fewer entries" onPress={() => setUses((u) => Math.max(1, u - 1))} />
          <Txt v="numericLg" accessibilityLiveRegion="polite" style={{ minWidth: 28, textAlign: 'center' }}>{uses}</Txt>
          <IconButton icon={Plus} label="More entries" onPress={() => setUses((u) => Math.min(10, u + 1))} />
        </View>
      </View>
      {create.isError && <Banner tone="danger" title="Invite not created." body={errMsg(create.error)} />}
    </Screen>
  );
}
