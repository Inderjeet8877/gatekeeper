import { useState, type FormEvent } from 'react';
import { Banknote, FilePlus, Plus, Receipt, Wallet } from 'lucide-react';
import { post, useAct, useGet } from '../../lib/api';
import { currentPeriod, formatINR, formatISODate, formatPeriod, rupeesToPaise, todayIST } from '../../lib/format';
import { EXPENSE_CAT, PAY_METHOD, STATUS, invoiceSpec } from '../../lib/status';
import type { Expense, ExpenseCategory, Flat, Invoice, List } from '../../lib/types';
import {
  Async, Badge, Button, Card, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, Select, StatusChip, Table, Textarea,
  options, td, tr, useToast,
} from '../../components/ui';

/* ── Billing ───────────────────────────────────────────────────────── */
function GenerateModal({ open, onClose, flatCount }: { open: boolean; onClose: () => void; flatCount: number }) {
  const toast = useToast();
  const [period, setPeriod] = useState(currentPeriod());
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(`${currentPeriod()}-10`);
  const [err, setErr] = useState<string | null>(null);
  const gen = useAct(() => post<{ created: number; skipped: number }>('/invoices/generate', { period, amount: rupeesToPaise(amount), dueDate: due }), {
    onSuccess: (r) => {
      toast(r.created ? `${r.created} invoices created for ${formatPeriod(period)}${r.skipped ? ` (${r.skipped} flats already had one)` : ''}.` : `Invoices for ${formatPeriod(period)} already exist for all flats.`, r.created ? 'success' : 'info');
      onClose();
    },
  });
  const paise = rupeesToPaise(amount);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(period)) return setErr('Choose the billing month.');
    if (!paise || paise < 1) return setErr('Enter the amount per flat in rupees.');
    if (!due) return setErr('Choose a due date.');
    setErr(null); gen.mutate();
  };
  return (
    <Modal open={open} onClose={onClose} title="Generate maintenance invoices">
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Billing month"><Input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setDue(`${e.target.value}-10`); }} /></Field>
        <Field label="Amount per flat (₹)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="3500" autoFocus /></Field>
        <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <p className="rounded-control bg-surface-sunken p-3 text-body-sm text-fg-muted">
          This will bill up to {flatCount} flat{flatCount === 1 ? '' : 's'}{paise ? ` ${formatINR(paise)} each for ${formatPeriod(period)}` : ''}. Flats already billed for this month are skipped.
        </p>
        {err && <p role="alert" className="text-body-sm text-critical-fg">{err}</p>}
        <Button type="submit" full icon={FilePlus} loading={gen.isPending}>Generate invoices</Button>
      </form>
    </Modal>
  );
}

export function Billing() {
  const [period, setPeriod] = useState(currentPeriod());
  const [status, setStatus] = useState('');
  const [gen, setGen] = useState(false);
  const [cash, setCash] = useState<Invoice | null>(null);
  const flats = useGet<List<Flat>>('/flats');
  const all = useGet<List<Invoice>>('/invoices', { period: period || undefined, limit: 200 });
  const q = useGet<List<Invoice>>('/invoices', { period: period || undefined, status: status || undefined, limit: 200 });
  const record = useAct(() => post<Invoice>(`/invoices/${cash!.id}/pay`, { method: 'CASH' }), { success: (r) => `Cash payment recorded for ${r.flat.label}.`, onSuccess: () => setCash(null) });
  const items = all.data?.items ?? [];
  const billed = items.reduce((s, i) => s + i.amount, 0);
  const collected = items.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
  const strip = [
    ['Billed', formatINR(billed)], ['Collected', formatINR(collected)], ['Outstanding', formatINR(billed - collected)],
    ['Collection', `${billed ? Math.round((collected / billed) * 100) : 0}%`],
  ];

  return (
    <>
      <PageHeader title="Billing" description="Monthly maintenance for every flat, and who has paid."
        actions={<Button icon={FilePlus} onClick={() => setGen(true)}>Generate invoices</Button>} />
      <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <Field label="Month"><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
        <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{options(STATUS.invoice)}</Select></Field>
      </div>
      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {strip.map(([k, v]) => (
          <div key={k} className="rounded-card bg-surface p-4 shadow-card dark:border dark:border-line">
            <dt className="text-body-sm text-fg-muted">{k}{period ? ` · ${formatPeriod(period)}` : ''}</dt>
            <dd className="mt-1 text-numeric-lg tabular-nums text-fg-heading">{all.isPending ? '—' : v}</dd>
          </div>
        ))}
      </dl>
      <Async q={q} empty={<Card><EmptyState icon={Receipt} title={`No invoices for ${period ? formatPeriod(period) : 'this filter'}.`} body="Generate this month's maintenance bills for every flat in one go." action={<Button onClick={() => setGen(true)}>Generate invoices</Button>} /></Card>}>
        {(d) => (
          <Table caption="Invoices" head={['Flat', 'Period', 'Amount', 'Due', 'Status', 'Payment', '']} right={[2, 6]}>
            {d.items.map((i) => {
              const p = i.payments[i.payments.length - 1];
              return (
                <tr key={i.id} className={tr}>
                  <td className={td}><Badge variant="outline">{i.flat.label}</Badge></td>
                  <td className={td}>{formatPeriod(i.period)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(i.amount, { alwaysPaise: true })}</td>
                  <td className={`${td} tabular-nums`}>{formatISODate(i.dueDate)}</td>
                  <td className={td}><StatusChip spec={invoiceSpec(i.status, i.dueDate)} /></td>
                  <td className={`${td} text-body-sm text-fg-muted`}>{p ? `${PAY_METHOD[p.method].label} · ${p.reference}` : '—'}</td>
                  <td className={`${td} text-right`}>{i.status !== 'PAID' && <Button size="sm" variant="ghost" icon={Banknote} onClick={() => setCash(i)}>Record cash</Button>}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Async>
      <GenerateModal open={gen} onClose={() => setGen(false)} flatCount={flats.data?.items.length ?? 0} />
      <ConfirmModal open={!!cash} danger={false} onClose={() => setCash(null)} title={`Record a cash payment for ${cash?.flat.label}?`}
        body={cash ? `${formatINR(cash.amount)} for ${formatPeriod(cash.period)} will be marked as paid in cash.` : ''} confirmLabel="Record payment" loading={record.isPending} onConfirm={() => record.mutate()} />
    </>
  );
}

/* ── Expenses ──────────────────────────────────────────────────────── */
function ExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const init = { category: 'SECURITY' as ExpenseCategory, amount: '', vendor: '', note: '', spentOn: todayIST() };
  const [f, setF] = useState(init);
  const [err, setErr] = useState<string | null>(null);
  const add = useAct(() => post<Expense>('/expenses', { category: f.category, amount: rupeesToPaise(f.amount), vendor: f.vendor.trim() || undefined, note: f.note.trim() || undefined, spentOn: f.spentOn }), {
    success: (e) => `Expense of ${formatINR(e.amount)} recorded.`, onSuccess: () => { setF(init); onClose(); },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = rupeesToPaise(f.amount);
    if (!p || p < 1) return setErr('Enter the amount in rupees.');
    if (!f.spentOn || f.spentOn > todayIST()) return setErr('The date cannot be in the future.');
    setErr(null); add.mutate();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add an expense">
      <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseCategory })}>{options(EXPENSE_CAT)}</Select></Field>
        <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
        <Field label="Vendor" optional><Input value={f.vendor} maxLength={120} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={f.spentOn} max={todayIST()} onChange={(e) => setF({ ...f, spentOn: e.target.value })} /></Field>
        <Field label="Note" optional className="sm:col-span-2"><Textarea value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {err && <p role="alert" className="text-body-sm text-critical-fg sm:col-span-2">{err}</p>}
        <Button type="submit" className="sm:col-span-2" loading={add.isPending}>Add expense</Button>
      </form>
    </Modal>
  );
}

export function Expenses() {
  const [month, setMonth] = useState(currentPeriod());
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState(false);
  const q = useGet<List<Expense>>('/expenses', { month: month || undefined, category: category || undefined, limit: 200 });
  const items = q.data?.items ?? [];
  const total = items.reduce((s, e) => s + e.amount, 0);
  const byCat = Object.entries(items.reduce<Record<string, number>>((m, e) => ({ ...m, [e.category]: (m[e.category] ?? 0) + e.amount }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <PageHeader title="Expenses" description="What the society spends, by month and category." actions={<Button icon={Plus} onClick={() => setOpen(true)}>Add expense</Button>} />
      <div className="mb-6 grid max-w-xl gap-3 sm:grid-cols-2">
        <Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{options(EXPENSE_CAT)}</Select></Field>
      </div>
      <Async q={q} empty={<Card><EmptyState icon={Wallet} title={`No expenses recorded for ${month ? formatPeriod(month) : 'this filter'}.`} body="Record salaries, utilities and repairs so the committee can see where money goes." action={<Button onClick={() => setOpen(true)}>Add expense</Button>} /></Card>}>
        {(d) => (
          <div className="space-y-6">
            <Card title={`Total · ${month ? formatPeriod(month) : 'all time'}`} actions={<span className="text-numeric-lg tabular-nums text-fg-heading">{formatINR(total)}</span>}>
              <ul className="space-y-3">
                {byCat.map(([c, amt]) => {
                  const C = EXPENSE_CAT[c];
                  return (
                    <li key={c}>
                      <div className="flex items-center justify-between gap-3 text-body-sm"><span className="flex items-center gap-2 font-semibold"><C.icon size={16} aria-hidden className="text-fg-subtle" />{C.label}</span><span className="tabular-nums text-fg-muted">{formatINR(amt)} · {Math.round((amt / total) * 100)}%</span></div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-xs bg-slate-200 dark:bg-line" aria-hidden><div className="h-full bg-navy-700 dark:bg-info-500" style={{ width: `${(amt / total) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Table caption="Expenses" head={['Date', 'Category', 'Vendor', 'Note', 'Recorded by', 'Amount']} right={[5]}>
              {d.items.map((e) => (
                <tr key={e.id} className={tr}>
                  <td className={`${td} tabular-nums`}>{formatISODate(e.spentOn)}</td>
                  <td className={td}>{EXPENSE_CAT[e.category].label}</td>
                  <td className={td}>{e.vendor ?? '—'}</td>
                  <td className={`${td} max-w-[260px] truncate text-fg-muted`}>{e.note ?? '—'}</td>
                  <td className={td}>{e.createdBy.name}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatINR(e.amount, { alwaysPaise: true })}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Async>
      <ExpenseModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
