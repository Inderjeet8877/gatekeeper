import { CircleCheck, CreditCard, IndianRupee, Landmark, Receipt, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Badge, Button, Card, Chips, Empty, I, Q, Screen, Section, Sheet, StatusChip, Txt } from '@/components/ui';
import { api, errMsg, type Invoice, type PaymentMethod } from '@/lib/api';
import { formatDate, formatINR, formatPeriod } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { STATUS } from '@/lib/status';
import { useTheme } from '@/lib/theme';

const DAY = 86_400_000;

export default function Payments() {
  const q = useList<Invoice>(['invoices', 'all'], '/invoices?limit=50');
  const [paying, setPaying] = useState<Invoice | null>(null);
  return (
    <Screen back title="Payments">
      <Q q={q} rows={3} empty={<Empty icon={Receipt} title="No invoices yet" body="New maintenance bills appear here on the 1st." />}>
        {(items) => {
          const due = items.filter((i) => i.status !== 'PAID');
          const paid = items.filter((i) => i.status === 'PAID');
          return (
            <>
              <Card style={{ gap: 4 }}>
                <Txt v="bodySm" c="fgMuted">Total due</Txt>
                <Txt v="numericXl" c="fgHeading">{formatINR(due.reduce((a, i) => a + i.amount, 0))}</Txt>
                <Txt v="caption" c="fgSubtle">{due.length ? `${due.length} unpaid · earliest due ${formatDate(due[due.length - 1].dueDate)}` : "You're all paid up."}</Txt>
              </Card>
              {due.length === 0 && <Empty icon={CircleCheck} title="You're all paid up" body="New maintenance bills appear here on the 1st." />}
              {due.map((i) => <InvoiceCard key={i.id} i={i} onPay={() => setPaying(i)} />)}
              {paid.length > 0 && <Section title="Paid">{paid.map((i) => <InvoiceCard key={i.id} i={i} />)}</Section>}
            </>
          );
        }}
      </Q>
      <PaySheet invoice={paying} onClose={() => setPaying(null)} />
    </Screen>
  );
}

function InvoiceCard({ i, onPay }: { i: Invoice; onPay?: () => void }) {
  const t = useTheme();
  const daysLate = Math.floor((Date.now() - new Date(`${i.dueDate}T18:30:00Z`).getTime()) / DAY); // end of due day, IST
  const spec = i.status === 'OVERDUE' && daysLate > 30 ? { ...STATUS.invoice.OVERDUE, tone: 'danger' as const } : STATUS.invoice[i.status];
  const p = i.payments[0];
  return (
    <Card accent={i.status === 'OVERDUE' ? t.colors.status[spec.tone].dot : undefined} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Txt v="h3" c="fgHeading" style={{ flex: 1 }}>{formatPeriod(i.period)} maintenance</Txt>
        <Badge label={i.flat.label} />
      </View>
      <Txt v="numericLg" c="fgHeading">{formatINR(i.amount)}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="bodySm" color={i.status === 'OVERDUE' ? t.colors.status.warning.fg : t.colors.fgMuted}>
          {i.status === 'PAID' && p ? `Paid on ${formatDate(p.paidAt)} via ${p.method === 'NETBANKING' ? 'net banking' : p.method} · Ref ${p.reference}`
            : i.status === 'OVERDUE' ? `Overdue by ${Math.max(1, daysLate)} day${daysLate > 1 ? 's' : ''}` : `Due ${formatDate(i.dueDate)}`}
        </Txt>
      </View>
      <StatusChip spec={spec} icon />
      {onPay && <Button title={`Pay ${formatINR(i.amount)}`} size="lg" icon={IndianRupee} a11y={`Pay ${formatINR(i.amount)} for ${formatPeriod(i.period)}`} onPress={onPay} />}
    </Card>
  );
}

function PaySheet({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const t = useTheme();
  const [method, setMethod] = useState<PaymentMethod | null>('UPI');
  const pay = useAct(
    async (m: PaymentMethod) => {
      const [r] = await Promise.all([
        api<Invoice>(`/invoices/${invoice!.id}/pay`, { method: 'POST', body: { method: m } }),
        new Promise((res) => setTimeout(res, 1200)), // deliberate minimum, §4.24
      ]);
      return r;
    },
    { invalidate: ['invoices'], quiet: true },
  );
  const close = () => { pay.reset(); onClose(); };
  const done = pay.data;
  return (
    <Sheet visible={!!invoice} onClose={close} locked={pay.isPending} title={done ? undefined : 'Pay maintenance'}>
      {invoice && done ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.status.success.bg, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={CircleCheck} size={36} color={t.colors.status.success.dot} />
          </View>
          <Txt v="h2" c="fgHeading">Payment received</Txt>
          <Txt v="body" c="fgMuted" style={{ textAlign: 'center' }}>
            {formatINR(done.amount)} for {formatPeriod(done.period)}.{done.payments[0] ? `\nReceipt ${done.payments[0].reference}` : ''}
          </Txt>
          <Button title="Done" style={{ alignSelf: 'stretch' }} onPress={close} />
        </View>
      ) : invoice && (
        <>
          <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: t.colors.gold, borderRadius: 10, padding: 12, backgroundColor: t.colors.status.gold.bg }}>
            <Txt v="label" color={t.colors.status.gold.fg}>Test payment — no money will move</Txt>
          </View>
          <View>
            <Txt v="bodySm" c="fgMuted">{formatPeriod(invoice.period)} · {invoice.flat.label}</Txt>
            <Txt v="numericXl" c="fgHeading">{formatINR(invoice.amount, { alwaysPaise: true })}</Txt>
          </View>
          <Chips<PaymentMethod> tiles value={method} onChange={setMethod} options={[
            { value: 'UPI', label: 'UPI', icon: Smartphone }, { value: 'CARD', label: 'Card', icon: CreditCard },
            { value: 'NETBANKING', label: 'Net banking', icon: Landmark },
          ]} />
          {pay.isError && <Banner tone="danger" title="The payment didn't go through." body={`You haven't been charged. ${errMsg(pay.error)}`} />}
          <Button title={pay.isPending ? 'Processing…' : `Pay ${formatINR(invoice.amount)}`} size="lg" disabled={!method} loading={pay.isPending} onPress={() => method && pay.mutate(method)} />
          <Button title="Cancel" variant="ghost" disabled={pay.isPending} onPress={close} />
        </>
      )}
    </Sheet>
  );
}
