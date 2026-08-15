import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Org, User } from '@/types';

export interface LoginResult {
  user?: User;
  org?: Org;
  mfaRequired?: boolean;
  mfaToken?: string;
}

interface AuthContextValue {
  user: User | null;
  org: Org | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeMfa: (mfaToken: string, code: string, recovery?: boolean) => Promise<void>;
  signup: (input: { name: string; email: string; password: string; orgName: string; businessType?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User; org: Org }>('/auth/me');
      setUser(data.user);
      setOrg(data.org);
    } catch {
      setUser(null);
      setOrg(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setOrg(null);
    };
    window.addEventListener('pl:unauthorized', handler);
    return () => window.removeEventListener('pl:unauthorized', handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<LoginResult>('/auth/login', { body: { email, password } });
    // MFA challenge responses carry no session — only set state on a real session.
    if (data.user && data.org) {
      setUser(data.user);
      setOrg(data.org);
    }
    return data;
  }, []);

  const completeMfa = useCallback(async (mfaToken: string, code: string, recovery = false) => {
    const data = await api<{ user: User; org: Org }>(recovery ? '/auth/mfa/recovery' : '/auth/mfa/verify', {
      body: { mfaToken, code },
    });
    setUser(data.user);
    setOrg(data.org);
  }, []);

  const signup = useCallback(
    async (input: { name: string; email: string; password: string; orgName: string; businessType?: string }) => {
      const data = await api<{ user: User; org: Org }>('/auth/signup', { body: input });
      setUser(data.user);
      setOrg(data.org);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { body: {} });
    } catch {
      // ignore
    }
    setUser(null);
    setOrg(null);
  }, []);

  const value = useMemo(
    () => ({ user, org, loading, login, completeMfa, signup, logout, refresh }),
    [user, org, loading, login, completeMfa, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Friendly message for an ApiError. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}
