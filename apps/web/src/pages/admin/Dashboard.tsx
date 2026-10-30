import { Link } from 'react-router-dom';
import { LifeBuoy, Megaphone, ReceiptIndianRupee, Siren, UserRoundCheck, Wallet } from 'lucide-react';
import { useGet } from '../../lib/api';
import { formatINR, formatINRCompact, formatLongDay, formatPeriod, formatRelative, formatTime, currentPeriod, formatCountdown } from '../../lib/format';
import { STATUS, TICKET_CAT, VISITOR_TYPE } from '../../lib/status';
import type { List, Notice, ReportSummary, Ticket, Visitor } from '../../lib/types';
import { Async, ButtonLink, Card, EmptyState, PageHeader, Skeleton, StatCard, StatusChip, useNow } from '../../components/ui';
import { Threshold } from '../../components/Logo';

const more = (to: string, label: string) => <Link to={to} className="text-label text-brand-fg hover:underline">{label}</Link>;

export default function Dashboard() {
  const now = useNow();
  // Admins get no visitor SSE events (docs/08 §5.2), so poll to keep "Live at the gate" live.
  const summary = useGet<ReportSummary>('/reports/summary', undefined, { refetchInterval: 15_000 });
  const pending = useGet<List<Visitor>>('/visitors', { status: 'PENDING_APPROVAL' });
  const tickets = useGet<List<Ticket>>('/tickets', { status: 'OPEN,IN_PROGRESS', limit: 5 });
  const notices = useGet<List<Notice>>('/notices', { limit: 3 });

  return (
    <>
      <PageHeader title="Dashboard" description={formatLongDay()} actions={<ButtonLink to="/app/admin/notices?compose=1" icon={Megaphone}>Post notice</ButtonLink>} />

      {!!summary.data?.sosActive && (
        <Link to="/app/admin/sos" className="mb-6 flex items-center gap-3 rounded-card bg-danger-600 px-5 py-4 text-white shadow-card">
          <Siren size={24} aria-hidden /><span className="flex-1 font-semibold">{summary.data.sosActive} active SOS alert{summary.data.sosActive > 1 ? 's' : ''}. Open the SOS page to respond.</span>
          <span className="text-label underline">View</span>
        </Link>
      )}

      <Async q={summary} skeleton={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-36 !rounded-card" />)}</div>}>
        {(s) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Link to="/app/admin/billing" className="relative overflow-hidden rounded-card bg-navy-900 p-5 text-paper shadow-card transition-shadow duration-fast hover:shadow-raised">
              <Threshold className="absolute inset-x-5 top-0" />
              <p className="text-body-sm text-navy-200">Collection · {formatPeriod(currentPeriod())}</p>
              <p className="mt-2 text-numeric-xl tabular-nums text-white">{s.collectionRate}%</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-xs bg-navy-800" role="progressbar" aria-valuenow={s.collectionRate} aria-valuemin={0} aria-valuemax={100} aria-label="Collection rate">
                <div className="h-full bg-emerald-500" style={{ width: `${s.collectionRate}%` }} />
              </div>
              <p className="mt-2 text-caption text-navy-200">{formatINRCompact(s.totalCollected)} collected this month</p>
            </Link>
            <StatCard to="/app/admin/billing" label="Outstanding dues" icon={ReceiptIndianRupee} value={formatINRCompact(s.totalDue)} context={<span title={formatINR(s.totalDue)}>Unpaid and overdue, all months</span>} />
            <StatCard to="/app/admin/expenses" label="Expenses this month" icon={Wallet} value={formatINRCompact(s.expensesThisMonth)} context={formatPeriod(currentPeriod())} />
            <StatCard to="/app/admin/visitors" label="Visitors today" icon={UserRoundCheck} value={s.visitorsToday} context={`${s.insideNow} inside now · ${s.pendingApprovals} awaiting`} />
            <StatCard to="/app/admin/helpdesk" label="Open requests" icon={LifeBuoy} value={s.openTickets} context={`${s.residents} residents · ${s.flats} flats`} />
          </div>
        )}
      </Async>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Live at the gate" actions={more('/app/admin/visitors', 'View visitor log')}>
          <Async q={summary} isEmpty={(s) => !s.recentVisitors.length} empty={<EmptyState icon={UserRoundCheck} title="No visitors yet today." body="Entries appear here the moment a guard logs them." />}>
            {(s) => (
              <ol className="-my-2 divide-y divide-line">
                {s.recentVisitors.map((v) => {
                  const T = VISITOR_TYPE[v.type];
                  return (
                    <li key={v.id} className="flex items-center gap-3 py-3">
                      <span className="w-16 shrink-0 text-caption tabular-nums text-fg-subtle">{formatTime(v.createdAt)}</span>
                      <T.icon size={18} className="shrink-0 text-fg-subtle" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-body-sm"><span className="font-semibold">{v.name}</span>{v.company && <span className="text-fg-muted"> · {v.company}</span>}</span>
                      <span className="hidden text-body-sm tabular-nums text-fg-muted sm:block">{v.flat.label}</span>
                      <StatusChip spec={STATUS.visitor[v.status]} />
                    </li>
                  );
                })}
              </ol>
            )}
          </Async>
        </Card>

        <div className="space-y-6">
          <Card title="Awaiting approval">
            <Async q={pending} empty={<p className="text-body-sm text-fg-muted">Nobody is waiting at the gate.</p>} skeleton={<Skeleton className="h-12" />}>
              {(d) => (
                <ul className="-my-2 divide-y divide-line">
                  {d.items.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-body-sm">
                      <span className="min-w-0 truncate"><span className="font-semibold">{v.name}</span> · {VISITOR_TYPE[v.type].label} · {v.flat.label}</span>
                      <span className="tabular-nums text-status-warning-fg">{v.expiresAt ? formatCountdown(new Date(v.expiresAt).getTime() - now) : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Async>
          </Card>
          <Card title="Open requests" actions={more('/app/admin/helpdesk', 'Open helpdesk')}>
            <Async q={tickets} empty={<p className="text-body-sm text-fg-muted">No open requests.</p>} skeleton={<Skeleton className="h-12" />}>
              {(d) => (
                <ul className="-my-2 divide-y divide-line">
                  {[...d.items].sort((a, b) => (b.priority === 'HIGH' ? 1 : 0) - (a.priority === 'HIGH' ? 1 : 0)).map((t) => {
                    const C = TICKET_CAT[t.category];
                    return (
                      <li key={t.id}>
                        <Link to={`/app/admin/helpdesk/${t.id}`} className="flex items-center gap-2 py-2.5 text-body-sm hover:underline">
                          <C.icon size={16} className="shrink-0 text-fg-subtle" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          <StatusChip spec={STATUS.priority[t.priority]} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Async>
          </Card>
          <Card title="Recent notices" actions={more('/app/admin/notices', 'All notices')}>
            <Async q={notices} empty={<p className="text-body-sm text-fg-muted">No notices yet.</p>} skeleton={<Skeleton className="h-12" />}>
              {(d) => (
                <ul className="space-y-2">
                  {d.items.map((n) => <li key={n.id} className="flex justify-between gap-3 text-body-sm"><span className="truncate font-semibold">{n.title}</span><span className="shrink-0 text-caption text-fg-subtle">{formatRelative(n.createdAt)}</span></li>)}
                </ul>
              )}
            </Async>
          </Card>
        </div>
      </div>
    </>
  );
}
