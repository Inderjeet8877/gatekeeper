import { Check, Info, Megaphone, OctagonAlert, PartyPopper, Pin, Vote, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, Empty, I, Q, Screen, Section, StatusChip, Txt } from '@/components/ui';
import { api, type Notice, type NoticeCategory, type Poll } from '@/lib/api';
import { formatDate, formatRelative, humanize } from '@/lib/format';
import { useAct, useList } from '@/lib/hooks';
import { STATUS } from '@/lib/status';
import { useTheme } from '@/lib/theme';

const NOTICE_ICON: Record<NoticeCategory, typeof Info> = { GENERAL: Info, MAINTENANCE: Wrench, EVENT: PartyPopper, URGENT: OctagonAlert };

export default function Community() {
  const notices = useList<Notice>(['notices'], '/notices?limit=50');
  const polls = useList<Poll>(['polls'], '/polls?limit=20');
  return (
    <Screen title="Community">
      <Section title="Polls">
        <Q q={polls} rows={1} empty={<Empty icon={Vote} title="No polls right now" body="When the committee asks residents to decide something, you'll vote here." />}>
          {(items) => items.map((p) => <PollCard key={p.id} p={p} />)}
        </Q>
      </Section>
      <Section title="Notices">
        <Q q={notices} rows={3} empty={<Empty icon={Megaphone} title="No notices yet" body="Notices from the committee will appear here." />}>
          {(items) => items.map((n) => <NoticeCard key={n.id} n={n} />)}
        </Q>
      </Section>
    </Screen>
  );
}

function NoticeCard({ n }: { n: Notice }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card onPress={() => setOpen((o) => !o)} style={{ gap: 8 }} a11y={`${n.isPinned ? 'Pinned. ' : ''}${n.title}. ${open ? 'Collapse' : 'Expand'}`}
      accent={n.category === 'URGENT' ? t.colors.danger : undefined}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {n.isPinned && (
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: t.colors.status.info.bg }}>
            <I icon={Pin} size={14} color={t.colors.status.info.fg} />
            <Txt v="caption" color={t.colors.status.info.fg}>Pinned</Txt>
          </View>
        )}
        <Badge label={humanize(n.category)} icon={NOTICE_ICON[n.category]} />
      </View>
      <Txt v="h3" c="fgHeading">{n.title}</Txt>
      <Txt v="body" c="fgMuted" numberOfLines={open ? undefined : 3}>{n.body}</Txt>
      <Txt v="caption" c="fgSubtle">{n.createdBy.name} · {formatRelative(n.createdAt)}</Txt>
    </Card>
  );
}

function PollCard({ p }: { p: Poll }) {
  const t = useTheme();
  const [choice, setChoice] = useState<string | null>(null);
  const vote = useAct((optionId: string) => api<Poll>(`/polls/${p.id}/vote`, { method: 'POST', body: { optionId } }), {
    invalidate: ['polls'], success: 'Vote recorded.',
  });
  const showResults = !!p.myVoteOptionId || p.isClosed;
  const top = Math.max(...p.options.map((o) => o.votes));
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <StatusChip spec={STATUS.poll[p.isClosed ? 'CLOSED' : 'OPEN']} />
        <Txt v="caption" c="fgSubtle">{p.closesAt ? `${p.isClosed ? 'Closed' : 'Closes'} ${formatDate(p.closesAt)}` : ''}</Txt>
      </View>
      <Txt v="h3" c="fgHeading">{p.question}</Txt>
      <View style={{ gap: 8 }} accessibilityRole={showResults ? undefined : 'radiogroup'}>
        {p.options.map((o) => {
          const pct = p.totalVotes ? Math.round((o.votes / p.totalVotes) * 100) : 0;
          const mine = o.id === p.myVoteOptionId;
          if (showResults) {
            return (
              <View key={o.id} style={{ gap: 4 }} accessible accessibilityLabel={`${o.text}, ${pct} percent, ${o.votes} votes${mine ? ', your vote' : ''}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt v="label">{o.text}{mine ? '  · Your vote' : ''}</Txt>
                  <Txt v="label" c="fgMuted" style={{ fontVariant: ['tabular-nums'] }}>{pct}% · {o.votes}</Txt>
                </View>
                <View style={{ height: 6, borderRadius: 4, backgroundColor: t.colors.line, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: 6, backgroundColor: o.votes === top ? t.colors.brand : t.colors.navyHover }} />
                </View>
              </View>
            );
          }
          const sel = choice === o.id;
          return (
            <Pressable key={o.id} onPress={() => setChoice(o.id)} accessibilityRole="radio" accessibilityState={{ selected: sel }}
              style={{ minHeight: 52, borderRadius: 10, borderWidth: sel ? 2 : 1, borderColor: sel ? t.colors.brand : t.colors.lineStrong, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: sel ? t.colors.brand : t.colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? t.colors.brand : 'transparent' }}>
                {sel && <I icon={Check} size={14} color="#fff" />}
              </View>
              <Txt v="body" style={{ flex: 1 }}>{o.text}</Txt>
            </Pressable>
          );
        })}
      </View>
      {showResults ? (
        <Txt v="caption" c="fgSubtle">{p.totalVotes} vote{p.totalVotes === 1 ? '' : 's'}</Txt>
      ) : (
        <Button title="Submit vote" disabled={!choice} loading={vote.isPending} onPress={() => choice && vote.mutate(choice)} />
      )}
    </Card>
  );
}
