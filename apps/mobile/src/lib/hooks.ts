import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui';
import { api, errMsg, type List } from './api';
import { usePoll } from './realtime';

/** GET a `{ items }` list. Query keys start with the resource name so realtime events can invalidate by prefix. */
export function useList<T>(key: unknown[], path: string, o: { live?: boolean; enabled?: boolean; society?: boolean } = {}) {
  const poll = usePoll();
  return useQuery({
    queryKey: key,
    queryFn: () => api<List<T>>(path, { society: o.society }).then((r) => r.items),
    refetchInterval: o.live ? poll : false,
    enabled: o.enabled,
  });
}

/** Mutation that refreshes `invalidate` resources afterwards and toasts errors (unless `quiet`, for inline form errors). */
export function useAct<A, R>(
  fn: (a: A) => Promise<R>,
  o: { invalidate?: string[]; success?: string | ((r: R) => string); onSuccess?: (r: R) => void; quiet?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      const msg = typeof o.success === 'function' ? o.success(r) : o.success;
      if (msg) toast(msg);
      o.onSuccess?.(r);
    },
    onError: (e) => { if (!o.quiet) toast(errMsg(e), { tone: 'danger' }); },
    onSettled: () => o.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}
