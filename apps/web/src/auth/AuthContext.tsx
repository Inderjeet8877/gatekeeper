import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, session } from '../lib/api';
import type { AuthResponse, Membership, Role, User } from '../lib/types';

const SESSION_KEY = 'gk-session';
const ACTIVE_KEY = 'gk-active-membership';

type Stored = { token: string; user: User; memberships: Membership[] };
type Auth = {
  token: string | null;
  user: User | null;
  memberships: Membership[];
  active: Membership | null;
  login: (r: AuthResponse) => void;
  logout: () => void;
  select: (membershipId: string) => void;
  update: (p: Partial<Pick<Stored, 'user' | 'memberships'>>) => void;
};

const Ctx = createContext<Auth | null>(null);
export const useAuth = () => useContext(Ctx)!;

const read = (): Stored | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
};

export const roleHome = (m: Membership | null) =>
  !m ? '/app' : m.role === 'ADMIN' ? '/app/admin' : m.role === 'GUARD' ? '/app/gate' : '/app/home';

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [state, setState] = useState<Stored | null>(read);
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY));

  const memberships = state?.memberships ?? [];
  const active = memberships.find((m) => m.id === activeId) ?? (memberships.length === 1 ? memberships[0] : null);

  // Keep the request session in sync synchronously so the first queries carry the right headers.
  session.token = state?.token ?? null;
  session.societyId = active?.society.id ?? null;

  const save = useCallback((s: Stored | null) => {
    setState(s);
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  const logout = useCallback(() => {
    save(null);
    setActiveId(null);
    localStorage.removeItem(ACTIVE_KEY);
    session.token = null;
    session.societyId = null;
    qc.clear();
    navigate('/login', { replace: true });
  }, [qc, navigate, save]);

  session.onUnauthorized = logout;

  const select = useCallback((id: string) => {
    const m = state?.memberships.find((x) => x.id === id);
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    session.societyId = m?.society.id ?? null;
    qc.clear();
  }, [qc, state]);

  const login = useCallback((r: AuthResponse) => {
    save({ token: r.token, user: r.user, memberships: r.memberships });
    session.token = r.token;
    const remembered = r.memberships.find((m) => m.id === localStorage.getItem(ACTIVE_KEY));
    const pick = remembered ?? (r.memberships.length === 1 ? r.memberships[0] : null);
    setActiveId(pick?.id ?? null);
    if (pick) localStorage.setItem(ACTIVE_KEY, pick.id);
    session.societyId = pick?.society.id ?? null;
    qc.clear();
  }, [qc, save]);

  const update = useCallback((p: Partial<Pick<Stored, 'user' | 'memberships'>>) => {
    setState((s) => {
      if (!s) return s;
      const next = { ...s, ...p };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Refresh user + memberships once per load (also validates the token; a 401 logs out).
  const token = state?.token;
  useEffect(() => {
    if (!token) return;
    api<{ user: User; memberships: Membership[] }>('/me').then((r) => update(r)).catch(() => {});
  }, [token, update]);

  const value = useMemo<Auth>(() => ({
    token: state?.token ?? null, user: state?.user ?? null, memberships, active, login, logout, select, update,
  }), [state, memberships, active, login, logout, select, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Gate for /app/* role areas: signed in, has an active membership, role matches. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { token, active, memberships } = useAuth();
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!memberships.length) return <Navigate to="/app/welcome" replace />;
  if (!active) return <Navigate to="/app/societies" replace />;
  if (active.role !== role) return <Navigate to={roleHome(active)} replace />;
  return <>{children}</>;
}

/** /app index: route to the right home. */
export function AppEntry() {
  const { token, active, memberships } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!memberships.length) return <Navigate to="/app/welcome" replace />;
  if (!active) return <Navigate to="/app/societies" replace />;
  return <Navigate to={roleHome(active)} replace />;
}
