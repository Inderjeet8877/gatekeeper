import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from './api';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/ui';
import type { Notification } from './types';

/** Notification type → query keys it makes stale. */
const BY_TYPE: Record<string, string[]> = {
  TICKET_CREATED: ['tickets'], TICKET_UPDATED: ['tickets'], TICKET_COMMENT: ['tickets'],
  INVOICE_GENERATED: ['invoices'], PAYMENT_RECEIVED: ['invoices', 'reports'],
  STAFF_ENTRY: ['staff'], STAFF_EXIT: ['staff'], POLL_CREATED: ['polls'], NOTICE_POSTED: ['notices'],
  VISITOR_ARRIVED: ['visitors'], VISITOR_REQUESTED: ['visitors'],
};

/**
 * One SSE stream per (user, active society). Invalidates the affected queries and toasts notifications.
 * EventSource reconnects by itself on network drops (server sends retry: 5000); if the server rejects the
 * stream (4xx → CLOSED) we retry every 10 s. No replay, so everything is refetched after a reconnect.
 */
export function useEvents(): boolean {
  const { token, active } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [live, setLive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const societyId = active?.society.id;

  useEffect(() => {
    if (!token || !societyId) return;
    const es = new EventSource(`${API_URL}/events?token=${encodeURIComponent(token)}&societyId=${encodeURIComponent(societyId)}`);
    let timer: number | undefined;
    let opened = false;
    const inv = (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

    es.onopen = () => {
      setLive(true);
      if (opened) qc.invalidateQueries();
      opened = true;
    };
    es.onerror = () => {
      setLive(false);
      if (es.readyState === EventSource.CLOSED) timer = window.setTimeout(() => setAttempt((a) => a + 1), 10_000);
    };
    es.addEventListener('visitor.requested', () => inv('visitors', 'reports'));
    es.addEventListener('visitor.updated', () => inv('visitors', 'reports', 'preapprovals'));
    es.addEventListener('sos.raised', () => inv('sos', 'reports'));
    es.addEventListener('sos.updated', () => inv('sos', 'reports'));
    es.addEventListener('notice.created', () => inv('notices'));
    es.addEventListener('notification', (e) => {
      inv('notifications');
      let n: Notification | null = null;
      try { n = JSON.parse((e as MessageEvent).data); } catch { /* ignore malformed */ }
      if (!n) return;
      inv(...(BY_TYPE[n.type] ?? []));
      // SOS has its own takeover; never toast it.
      if (!n.type.startsWith('SOS')) toast(n.body, 'info', n.title);
    });

    return () => { es.close(); window.clearTimeout(timer); setLive(false); };
  }, [token, societyId, attempt, qc, toast]);

  return live;
}
