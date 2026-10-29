import { useState } from 'react';
import { Building, Plus } from 'lucide-react';
import { useGet } from '../../lib/api';
import type { Block, List, Society } from '../../lib/types';
import { Async, Button, Card, PageHeader, Skeleton } from '../../components/ui';
import { AccountForm, Appearance, Memberships } from '../resident/Profile';
import { BlockModal } from './Members';

export default function Settings() {
  const society = useGet<Society>('/society');
  const blocks = useGet<List<Block>>('/blocks');
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader title="Settings" description="Society profile, blocks and your account." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Society profile" description="Contact support to change the registered name or address.">
          <Async q={society} skeleton={<Skeleton className="h-24" />}>
            {(s) => (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-sm">
                <dt className="text-fg-subtle">Name</dt><dd className="font-semibold">{s.name}</dd>
                <dt className="text-fg-subtle">Address</dt><dd>{s.addressLine}</dd>
                <dt className="text-fg-subtle">City</dt><dd>{s.city}, {s.state}</dd>
                <dt className="text-fg-subtle">Pincode</dt><dd className="tabular-nums">{s.pincode}</dd>
              </dl>
            )}
          </Async>
        </Card>
        <Card title="Blocks" actions={<Button size="sm" variant="outline" icon={Plus} onClick={() => setAdding(true)}>Add block</Button>}>
          <Async q={blocks} empty={<p className="text-body-sm text-fg-muted">No blocks yet. Add one to start creating flats.</p>} skeleton={<Skeleton className="h-16" />}>
            {(d) => (
              <ul className="flex flex-wrap gap-3">
                {d.items.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-body-sm">
                    <Building size={16} className="text-fg-subtle" aria-hidden /><span className="font-semibold">Block {b.name}</span><span className="text-fg-subtle">{b.flatCount} flats</span>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
        <AccountForm />
        <div className="space-y-6"><Appearance /><Memberships /></div>
      </div>
      <BlockModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
