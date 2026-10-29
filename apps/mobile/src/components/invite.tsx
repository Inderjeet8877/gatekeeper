import { Share, View } from 'react-native';
import type { PreApproval } from '@/lib/api';
import { formatDateTime, formatPasscode, humanize } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Card, LogoMark, Threshold, Txt } from './ui';

export const inviteText = (p: PreApproval, society: string) =>
  `You're invited to ${society} (${p.flat.label}). Show passcode ${formatPasscode(p.passcode ?? '')} to security at the gate. ` +
  `Valid until ${formatDateTime(p.validTo)}${p.maxUses > 1 ? ` for ${p.maxUses} entries` : ''}. — sent via Gatekeeper`;

export const shareInvite = (p: PreApproval, society: string) => Share.share({ message: inviteText(p, society) }).catch(() => {});

/** W8 invite pass card. */
export function InvitePass({ p, society }: { p: PreApproval; society: string }) {
  const t = useTheme();
  return (
    <Card style={{ gap: 14 }}>
      <Threshold />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <LogoMark size={28} />
        <View>
          <Txt v="label" c="fgHeading">{society}</Txt>
          <Txt v="caption" c="fgMuted">{humanize(p.type)} pass</Txt>
        </View>
      </View>
      <View>
        <Txt v="displayLg" c="fgHeading">{p.guestName}</Txt>
        <Txt v="bodySm" c="fgMuted">Visiting {p.flat.label}</Txt>
      </View>
      <Txt v="passcode" c="fgHeading" style={{ fontSize: 40, lineHeight: 48, textAlign: 'center', paddingVertical: 8 }} accessibilityLabel={`Passcode ${(p.passcode ?? '').split('').join(' ')}`}>
        {formatPasscode(p.passcode ?? '')}
      </Txt>
      <View style={{ height: 1, backgroundColor: t.colors.line }} />
      <Txt v="bodySm" c="fgMuted">
        Valid until {formatDateTime(p.validTo)} · {p.maxUses} {p.maxUses > 1 ? 'entries' : 'entry'}{'\n'}Show this code to security at the gate.
      </Txt>
    </Card>
  );
}
