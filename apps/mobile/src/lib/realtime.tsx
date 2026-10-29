// SSE (spec §5) via react-native-sse. While the stream is down, list queries poll every 5 s instead (usePoll).
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Vibration } from 'react-native';
import EventSource from 'react-native-sse';
import { toast } from '@/components/ui';
import { API_URL, qs, type SosAlert, type Visitor } from './api';
import { formatTime, humanize } from './format';
import { useSession } from './session';

const EVENTS = ['visitor.requested', 'visitor.updated', 'sos.raised', 'sos.updated', 'notice.created', 'notification'] as const;
type Ev = (typeof EVENTS)[number];
const KEY: Record<Ev, string> = {
  'visitor.requested': 'visitors', 'visitor.updated': 'visitors', 'sos.raised': 'sos', 'sos.updated': 'sos',
  'notice.created': 'notices', notification: 'notifications',
};

const LiveCtx = createContext(false);
export const useLive = () => useContext(LiveCtx);
/** refetchInterval for live lists: off while SSE is connected, 5 s otherwise. */
export const usePoll = () => (useContext(LiveCtx) ? false : 5000);

export const sosTitle = (a: Pick<SosAlert, 'type' | 'flat'>) =>
  `${a.type === 'OTHER' ? 'Emergency' : `${humanize(a.type)} emergency`} — ${a.flat?.label ?? 'Common area'}`;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token, member } = useSession();
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const societyId = member?.society.id;
  const role = member?.role;

  useEffect(() => {
    if (!token || !societyId) return;
    let opened = false;
    const es = new EventSource<Ev>(`${API_URL}/events${qs({ token, societyId })}`, { pollingInterval: 5000 });
    es.addEventListener('open', () => {
      setLive(true);
      if (opened) qc.invalidateQueries(); // no replay on reconnect (spec §5.1) → refetch what's on screen
      opened = true;
    });
    es.addEventListener('error', () => setLive(false));
    for (const ev of EVENTS) {
      es.addEventListener(ev, (e) => {
        qc.invalidateQueries({ queryKey: [KEY[ev]] });
        let data: unknown = null;
        try { data = JSON.parse(e.data ?? 'null'); } catch { /* ignore malformed frame */ }
        if (!data) return;
        if (ev === 'visitor.requested' && role === 'RESIDENT') {
          const v = data as Visitor;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          Vibration.vibrate(400);
          toast(`${v.name} is at the gate`, {
            tone: 'warning',
            body: `${humanize(v.type)}${v.company ? ` from ${v.company}` : ''} for ${v.flat.label}. Tap to respond.`,
            onPress: () => router.navigate('/home'),
          });
        }
        if (ev === 'sos.raised' && role === 'GUARD') {
          const a = data as SosAlert;
          Vibration.vibrate([0, 700, 300, 700, 300, 700]);
          toast(sosTitle(a), {
            tone: 'danger',
            body: `Raised by ${a.raisedBy.name} at ${formatTime(a.createdAt)}. Acknowledge to let them know you're on the way.`,
            onPress: () => router.navigate('/alerts'),
          });
        }
      });
    }
    return () => {
      es.removeAllEventListeners();
      es.close();
      setLive(false);
    };
  }, [token, societyId, role, qc]);

  return <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>;
}
