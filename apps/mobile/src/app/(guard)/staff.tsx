import { router } from 'expo-router';
import { HandHelping, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { StaffRow } from '@/components/staff';
import { Banner, Button, Empty, Field, Q, Screen, Section } from '@/components/ui';
import type { Staff } from '@/lib/api';
import { useList } from '@/lib/hooks';

export default function StaffTab() {
  const [find, setFind] = useState('');
  const q = useList<Staff>(['staff', 'active'], '/staff?isActive=true', { live: true });
  const needle = find.trim().toLowerCase();
  return (
    <Screen title="Daily help">
      {/* The API has no manual check-in: entry and exit are recorded only by the staff passcode (spec §4.5). */}
      <Banner tone="info" icon={KeyRound} title="Check in and out on the Gate tab"
        body="Enter the staff member's 6-digit passcode on the Gate tab. Each entry toggles them in or out." />
      <Button title="Go to Gate" size="xl" variant="secondary" icon={KeyRound} onPress={() => router.navigate('/gate')} />
      <Field label="Search" value={find} onChangeText={setFind} placeholder="Name, job or flat" autoCorrect={false} />
      <Q q={q} rows={4} empty={<Empty icon={HandHelping} title="No daily help registered" body="The society admin adds maids, cooks and drivers on the web console." />}>
        {(all) => {
          const items = all.filter((s) => !needle || [s.name, s.category, ...s.flats.map((f) => f.label)].some((x) => x.toLowerCase().includes(needle)));
          const inside = items.filter((s) => s.isInside);
          const out = items.filter((s) => !s.isInside);
          return (
            <>
              {items.length === 0 && <Empty icon={HandHelping} title="No match" body="Check the spelling or clear the search." />}
              {inside.length > 0 && <Section title={`Inside now · ${inside.length}`}>{inside.map((s) => <StaffRow key={s.id} s={s} flats />)}</Section>}
              {out.length > 0 && <Section title={`Not in · ${out.length}`}>{out.map((s) => <StaffRow key={s.id} s={s} flats />)}</Section>}
            </>
          );
        }}
      </Q>
    </Screen>
  );
}
