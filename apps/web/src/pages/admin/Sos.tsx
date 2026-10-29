import { Check, Phone, ShieldCheck, Siren } from 'lucide-react';
import { patch, useAct, useGet } from '../../lib/api';
import { formatDateTime, formatTime, maskPhone } from '../../lib/format';
import { SOS_TYPE, STATUS } from '../../lib/status';
import type { List, SosAlert } from '../../lib/types';
import { Async, Button, Card, cx, EmptyState, PageHeader, StatusChip, Table, td, tr } from '../../components/ui';

function ActiveAlert({ a, big }: { a: SosAlert; big?: boolean }) {
  const T = SOS_TYPE[a.type];
  const act = useAct((status: 'ACKNOWLEDGED' | 'RESOLVED') => patch(`/sos/${a.id}`, { status }), {
    success: (_, s) => s === 'ACKNOWLEDGED' ? 'Acknowledged. The resident knows help is on the way.' : 'Alert marked resolved.',
  });
  return (
    <article className="overflow-hidden rounded-card bg-surface shadow-card dark:border dark:border-line">
      <div className={cx('flex items-center gap-3 px-5 py-4 text-white', a.status === 'RAISED' ? 'bg-danger-600' : 'bg-warning-700')}>
        <T.icon size={big ? 32 : 24} aria-hidden />
        <h2 className={cx('flex-1 !text-white', big ? 'text-[24px] font-bold' : 'text-h3')}>{T.label} emergency — {a.flat?.label ?? 'Society'}</h2>
        <StatusChip spec={STATUS.sos[a.status]} withIcon big={big} />
      </div>
      <div className={cx('space-y-2 p-5', big ? 'text-guard-body' : 'text-body')}>
        <p>Raised by <span className="font-semibold">{a.raisedBy.name}</span> at {formatTime(a.createdAt)}.</p>
        {a.message && <p className="text-fg-muted">“{a.message}”</p>}
        {a.acknowledgedBy && <p className="text-fg-muted">{a.acknowledgedBy.name} responded at {formatTime(a.acknowledgedAt!)}.</p>}
        <div className="flex flex-wrap gap-3 pt-3">
          {a.status === 'RAISED' && <Button size={big ? 'xl' : 'md'} icon={ShieldCheck} loading={act.isPending && act.variables === 'ACKNOWLEDGED'} onClick={() => act.mutate('ACKNOWLEDGED')}>Acknowledge</Button>}
          <Button size={big ? 'xl' : 'md'} variant="secondary" icon={Check} loading={act.isPending && act.variables === 'RESOLVED'} onClick={() => act.mutate('RESOLVED')}>Mark resolved</Button>
          <a href={`tel:${a.raisedBy.phone}`} className={cx('inline-flex items-center gap-2 rounded-control border border-line-strong px-4 font-semibold text-fg-heading hover:bg-surface-sunken', big ? 'h-[72px] text-[20px]' : 'h-11')}>
            <Phone size={big ? 24 : 18} aria-hidden /> Call {maskPhone(a.raisedBy.phone)}
          </a>
        </div>
      </div>
    </article>
  );
}

export function SosBoard({ big }: { big?: boolean }) {
  const active = useGet<List<SosAlert>>('/sos', { status: 'RAISED,ACKNOWLEDGED' });
  const history = useGet<List<SosAlert>>('/sos', { status: 'RESOLVED', limit: 30 });
  return (
    <div className="space-y-8">
      <Async q={active} empty={<Card><EmptyState icon={Siren} title="No active alerts." body="Alerts raised by residents appear here and take over the screen." positive /></Card>}>
        {(d) => <div className="grid gap-4 lg:grid-cols-2">{d.items.map((a) => <ActiveAlert key={a.id} a={a} big={big} />)}</div>}
      </Async>
      <section>
        <h2 className="mb-3 text-h3">History</h2>
        <Async q={history} empty={<Card><p className="text-body-sm text-fg-muted">No resolved alerts yet.</p></Card>}>
          {(d) => (
            <Table caption="Resolved SOS alerts" head={['Type', 'Flat', 'Raised by', 'Raised', 'Responded by', 'Resolved']}>
              {d.items.map((a) => (
                <tr key={a.id} className={tr}>
                  <td className={td}><span className="inline-flex items-center gap-2 font-semibold">{(() => { const I = SOS_TYPE[a.type].icon; return <I size={16} aria-hidden />; })()}{SOS_TYPE[a.type].label}</span></td>
                  <td className={td}>{a.flat?.label ?? '—'}</td>
                  <td className={td}>{a.raisedBy.name}</td>
                  <td className={`${td} tabular-nums`}>{formatDateTime(a.createdAt)}</td>
                  <td className={td}>{a.acknowledgedBy?.name ?? '—'}</td>
                  <td className={`${td} tabular-nums`}>{a.resolvedAt ? formatDateTime(a.resolvedAt) : '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      </section>
    </div>
  );
}

export default function AdminSos() {
  return (
    <>
      <PageHeader title="SOS" description="Emergency alerts raised by residents, and how they were handled." />
      <SosBoard />
    </>
  );
}
