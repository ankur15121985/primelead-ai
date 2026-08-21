import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

type DupGroup = { field: string; value: string; entityType: string; records: Array<Record<string, unknown> & { id: string; name: string }> };

export function Duplicates() {
  const [data, setData] = useState<{
    totalGroups: number;
    leads: { byEmail: DupGroup[]; byPhone: DupGroup[] };
    contacts: { byEmail: DupGroup[] };
    companies: { byDomain: DupGroup[] };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: typeof data }>('/api/duplicates');
      setData(res.data);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const merge = async (entityType: string, winnerId: string, loserId: string) => {
    const key = `${entityType}:${winnerId}:${loserId}`;
    setMerging(key);
    try {
      const endpoint = entityType === 'LEAD' ? 'leads' : entityType === 'CONTACT' ? 'contacts' : 'companies';
      await api(`/api/duplicates/merge/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId, loserId }),
      });
      fetchData();
    } catch { /* empty */ }
    setMerging(null);
  };

  if (loading) return <div className="p-8 text-muted-foreground">Scanning for duplicates…</div>;
  if (!data) return <div className="p-8 text-destructive">Failed to load duplicates.</div>;

  const allGroups = [
    ...data.leads.byEmail.map((g) => ({ ...g, label: 'Lead (email)' })),
    ...data.leads.byPhone.map((g) => ({ ...g, label: 'Lead (phone)' })),
    ...data.contacts.byEmail.map((g) => ({ ...g, label: 'Contact (email)' })),
    ...data.companies.byDomain.map((g) => ({ ...g, label: 'Company (domain)' })),
  ];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Duplicate Management</h1>
        <Button variant="outline" onClick={fetchData}>Refresh Scan</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{data.totalGroups}</div>
            <div className="text-sm text-muted-foreground">Duplicate Groups</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{data.leads.byEmail.length + data.leads.byPhone.length}</div>
            <div className="text-sm text-muted-foreground">Lead Duplicates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{data.contacts.byEmail.length}</div>
            <div className="text-sm text-muted-foreground">Contact Duplicates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{data.companies.byDomain.length}</div>
            <div className="text-sm text-muted-foreground">Company Duplicates</div>
          </CardContent>
        </Card>
      </div>

      {allGroups.length === 0 ? (
        <EmptyState title="No duplicates found" description="Your data is clean! No duplicate records were detected." />
      ) : (
        <div className="space-y-4">
          {allGroups.map((group, gi) => (
            <Card key={gi}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge>{group.label}</Badge>
                  <span className="text-muted-foreground font-normal">
                    {group.field}: <strong>{group.value}</strong> — {group.records.length} records
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">Name</th>
                        {group.records[0]?.email !== undefined && <th className="p-2">Email</th>}
                        {group.records[0]?.phone !== undefined && <th className="p-2">Phone</th>}
                        {group.records[0]?.company !== undefined && <th className="p-2">Company</th>}
                        {group.records[0]?.score !== undefined && <th className="p-2">Score</th>}
                        {group.records[0]?.domain !== undefined && <th className="p-2">Domain</th>}
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.records.map((record, ri) => (
                        <tr key={ri} className="border-b last:border-0">
                          <td className="p-2 font-medium">{record.name}</td>
                          {group.records[0]?.email !== undefined && <td className="p-2">{String(record.email ?? '—')}</td>}
                          {group.records[0]?.phone !== undefined && <td className="p-2">{String(record.phone ?? '—')}</td>}
                          {group.records[0]?.company !== undefined && <td className="p-2">{String(record.company ?? '—')}</td>}
                          {group.records[0]?.score !== undefined && <td className="p-2">{String(record.score ?? 0)}</td>}
                          {group.records[0]?.domain !== undefined && <td className="p-2">{String(record.domain ?? '—')}</td>}
                          <td className="p-2">
                            {ri > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={merging !== null}
                                onClick={() => merge(group.entityType, group.records[0].id, record.id)}
                              >
                                {merging === `${group.entityType}:${group.records[0].id}:${record.id}` ? 'Merging…' : 'Merge into #1'}
                              </Button>
                            )}
                            {ri === 0 && <Badge>Keep</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
