import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, auth, type AuthResult, type Membership, type User } from './api';

const TOKEN = 'gk-token';
const ACTIVE = 'gk-active-membership';

type Session = {
  booting: boolean;
  token: string | null;
  user: User | null;
  memberships: Membership[];
  member: Membership | null;
  loadError: string | null;
  signIn: (r: AuthResult) => Promise<void>;
  select: (m: Membership | null) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);
export const useSession = () => useContext(Ctx)!;

/** Admin memberships are web-only (docs/09 §5.1), so only auto-pick a sole non-admin membership. */
const autoPick = (ms: Membership[], storedId: string | null) =>
  ms.find((m) => m.id === storedId && m.role !== 'ADMIN') ?? (ms.length === 1 && ms[0].role !== 'ADMIN' ? ms[0] : null);

/** Where the current session belongs. */
export function homeFor(s: Pick<Session, 'token' | 'member'>) {
  if (!s.token) return '/welcome';
  if (!s.member) return '/societies';
  return s.member.role === 'GUARD' ? '/gate' : '/home';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [member, setMember] = useState<Membership | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyMember = useCallback((m: Membership | null) => {
    auth.societyId = m?.society.id ?? null;
    setMember(m);
  }, []);

  const signOut = useCallback(async () => {
    auth.token = null;
    auth.societyId = null;
    await Promise.all([SecureStore.deleteItemAsync(TOKEN), SecureStore.deleteItemAsync(ACTIVE)]).catch(() => {});
    qc.clear();
    setToken(null);
    setUser(null);
    setMemberships([]);
    setMember(null);
  }, [qc]);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: User; memberships: Membership[] }>('/me', { society: false });
      setLoadError(null);
      setUser(me.user);
      setMemberships(me.memberships);
      const stored = await SecureStore.getItemAsync(ACTIVE);
      applyMember(autoPick(me.memberships, stored));
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setLoadError((e as Error).message);
    }
  }, [applyMember]);

  useEffect(() => {
    auth.onUnauthorized = () => void signOut();
    (async () => {
      const t = await SecureStore.getItemAsync(TOKEN).catch(() => null);
      if (t) {
        auth.token = t;
        setToken(t);
        await refresh();
      }
      setBooting(false);
    })();
  }, [refresh, signOut]);

  const value = useMemo<Session>(
    () => ({
      booting, token, user, memberships, member, loadError, refresh, signOut,
      async signIn(r) {
        auth.token = r.token;
        await SecureStore.setItemAsync(TOKEN, r.token);
        setUser(r.user);
        setMemberships(r.memberships);
        setLoadError(null);
        applyMember(autoPick(r.memberships, await SecureStore.getItemAsync(ACTIVE)));
        setToken(r.token);
      },
      async select(m) {
        qc.clear(); // society switch: nothing cached may leak across tenants
        if (m) await SecureStore.setItemAsync(ACTIVE, m.id);
        applyMember(m);
      },
    }),
    [booting, token, user, memberships, member, loadError, refresh, signOut, applyMember, qc],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
