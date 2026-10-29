import { useState } from 'react';
import { Download, Ticket, UserRoundCheck } from 'lucide-react';
import { useGet } from '../../lib/api';
import { formatDate, formatDateTime, formatTime, todayIST } from '../../lib/format';
import { STATUS, VISITOR_TYPE } from '../../lib/status';
import type { Flat, List, PreApproval, Visitor } from '../../lib/types';
import { Async, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, StatusChip, Table, Tabs, Who, options, td, tr } from '../../components/ui';

function exportCsv(rows: Visitor[], date: string) {
  const head = ['Time', 'Name', 'Type', 'Company', 'Flat', 'Status', 'In', 'Out', 'Logged by', 'Decided by'];
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((v) => [formatDateTime(v.createdAt), v.name, v.type, v.company, v.flat.label, STATUS.visitor[v.status].label,
    v.checkInAt && formatTime(v.checkInAt), v.checkOutAt && formatTime(v.checkOutAt), v.loggedBy.name, v.decidedBy?.name].map(esc).join(','));
  const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: `visitors-${date || 'all'}.csv` }).click();
  URL.revokeObjectURL(url);
}

export default function AdminVisitors() {
  const [tab, setTab] = useState<'log' | 'invites'>('log');
  const [date, setDate] = useState(todayIST());
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [flatId, setFlatId] = useState('');
  const flats = useGet<List<Flat>>('/flats');
  const q = useGet<List<Visitor>>(tab === 'log' ? '/visitors' : null, { date: date || undefined, status: status || undefined, flatId: flatId || undefined, limit: 200 });
  const invites = useGet<List<PreApproval>>(tab === 'invites' ? '/preapprovals' : null, { limit: 200 });
  const rows = (q.data?.items ?? []).filter((v) => !type || v.type === type);
  const filtered = !!(status || type || flatId);

  return (
    <>
      <PageHeader title="Visitors" description="Every entry at the gate, with who approved it and when."
        actions={tab === 'log' && <Button variant="outline" icon={Download} disabled={!rows.length} onClick={() => exportCsv(rows, date)}>Export CSV</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'log', label: 'Visitor log' }, { id: 'invites', label: 'Pre-approvals' }]} />
      {tab === 'log' ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date"><Input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{options(STATUS.visitor)}</Select></Field>
            <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{options(VISITOR_TYPE)}</Select></Field>
            <Field label="Flat"><Select value={flatId} onChange={(e) => setFlatId(e.target.value)}><option value="">All flats</option>{flats.data?.items.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Select></Field>
          </div>
          <Async q={q} isEmpty={() => !rows.length} empty={
            <Card><EmptyState icon={UserRoundCheck} title={date ? `No visitors on ${formatDate(`${date}T12:00:00+05:30`)}.` : 'No visitors found.'} body={filtered ? 'Try clearing the filters.' : 'Entries appear here as guards log them.'}
              action={filtered ? <Button variant="ghost" onClick={() => { setStatus(''); setType(''); setFlatId(''); }}>Clear filters</Button> : undefined} /></Card>
          }>
            {() => (
              <Table caption="Visitor log" head={['Visitor', 'Flat', 'Status', 'Arrived', 'In', 'Out', 'Logged by', 'Decided by']}>
                {rows.map((v) => (
                  <tr key={v.id} className={tr}>
                    <td className={td}><Who name={v.name} icon={v.type === 'GUEST' ? undefined : VISITOR_TYPE[v.type].icon} sub={[VISITOR_TYPE[v.type].label, v.company, v.vehicleNo, v.preApprovalId && 'Invited'].filter(Boolean).join(' · ')} /></td>
                    <td className={td}><Badge variant="outline">{v.flat.label}</Badge></td>
                    <td className={td}><StatusChip spec={STATUS.visitor[v.status]} /></td>
                    <td className={`${td} tabular-nums`}>{formatTime(v.createdAt)}</td>
                    <td className={`${td} tabular-nums`}>{v.checkInAt ? formatTime(v.checkInAt) : '—'}</td>
                    <td className={`${td} tabular-nums`}>{v.checkOutAt ? formatTime(v.checkOutAt) : '—'}</td>
                    <td className={td}>{v.loggedBy.name}</td>
                    <td className={td}>{v.decidedBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Async>
        </>
      ) : (
        <Async q={invites} empty={<Card><EmptyState icon={Ticket} title="No pre-approvals yet." body="Invites created by residents appear here." /></Card>}>
          {(d) => (
            <Table caption="Pre-approvals" head={['Guest', 'Flat', 'Created by', 'Valid from', 'Valid until', 'Uses', 'Status']}>
              {d.items.map((p) => (
                <tr key={p.id} className={tr}>
                  <td className={td}><Who name={p.guestName} sub={VISITOR_TYPE[p.type].label} /></td>
                  <td className={td}><Badge variant="outline">{p.flat.label}</Badge></td>
                  <td className={td}>{p.createdBy.name}</td>
                  <td className={`${td} tabular-nums`}>{formatDateTime(p.validFrom)}</td>
                  <td className={`${td} tabular-nums`}>{formatDateTime(p.validTo)}</td>
                  <td className={`${td} tabular-nums`}>{p.usedCount}/{p.maxUses}</td>
                  <td className={td}><StatusChip spec={STATUS.preApproval[p.status]} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      )}
    </>
  );
}
