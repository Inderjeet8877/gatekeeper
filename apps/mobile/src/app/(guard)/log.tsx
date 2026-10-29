import { Car, ChevronLeft, LogIn, Package, Send, UserRound, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Banner, Button, Card, Chips, Field, Q, Screen, StatusChip, Txt, useNow } from '@/components/ui';
import { VTYPE } from '@/components/visitor';
import { api, errMsg, type Block, type Flat, type Visitor, type VisitorType } from '@/lib/api';
import { digits, formatCountdown, formatTime, humanize, istDay } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { STATUS } from '@/lib/status';
import { useTheme } from '@/lib/theme';

const TYPES = [
  { value: 'GUEST' as const, label: 'Guest', icon: UserRound }, { value: 'DELIVERY' as const, label: 'Delivery', icon: Package },
  { value: 'CAB' as const, label: 'Cab', icon: Car }, { value: 'SERVICE' as const, label: 'Service', icon: Wrench },
];
const COMPANIES: Partial<Record<VisitorType, string[]>> = {
  DELIVERY: ['Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Blinkit', 'Zepto'],
  CAB: ['Uber', 'Ola', 'Rapido'],
  SERVICE: ['Urban Company'],
};

export default function LogVisitor() {
  const [type, setType] = useState<VisitorType | null>(null);
  const [flat, setFlat] = useState<Flat | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [sent, setSent] = useState<Visitor | null>(null);
  const create = useAct(
    () => api<Visitor>('/visitors', {
      method: 'POST',
      body: {
        flatId: flat!.id, type, name: name.trim() || company.trim(), company: company.trim() || undefined,
        phone: digits(phone) || undefined, vehicleNo: vehicle.trim() || undefined,
      },
    }),
    { invalidate: ['visitors'], quiet: true, onSuccess: setSent },
  );
  const reset = () => {
    setType(null); setFlat(null); setName(''); setCompany(''); setPhone(''); setVehicle(''); setSent(null); create.reset();
  };

  if (sent) return <Waiting initial={sent} onDone={reset} />;

  if (!type) {
    return (
      <Screen title="Log visitor" subtitle="Step 1 of 3 · Who is at the gate?" refresh={false}>
        <Chips tiles value={type} onChange={setType} options={TYPES} />
      </Screen>
    );
  }
  if (!flat) return <FlatPicker onBack={() => setType(null)} onPick={setFlat} />;

  const needName = type !== 'DELIVERY' || !company.trim();
  const phoneOk = !phone || (digits(phone).length >= 10 && digits(phone).length <= 15);
  return (
    <Screen title="Log visitor" subtitle="Step 3 of 3 · Details" refresh={false} footer={
      <Button title="Send for approval" size="xl" icon={Send} disabled={(needName && !name.trim()) || !phoneOk} loading={create.isPending} onPress={() => create.mutate(undefined)} />
    }>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Summary label={humanize(type)} onChange={() => setType(null)} />
        <Summary label={`${flat.label} · ${flat.residentCount} resident${flat.residentCount === 1 ? '' : 's'}`} onChange={() => setFlat(null)} />
      </View>
      {flat.residentCount === 0 && (
        <Banner tone="warning" title={`${flat.label} has no residents on Gatekeeper.`} body="Nobody can approve this request. Call the committee or deny entry." />
      )}
      {COMPANIES[type] && (
        <View style={{ gap: 8 }}>
          <Txt v="guardBody">Company</Txt>
          <Chips value={company} onChange={setCompany} options={[...COMPANIES[type]!, ...(company && !COMPANIES[type]!.includes(company) ? [company] : [])].map((c) => ({ value: c, label: c }))} />
        </View>
      )}
      <Field label="Name" optional={type === 'DELIVERY'} value={name} onChangeText={setName} maxLength={80} placeholder={type === 'DELIVERY' ? 'Defaults to the company' : 'Visitor name'} />
      {type !== 'GUEST' && !COMPANIES[type]?.includes(company) && (
        <Field label="Other company" optional value={company} onChangeText={setCompany} maxLength={80} />
      )}
      <Field label="Phone" optional prefix="+91" value={phone} onChangeText={(v) => setPhone(digits(v).slice(0, 15))} keyboardType="number-pad" error={phoneOk ? null : 'Enter a 10-digit mobile number.'} />
      <Field label="Vehicle number" optional value={vehicle} onChangeText={(v) => setVehicle(v.toUpperCase())} autoCapitalize="characters" maxLength={20} placeholder="KA 01 AB 1234" />
      {create.isError && <Banner tone="danger" title="Not sent." body={errMsg(create.error)} />}
    </Screen>
  );
}

function Summary({ label, onChange }: { label: string; onChange: () => void }) {
  return (
    <Card style={{ flex: 1, padding: 12, gap: 4 }} onPress={onChange} a11y={`${label}. Change`}>
      <Txt v="guardBody" style={{ fontFamily: 'Manrope_600SemiBold' }}>{label}</Txt>
      <Txt v="body" c="brandFg">Change</Txt>
    </Card>
  );
}

function FlatPicker({ onBack, onPick }: { onBack: () => void; onPick: (f: Flat) => void }) {
  const t = useTheme();
  const blocks = useList<Block>(['blocks'], '/blocks');
  const [block, setBlock] = useState<string | null>(null);
  const blockId = block ?? blocks.data?.[0]?.id ?? null;
  const flats = useList<Flat>(['flats', blockId], `/flats?blockId=${blockId}`, { enabled: !!blockId });
  return (
    <Screen title="Log visitor" subtitle="Step 2 of 3 · Which flat?" refresh={false}>
      <Button title="Back" variant="outline" size="xl" icon={ChevronLeft} onPress={onBack} style={{ alignSelf: 'flex-start' }} />
      <Q q={blocks} rows={1}>
        {(bs) => <Chips tone="navy" value={blockId} onChange={setBlock} options={bs.map((b) => ({ value: b.id, label: `Block ${b.name}` }))} />}
      </Q>
      {blockId && (
        <Q q={flats} rows={3}>
          {(fs) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {fs.map((f) => (
                <Pressable key={f.id} onPress={() => onPick(f)} accessibilityRole="button" accessibilityLabel={`${f.label}, ${f.residentCount} residents`}
                  style={({ pressed }) => ({ width: '31%', flexGrow: 1, height: 80, borderRadius: 12, borderWidth: 1, borderColor: t.colors.lineStrong, backgroundColor: pressed ? t.colors.surfaceSunken : t.colors.surface, alignItems: 'center', justifyContent: 'center' })}>
                  <Txt v="guardXl" c="fgHeading" style={{ fontSize: 28 }}>{f.number}</Txt>
                  <Txt v="body" c="fgMuted">{f.residentCount ? `${f.residentCount} resident${f.residentCount > 1 ? 's' : ''}` : 'No residents'}</Txt>
                </Pressable>
              ))}
            </View>
          )}
        </Q>
      )}
    </Screen>
  );
}

/** Live "Awaiting approval" card: follows the visitor through today's list (refreshed by SSE visitor.updated, or polling). */
function Waiting({ initial, onDone }: { initial: Visitor; onDone: () => void }) {
  const t = useTheme();
  const now = useNow(1000);
  const today = useList<Visitor>(['visitors', 'today'], `/visitors?date=${istDay().key}&limit=200`, { live: true });
  const v = today.data?.find((x) => x.id === initial.id) ?? initial;
  const checkIn = useAct(() => api<Visitor>(`/visitors/${v.id}/check-in`, { method: 'POST' }), { invalidate: ['visitors'], success: `${v.name} checked in.`, onSuccess: onDone });
  const left = v.expiresAt ? new Date(v.expiresAt).getTime() - now : 0;
  const msg: Partial<Record<Visitor['status'], string>> = {
    PENDING_APPROVAL: `Waiting for ${v.flat.label} to respond… Residents have been notified.`,
    APPROVED: `Approved by ${v.decidedBy?.name ?? 'the resident'} (${v.flat.label}). Let them in, then tap Check in.`,
    DENIED: `Denied by ${v.flat.label}. Please ask the visitor to leave politely.`,
    EXPIRED: `No response from ${v.flat.label} in 10 minutes. Call the flat or deny entry.`,
    LEFT_AT_GATE: 'Keep the parcel at the gate. The resident will collect it.',
    CHECKED_IN: `Checked in at ${v.checkInAt ? formatTime(v.checkInAt) : ''}.`,
  };
  const spec = STATUS.visitor[v.status];
  return (
    <Screen title="Awaiting approval" refresh={false}>
      <Card style={{ gap: 16, borderWidth: 2, borderColor: t.colors.status[spec.tone].dot }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Badge label={humanize(v.type)} icon={VTYPE[v.type]} />
          <View style={{ flex: 1 }} />
          <StatusChip spec={spec} icon />
        </View>
        <Txt v="guardXl" c="fgHeading">{v.name}</Txt>
        <Txt v="guardBody" c="fgMuted">For {v.flat.label}{v.company ? ` · ${v.company}` : ''} · Logged {formatTime(v.createdAt)}</Txt>
        {v.status === 'PENDING_APPROVAL' && (
          <Txt v="guardXl" style={{ fontSize: 56, lineHeight: 64, textAlign: 'center', fontVariant: ['tabular-nums'] }} color={left < 120_000 ? t.colors.dangerFg : t.colors.fgHeading}>
            {formatCountdown(left)}
          </Txt>
        )}
        <Txt v="guardBody" accessibilityLiveRegion="polite">{msg[v.status] ?? spec.label}</Txt>
      </Card>
      {v.status === 'APPROVED' && <Button title="Check in" size="xl" variant="secondary" icon={LogIn} loading={checkIn.isPending} onPress={() => checkIn.mutate(undefined)} />}
      <Button title={v.status === 'PENDING_APPROVAL' ? 'Log another visitor' : 'Done'} size="xl" variant="outline" onPress={onDone} />
    </Screen>
  );
}
