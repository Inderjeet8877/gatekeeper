import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ui';

export const API_URL =
  ((import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

/** Mutable session read by every request; AuthContext keeps it in sync. */
export const session = {
  token: null as string | null,
  societyId: null as string | null,
  onUnauthorized: () => {},
};

export type Query = Record<string, string | number | boolean | null | undefined>;

const qs = (q?: Query) => {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export async function api<T>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Query } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (session.societyId) headers['X-Society-Id'] = session.societyId;

  let res: Response;
  try {
    res = await fetch(API_URL + path + qs(opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK', "Couldn't reach Gatekeeper. Check your connection and try again.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    if (res.status === 401 && session.token) session.onUnauthorized();
    throw new ApiError(e?.code ?? 'INTERNAL_ERROR', e?.message ?? `Request failed (${res.status})`, res.status, e?.details);
  }
  return data as T;
}

export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

/** Query keys are the path segments (+ query), so ['visitors'] invalidates every visitors list. */
export const keyOf = (path: string, query?: Query) => [...path.split('/').filter(Boolean), ...(query ? [query] : [])];

export function useGet<T>(path: string | null, query?: Query, opts: { refetchInterval?: number } = {}) {
  return useQuery<T, ApiError>({
    queryKey: keyOf(path ?? '', query),
    queryFn: () => api<T>(path!, { query }),
    enabled: !!path,
    refetchInterval: opts.refetchInterval,
  });
}

/**
 * Mutation that refetches everything on screen on success (lists are small; stays correct without per-key bookkeeping)
 * and toasts the API's human message on failure.
 */
export function useAct<V = void, R = unknown>(
  fn: (v: V) => Promise<R>,
  o: { success?: string | ((r: R, v: V) => string); onSuccess?: (r: R, v: V) => void; quiet?: boolean } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<R, ApiError, V>({
    mutationFn: fn,
    onSuccess: (r, v) => {
      qc.invalidateQueries();
      if (o.success) toast(typeof o.success === 'function' ? o.success(r, v) : o.success, 'success');
      o.onSuccess?.(r, v);
    },
    onError: (e) => { if (!o.quiet) toast(e.message, 'danger'); },
  });
}
