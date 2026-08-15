import { useState } from 'react';
import { Shield, UserPlus, Pencil } from 'lucide-react';
import { useTeam } from '@/hooks/queries';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ROLE_LABEL, ROLES } from '@/lib/constants';
import type { User } from '@/types';

export function Team() {
  const { user: me } = useAuth();
  const { data, isLoading } = useTeam();
  const { success, error } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const isManager = me && ['OWNER', 'ADMIN', 'MANAGER'].includes(me.role);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        description="Roles: Owner can do everything, Admin handles settings, Manager leads teams, Salesperson sees their own leads."
        actions={isManager ? <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Add member</Button> : undefined}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.users.map((u) => (
            <Card key={u.id} className="card-hover">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} className="h-11 w-11 text-sm" />
                    <div>
                      <p className="font-semibold">{u.name} {u.id === me?.id && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  {isManager && u.id !== me?.id && (
                    <button onClick={() => setEditUser(u)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent" aria-label={`Edit ${u.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge tone={u.role === 'OWNER' ? 'primary' : u.role === 'SALES' ? 'info' : 'default'}>{ROLE_LABEL[u.role] || u.role}</Badge>
                  <div className="flex items-center gap-2">
                    {u.title && <span className="text-xs text-muted-foreground">{u.title}</span>}
                    <span className={`h-2 w-2 rounded-full ${u.active ? 'bg-success' : 'bg-slate-300'}`} title={u.active ? 'Active' : 'Inactive'} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditMemberDialog user={editUser} onClose={() => setEditUser(null)} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { success, error } = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'SALES' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/team', { body: form });
      success('Member added', `${form.name} can now sign in with the email address.`);
      setForm({ name: '', email: '', role: 'SALES' });
      onOpenChange(false);
    } catch (err) {
      error('Could not add member', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a team member" description="New members sign in with their email and the password you set below.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Full name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Karan Mehta" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="karan@company.com" /></div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={busy}><Shield className="h-4 w-4" /> Add member</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { success, error } = useToast();
  const [role, setRole] = useState(user?.role || 'SALES');
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api(`/team/${user.id}`, { method: 'PATCH', body: { role, active } });
      success('Member updated');
      onClose();
    } catch (err) {
      error('Could not update', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={`Manage ${user?.name || ''}`} description="Adjust role and access.">
        {user && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive members cannot sign in.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={save} loading={busy}>Save</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
