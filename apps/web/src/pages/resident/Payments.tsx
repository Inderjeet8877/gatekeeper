import { useState } from 'react';
import { Check, CircleAlert, IndianRupee, Receipt } from 'lucide-react';
import { post, useAct, useGet } from '../../lib/api';
import { formatDate, formatINR, formatISODate, formatPeriod, todayIST } from '../../lib/format';
import { PAY_METHOD, invoiceSpec } from '../../lib/status';
import type { Invoice, List, PaymentMethod } from '../../lib/types';
import { Async, Badge, Button, Card, cx, EmptyState, Modal, PageHeader, StatusChip } from '../../components/ui';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function PayModal({ inv, onClose }: { inv: Invoice | null; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [paid, setPaid] = useState<Invoice | null>(null);
  // Mock gateway: hold the processing state ≥1.2 s so it reads as deliberate.
  const pay = useAct(async () => {
    const [r] = await Promise.all([post<Invoice>(`/invoices/${inv!.id}/pay`, { method }), wait(1200)]);
    return r;
  }, { quiet: true, onSuccess: (r) => setPaid(r) });
  const close = () => { onClose(); setPaid(null); pay.reset(); setMethod('UPI'); };
  if (!inv) return <Modal open={false} onClose={close} title="">{null}</Modal>;
  const receipt = paid?.payments[paid.payments.length - 1];
  return (
    <Modal open onClose={close} dismissible={!pay.isPending} title={paid ? 'Payment received' : `Pay ${formatINR(inv.amount)}`}
      footer={paid ? <Button onClick={close}>Done</Button> : (
        <>
          <Button variant="ghost" onClick={close} disabled={pay.isPending}>Cancel</Button>
          <Button icon={IndianRupee} loading={pay.isPending} onClick={() => pay.mutate()} aria-label={`Pay ${formatINR(inv.amount)} for ${formatPeriod(inv.period)}`}>
            {pay.isPending ? 'Processing…' : `Pay ${formatINR(inv.amount)}`}
          </Button>
        </>
      )}>
      {paid ? (
        <div className="flex flex-col items-center py-4 text-center" role="status">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-status-success-bg text-status-success-dot"><Check size={36} aria-hidden /></span>
          <p className="mt-4 text-numeric-lg tabular-nums text-fg-heading">{formatINR(paid.amount)}</p>
          <p className="mt-1 text-body text-fg-muted">Payment received for {formatPeriod(paid.period)} · {paid.flat.label}</p>
          {receipt && <p className="mt-3 text-body-sm tabular-nums text-fg-subtle">Reference {receipt.reference} · {PAY_METHOD[receipt.method].label}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="rounded-control border border-dashed border-gold-500 bg-status-gold-bg px-3 py-2 text-body-sm text-status-gold-fg">Test payment — no money will move.</p>
          <div className="flex items-baseline justify-between rounded-card bg-surface-sunken p-4">
            <span className="text-body-sm text-fg-muted">{formatPeriod(inv.period)} maintenance · {inv.flat.label}</span>
            <span className="text-h3 tabular-nums">{formatINR(inv.amount, { alwaysPaise: true })}</span>
          </div>
          <fieldset>
            <legend className="mb-2 text-label">Payment method</legend>
            <div className="space-y-2">
              {(['UPI', 'CARD', 'NETBANKING'] as PaymentMethod[]).map((m) => {
                const M = PAY_METHOD[m];
                return (
                  <label key={m} className={cx('flex h-14 cursor-pointer items-center gap-3 rounded-control border px-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus', method === m ? 'border-brand bg-status-success-bg' : 'border-line-strong hover:bg-surface-sunken')}>
                    <input type="radio" name="method" className="h-5 w-5 accent-[rgb(var(--gk-brand))]" checked={method === m} onChange={() => setMethod(m)} disabled={pay.isPending} />
                    <M.icon size={20} aria-hidden className="text-fg-muted" />
                    <span className="font-semibold">{M.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {pay.isError && <p role="alert" className="flex gap-2 rounded-control bg-status-danger-bg p-3 text-body-sm text-status-danger-fg"><CircleAlert size={18} className="shrink-0" aria-hidden />{pay.error.code === 'ALREADY_PAID' ? 'This bill is already paid.' : `The payment didn't go through. You haven't been charged. ${pay.error.message}`}</p>}
        </div>
      )}
    </Modal>
  );
}

function InvoiceCard({ inv, onPay }: { inv: Invoice; onPay: () => void }) {
  const p = inv.payments[inv.payments.length - 1];
  const overdueDays = inv.status === 'OVERDUE' ? Math.max(1, Math.round((Date.parse(`${todayIST()}T00:00:00+05:30`) - Date.parse(`${inv.dueDate}T00:00:00+05:30`)) / 86_400_000)) : 0;
  const spec = invoiceSpec(inv.status, inv.dueDate);
  return (
    <Card className={cx(inv.status === 'OVERDUE' && (spec.tone === 'danger' ? 'border-l-[3px] border-l-danger-600' : 'border-l-[3px] border-l-warning-500'))}
      title={`${formatPeriod(inv.period)} maintenance`} actions={<><Badge variant="outline">{inv.flat.label}</Badge><StatusChip spec={spec} /></>}>
      <p className="text-numeric-lg tabular-nums text-fg-heading">{formatINR(inv.amount)}</p>
      {inv.status === 'PAID' && p ? (
        <p className="mt-1 text-body-sm tabular-nums text-fg-muted">Paid on {formatDate(p.paidAt)} via {PAY_METHOD[p.method].label} · Ref {p.reference}</p>
      ) : inv.status === 'OVERDUE' ? (
        <p className="mt-1 flex items-center gap-1.5 text-body-sm text-status-warning-fg"><CircleAlert size={16} aria-hidden />Overdue by {overdueDays} day{overdueDays === 1 ? '' : 's'}</p>
      ) : <p className="mt-1 text-body-sm text-fg-muted">Due {formatISODate(inv.dueDate)}</p>}
      {inv.status !== 'PAID' && (
        <Button size="lg" icon={IndianRupee} className="mt-4 w-full sm:w-auto" onClick={onPay} aria-label={`Pay ${formatINR(inv.amount)} for ${formatPeriod(inv.period)}`}>Pay {formatINR(inv.amount)}</Button>
      )}
    </Card>
  );
}

export default function Payments() {
  const q = useGet<List<Invoice>>('/invoices', { limit: 100 });
  const [paying, setPaying] = useState<Invoice | null>(null);
  const due = (q.data?.items ?? []).filter((i) => i.status !== 'PAID');
  const paid = (q.data?.items ?? []).filter((i) => i.status === 'PAID');
  const total = due.reduce((s, i) => s + i.amount, 0);
  return (
    <>
      <PageHeader title="Payments" description="Maintenance bills for your flat and your payment history." />
      <Async q={q} empty={<Card><EmptyState icon={Receipt} title="You're all paid up." body="New maintenance bills appear here on the 1st." positive /></Card>}>
        {() => (
          <div className="space-y-6">
            <Card>
              <p className="text-body-sm text-fg-muted">Total due</p>
              <p className="mt-1 text-numeric-xl tabular-nums text-fg-heading">{formatINR(total)}</p>
              <p className="mt-1 text-body-sm text-fg-muted">{due.length ? `${due.length} bill${due.length === 1 ? '' : 's'} · next due ${formatISODate(due[due.length - 1].dueDate)}` : "You're all paid up. New maintenance bills appear here on the 1st."}</p>
            </Card>
            {due.map((i) => <InvoiceCard key={i.id} inv={i} onPay={() => setPaying(i)} />)}
            {paid.length > 0 && (
              <section>
                <h2 className="mb-3 text-h3">Paid</h2>
                <div className="space-y-4">{paid.map((i) => <InvoiceCard key={i.id} inv={i} onPay={() => {}} />)}</div>
              </section>
            )}
          </div>
        )}
      </Async>
      <PayModal inv={paying} onClose={() => setPaying(null)} />
    </>
  );
}
