import { useState } from 'react';
import { Shield, UserPlus, Pencil, Users, Trash2, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { ROLE_LABEL } from '@/lib/constants';
import type { Role, Team, User } from '@/types';

/** Load the org's roles (system + custom) for role pickers. */
function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ roles: Role[] }>('/roles'),
    staleTime: 60_000,
  });
}

/** Load the org's teams for the team picker and management list. */
function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => api<{ teams: Team[] }>('/teams'),
    staleTime: 30_000,
  });
}

const roleTone = (key: string) =>
  key === 'OWNER' ? 'primary' : key === 'ADMIN' ? 'danger' : key === 'SALES' || key === 'SUPPORT' ? 'info' : 'default';

export function Team() {
  const { user: me } = useAuth();
  const { data, isLoading } = useTeam();
  const { data: teamsData } = useTeams();
  const { success, error } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const isManager = me && ['OWNER', 'ADMIN', 'MANAGER'].includes(me.role);
  const teamOf = (u: User) => teamsData?.teams.find((t) => t.members.some((m) => m.id === u.id));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        description="Owner can do everything, Admin handles settings, Manager leads teams, Salesperson sees their own leads."
        actions={
          isManager ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTeamDialogOpen(true)}><Users className="h-4 w-4" /> Teams</Button>
              <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Add member</Button>
            </div>
          ) : undefined
        }
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
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={roleTone(u.role)}>{ROLE_LABEL[u.role] || u.role}</Badge>
                  <div className="flex items-center gap-2">
                    {teamOf(u) && <Badge tone="muted">{teamOf(u)!.name}</Badge>}
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
      <TeamsDialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen} />
    </div>
  );
}

function roleOptions(roles?: Role[]) {
  if (!roles || roles.length === 0) return null;
  return roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>);
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { success, error } = useToast();
  const { data: roles } = useRoles();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', role: 'SALES' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/team', { body: form });
      await qc.invalidateQueries({ queryKey: ['team'] });
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
              {roleOptions(roles?.roles) ?? Object.keys(ROLE_LABEL).map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
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
  const { data: roles } = useRoles();
  const { data: teamsData } = useTeams();
  const qc = useQueryClient();
  const [role, setRole] = useState(user?.role || 'SALES');
  const [active, setActive] = useState(user?.active ?? true);
  const [teamId, setTeamId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api(`/team/${user.id}`, { method: 'PATCH', body: { role, active, teamId: teamId || null } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['team'] }), qc.invalidateQueries({ queryKey: ['teams'] })]);
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
      <DialogContent title={`Manage ${user?.name || ''}`} description="Adjust role, team and access.">
        {user && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {roleOptions(roles?.roles) ?? Object.keys(ROLE_LABEL).map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">No team</option>
                {teamsData?.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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

function TeamsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { success, error } = useToast();
  const { data } = useTeams();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api('/teams', { body: { name: name.trim(), description: description.trim() || undefined } });
      await qc.invalidateQueries({ queryKey: ['teams'] });
      success('Team created');
      setName('');
      setDescription('');
    } catch (err) {
      error('Could not create team', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteTeam = async (id: string, teamName: string) => {
    if (!window.confirm(`Delete the "${teamName}" team? Members are kept but unassigned.`)) return;
    try {
      await api(`/teams/${id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['teams'] });
      await qc.invalidateQueries({ queryKey: ['team'] });
      success('Team deleted');
    } catch (err) {
      error('Could not delete team', friendlyError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Teams" description="Group members into teams. Teams make assignment and reporting easier later.">
        <div className="space-y-4">
          <form onSubmit={createTeam} className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-semibold">Create a team</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales — North" required />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            <Button type="submit" size="sm" loading={busy}><Plus className="h-3.5 w-3.5" /> Create team</Button>
          </form>
          <div className="space-y-2">
            {data?.teams.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.memberCount} member(s){t.description ? ` · ${t.description}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteTeam(t.id, t.name)} aria-label={`Delete ${t.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {data && data.teams.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No teams yet. Create one to start grouping your members.
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
