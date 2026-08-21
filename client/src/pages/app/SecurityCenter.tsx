import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

type AuditLog = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userName: string;
  userEmail: string | null;
  ip: string | null;
  metadata: unknown;
  createdAt: string;
};

type LoginEntry = {
  id: string;
  email: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  reason: string | null;
  newDevice: boolean;
  createdAt: string;
};

type Session = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  deviceName: string | null;
  lastUsedAt: string;
  createdAt: string;
};

type AuditStats = {
  total: number;
  last24h: number;
  lastWeek: number;
  topActions: Array<{ action: string; count: number }>;
  topEntities: Array<{ entity: string; count: number }>;
  activeUsers: Array<{ userId: string; name: string; count: number }>;
};

export function SecurityCenter() {
  const [tab, setTab] = useState<'audit' | 'logins' | 'sessions'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        api<{ data: { logs: AuditLog[]; pagination: { total: number } } }>(`/api/security/audit-logs?page=${page}&limit=20`),
        api<{ data: AuditStats }>('/api/security/audit-logs/stats'),
      ]);
      setAuditLogs(logsRes.data.logs);
      setAuditStats(statsRes.data);
    } catch { /* empty */ }
    setLoading(false);
  }, [page]);

  const fetchLogins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: { logs: LoginEntry[] } }>(`/api/security/login-history?page=${page}&limit=20`);
      setLoginLogs(res.data.logs);
    } catch { /* empty */ }
    setLoading(false);
  }, [page]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: { sessions: Session[] } }>('/api/security/sessions');
      setSessions(res.data.sessions);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    setPage(1);
    if (tab === 'audit') fetchAudit();
    else if (tab === 'logins') fetchLogins();
    else fetchSessions();
  }, [tab, fetchAudit, fetchLogins, fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    try {
      await api(`/api/security/sessions/${sessionId}/revoke`, { method: 'POST' });
      fetchSessions();
    } catch { /* empty */ }
  };

  const revokeAll = async () => {
    try {
      await api('/api/security/sessions/revoke-all', { method: 'POST' });
      fetchSessions();
    } catch { /* empty */ }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Center</h1>
      </div>

      <div className="flex gap-2">
        {(['audit', 'logins', 'sessions'] as const).map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'outline'} onClick={() => setTab(t)}>
            {t === 'audit' ? 'Audit Logs' : t === 'logins' ? 'Login History' : 'Active Sessions'}
          </Button>
        ))}
      </div>

      {/* ── Audit Logs ── */}
      {tab === 'audit' && (
        <>
          {auditStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{auditStats.total}</div>
                <div className="text-sm text-muted-foreground">Total Events</div>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{auditStats.last24h}</div>
                <div className="text-sm text-muted-foreground">Last 24 Hours</div>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{auditStats.lastWeek}</div>
                <div className="text-sm text-muted-foreground">Last 7 Days</div>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{auditStats.activeUsers.length}</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </CardContent></Card>
            </div>
          )}

          {auditStats && auditStats.topActions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Top Actions</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {auditStats.topActions.map((a) => (
                    <Badge key={a.action} tone="info">{a.action} ({a.count})</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-muted-foreground p-4">Loading…</div>
          ) : auditLogs.length === 0 ? (
            <EmptyState title="No audit logs" description="Audit events will appear here as users interact with the system." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3">Time</th>
                        <th className="p-3">User</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Entity</th>
                        <th className="p-3">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="p-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="p-3">{log.userName}</td>
                          <td className="p-3"><Badge>{log.action}</Badge></td>
                          <td className="p-3">{log.entity ?? '—'} {log.entityId ? <span className="text-xs text-muted-foreground">({log.entityId.slice(0, 8)})</span> : ''}</td>
                          <td className="p-3 font-mono text-xs">{log.ip ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </>
      )}

      {/* ── Login History ── */}
      {tab === 'logins' && (
        <>
          {loading ? (
            <div className="text-muted-foreground p-4">Loading…</div>
          ) : loginLogs.length === 0 ? (
            <EmptyState title="No login history" description="Login attempts will appear here." />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3">Time</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">IP</th>
                        <th className="p-3">Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="p-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="p-3">{log.email}</td>
                          <td className="p-3">
                            <Badge tone={log.success ? 'success' : 'danger'}>
                              {log.success ? 'Success' : 'Failed'}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{log.reason ?? '—'}</td>
                          <td className="p-3 font-mono text-xs">{log.ip ?? '—'}</td>
                          <td className="p-3 text-xs max-w-[200px] truncate">{log.userAgent ?? '—'} {log.newDevice ? '🆕' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </>
      )}

      {/* ── Active Sessions ── */}
      {tab === 'sessions' && (
        <>
          <div className="flex justify-end">
            <Button variant="destructive" onClick={revokeAll}>Revoke All Other Sessions</Button>
          </div>

          {loading ? (
            <div className="text-muted-foreground p-4">Loading…</div>
          ) : sessions.length === 0 ? (
            <EmptyState title="No active sessions" description="Your active sessions will appear here." />
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="font-medium">{s.deviceName ?? 'Unknown Device'}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.userAgent ?? 'No user agent'}</div>
                      <div className="text-xs text-muted-foreground">
                        IP: {s.ip ?? '—'} · Last active: {new Date(s.lastUsedAt).toLocaleString()}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => revokeSession(s.id)}>Revoke</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
