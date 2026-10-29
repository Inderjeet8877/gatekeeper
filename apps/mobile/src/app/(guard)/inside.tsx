import { DoorOpen, LogIn, LogOut, PackageCheck } from 'lucide-react-native';
import { Button, Empty, Q, Row, Screen, Section, StatusChip, useNow } from '@/components/ui';
import { VisitorRow } from '@/components/visitor';
import { api, type Staff, type Visitor } from '@/lib/api';
import { formatCountdown, humanize } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { STATUS } from '@/lib/status';

export default function Inside() {
  const now = useNow(1000);
  const q = useList<Visitor>(['visitors', 'open'], '/visitors?status=PENDING_APPROVAL,APPROVED,CHECKED_IN,LEFT_AT_GATE&limit=200', { live: true });
  const staff = useList<Staff>(['staff'], '/staff', { live: true });
  const act = useAct(
    ({ id, op }: { id: string; op: 'check-in' | 'check-out' | 'collect' }) => api<Visitor>(`/visitors/${id}/${op}`, { method: 'POST' }),
    { invalidate: ['visitors'], success: (v) => (v.status === 'CHECKED_IN' ? `${v.name} checked in.` : v.status === 'CHECKED_OUT' ? `${v.name} checked out.` : 'Marked as collected.') },
  );
  const busy = (id: string) => act.isPending && act.variables?.id === id;
  const staffIn = staff.data?.filter((s) => s.isInside) ?? [];

  return (
    <Screen title="Inside now">
      <Q q={q} rows={4}>
        {(all) => {
          const by = (s: Visitor['status']) => all.filter((v) => v.status === s);
          const [pending, approved, inside, gate] = [by('PENDING_APPROVAL'), by('APPROVED'), by('CHECKED_IN'), by('LEFT_AT_GATE')];
          return (
            <>
              {approved.length > 0 && (
                <Section title={`Approved — waiting to enter · ${approved.length}`}>
                  {approved.map((v) => (
                    <VisitorRow key={v.id} v={v} masked>
                      <Button title="Check in" size="xl" variant="secondary" icon={LogIn} loading={busy(v.id)} onPress={() => act.mutate({ id: v.id, op: 'check-in' })} />
                    </VisitorRow>
                  ))}
                </Section>
              )}
              <Section title={`Visitors inside · ${inside.length}`}>
                {inside.length === 0 && <Empty icon={DoorOpen} title="Nobody is inside right now" body="Checked-in visitors will appear here." />}
                {inside.map((v) => (
                  <VisitorRow key={v.id} v={v} masked>
                    <Button title="Check out" size="xl" variant="outline" icon={LogOut} loading={busy(v.id)} onPress={() => act.mutate({ id: v.id, op: 'check-out' })} />
                  </VisitorRow>
                ))}
              </Section>
              {gate.length > 0 && (
                <Section title={`Parcels at the gate · ${gate.length}`}>
                  {gate.map((v) => (
                    <VisitorRow key={v.id} v={v}>
                      <Button title="Mark collected" size="xl" variant="outline" icon={PackageCheck} loading={busy(v.id)} onPress={() => act.mutate({ id: v.id, op: 'collect' })} />
                    </VisitorRow>
                  ))}
                </Section>
              )}
              {pending.length > 0 && (
                <Section title={`Awaiting approval · ${pending.length}`}>
                  {pending.map((v) => (
                    <VisitorRow key={v.id} v={v} masked>
                      <StatusChip spec={STATUS.visitor.PENDING_APPROVAL} label={`${formatCountdown(v.expiresAt ? new Date(v.expiresAt).getTime() - now : 0)} left to respond`} />
                    </VisitorRow>
                  ))}
                </Section>
              )}
            </>
          );
        }}
      </Q>
      {staffIn.length > 0 && (
        <Section title={`Daily help inside · ${staffIn.length}`}>
          {staffIn.map((s) => (
            <Row key={s.id} icon={LogIn} title={s.name} subtitle={`${humanize(s.category)} · ${s.flats.map((f) => f.label).join(', ') || 'No flat'}`}
              right={<StatusChip spec={STATUS.staff.IN} />} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

