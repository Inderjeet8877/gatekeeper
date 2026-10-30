import { Building2, ExternalLink, House, LogOut, Monitor, ShieldCheck, BadgeCheck } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { Banner, Button, Empty, ErrorState, Row, Screen, Txt } from '@/components/ui';
import { WEB_URL, type Membership } from '@/lib/api';
import { formatPhone, humanize } from '@/lib/format';
import { useSession } from '@/lib/session';

const ROLE_ICON = { ADMIN: ShieldCheck, RESIDENT: House, GUARD: BadgeCheck } as const;

export default function Societies() {
  const s = useSession();
  const usable = s.memberships.filter((m) => m.role !== 'ADMIN');
  const adminOnly = s.memberships.length > 0 && usable.length === 0;
  const pick = (m: Membership) => s.select(m); // (auth) layout redirects once a membership is active

  return (
    <Screen
      title={adminOnly ? 'Admin tools are on the web' : 'Choose a society'}
      subtitle={s.user ? `Signed in as ${s.user.name} · ${formatPhone(s.user.phone)}` : undefined}
      footer={<Button title="Sign out" variant="ghost" icon={LogOut} onPress={s.signOut} />}
    >
      {s.loadError && <ErrorState error={new Error(s.loadError)} onRetry={s.refresh} />}
      {adminOnly && (
        <>
          <Banner tone="info" icon={Monitor} title="Use the web console for admin"
            body={`This app is for residents and security staff. To manage your society, open the Gatekeeper web console on your computer:
${WEB_URL}`} />
          <Button title="Open web console" variant="outline" icon={ExternalLink} onPress={() => Linking.openURL(WEB_URL).catch(() => {})} />
        </>
      )}
      {!s.loadError && s.memberships.length === 0 && (
        <Empty icon={Building2} title="You're not in a society yet"
          body={`Ask your society admin to add ${s.user ? formatPhone(s.user.phone) : 'your number'} to Gatekeeper, then check again.`}
          action={<Button title="Check again" variant="outline" onPress={s.refresh} />} />
      )}
      <View style={{ gap: 12 }}>
        {s.memberships.map((m) => {
          const admin = m.role === 'ADMIN';
          const flat = m.flat ? `${m.flat.block.name}-${m.flat.number}` : null;
          return (
            <Row
              key={m.id}
              icon={ROLE_ICON[m.role]}
              title={m.society.name}
              subtitle={[humanize(m.role), flat, m.society.city].filter(Boolean).join(' · ') + (admin ? '\nAdmin tools are on the web console.' : '')}
              onPress={admin ? undefined : () => pick(m)}
              a11y={`${m.society.name}, ${humanize(m.role)}${flat ? `, ${flat}` : ''}${admin ? ', available on the web console only' : ''}`}
            />
          );
        })}
      </View>
      {usable.length > 0 && s.memberships.length > usable.length && (
        <Txt v="caption" c="fgSubtle">Admin memberships are managed on the web console. Pick a resident or guard membership to continue.</Txt>
      )}
    </Screen>
  );
}
