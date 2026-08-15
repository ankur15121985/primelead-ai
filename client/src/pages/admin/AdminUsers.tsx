import { useState } from 'react';
import { Users as UsersIcon, Ban, CheckCircle2 } from 'lucide-react';
import { useAdminUsers, useAdminUpdateUser } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/format';

export function AdminUsers() {
  const { data, isLoading, refetch } = useAdminUsers();
  const updateUser = useAdminUpdateUser();
  const { success, error } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (id: string, name: string, active: boolean) => {
    setBusyId(id);
    try {
      await updateUser.mutateAsync({ id, active: !active });
      success(active ? 'Account deactivated' : 'Account re-activated', `${name}'s access was updated.`);
      refetch();
    } catch (err) {
      error('Update failed', friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const users = data?.users || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Every account on the platform, across all organizations."
      />

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b px-5 py-3.5">
            <UsersIcon className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold">{users.length} accounts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-3 hover:bg-slate-50/60">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {u.name}
                    {!u.active && <span className="ml-2 text-xs font-normal text-destructive">deactivated</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{u.org?.name}</p>
                  <p className="text-[11px] text-muted-foreground">joined {formatDate(u.createdAt)}</p>
                </div>
                <Badge tone={u.org?.status === 'ACTIVE' ? 'muted' : 'danger'}>{u.org?.status === 'ACTIVE' ? u.org?.plan || '—' : 'Suspended'}</Badge>
                <Badge tone={u.active ? 'primary' : 'muted'}>{u.role}</Badge>
                <Button
                  variant={u.active ? 'outline' : 'primary'}
                  size="sm"
                  loading={busyId === u.id}
                  onClick={() => toggle(u.id, u.name, u.active)}
                >
                  {u.active ? <><Ban className="h-4 w-4" /> Deactivate</> : <><CheckCircle2 className="h-4 w-4" /> Re-activate</>}
                </Button>
              </div>
            ))}
            {users.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No users yet.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
