import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Org, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  org: Org | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
    window.addEventListener('lf:unauthorized', handler);
    return () => window.removeEventListener('lf:unauthorized', handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User; org: Org }>('/auth/login', { body: { email, password } });
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
    () => ({ user, org, loading, login, signup, logout, refresh }),
    [user, org, loading, login, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Friendly message for an ApiError. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}
