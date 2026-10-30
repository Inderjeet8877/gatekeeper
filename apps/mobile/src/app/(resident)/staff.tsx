import { HandHelping } from 'lucide-react-native';
import { StaffRow } from '@/components/staff';
import { Empty, Q, Screen } from '@/components/ui';
import type { Staff } from '@/lib/api';
import { useList } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function DailyHelp() {
  const { member } = useSession();
  const flat = member?.flat ? `${member.flat.block.name}-${member.flat.number}` : 'your flat';
  const q = useList<Staff>(['staff'], `/staff?flatId=${member?.flat?.id ?? ''}`);
  return (
    <Screen back title="Daily help" subtitle={`Staff linked to ${flat} · today's attendance`}>
      <Q q={q} rows={3} empty={<Empty icon={HandHelping} title={`No daily help linked to ${flat}`} body="Ask the society admin to register your maid, cook or driver and link them to your flat." />}>
        {(items) => items.map((s) => <StaffRow key={s.id} s={s} />)}
      </Q>
    </Screen>
  );
}
