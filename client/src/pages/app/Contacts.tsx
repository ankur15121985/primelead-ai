import { useState } from 'react';
import { Users, Plus, Search, Pencil, Trash2, Phone, Mail, Building2 } from 'lucide-react';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Contact } from '@/types';

export function Contacts() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const { data, isLoading } = useContacts(search);
  const deleteC = useDeleteContact();
  const { success, error } = useToast();

  const contacts = data?.contacts || [];

  const remove = async (c: Contact) => {
    if (!window.confirm(`Delete ${c.name} from your contacts?`)) return;
    try {
      await deleteC.mutateAsync(c.id);
      success('Deleted', `${c.name} was removed.`);
    } catch (err) {
      error('Could not delete', friendlyError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        description="Your customer directory — everyone you do business with, in one place."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add contact</Button>}
      />

      <div className="relative sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, phone, email, company…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title={search ? 'No matching contacts' : 'No contacts yet'}
          description={search ? 'Try a different search.' : 'Add your customers and business contacts here, or they appear automatically when linked to leads.'}
          action={!search ? <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add your first contact</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => (
            <Card key={c.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {c.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    {c.company && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" /> {c.company}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {c.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {c.phone}</p>}
                {c.email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {c.email}</p>}
              </div>
              {(c.tags?.length || c.lead) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(c.tags || []).map((t) => <Badge key={t} tone="muted">{t}</Badge>)}
                  {c.lead && <Badge tone="primary">Lead: {c.lead.name}</Badge>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ContactDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
      {editing && <ContactDialog open onOpenChange={() => setEditing(null)} mode="edit" contact={editing} />}
    </div>
  );
}

function ContactDialog({
  open, onOpenChange, mode, contact,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  contact?: Contact;
}) {
  const createC = useCreateContact();
  const updateC = useUpdateContact();
  const { success, error } = useToast();
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    company: contact?.company || '',
    notes: contact?.notes || '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'edit' && contact) {
        await updateC.mutateAsync({ id: contact.id, ...form });
        success('Contact updated', `${form.name} was saved.`);
        onOpenChange(false);
      } else {
        await createC.mutateAsync(form);
        success('Contact added', `${form.name} is in your directory.`);
        onOpenChange(false);
      }
    } catch (err) {
      error('Could not save contact', friendlyError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={mode === 'edit' ? 'Edit contact' : 'Add contact'} description="Keep your customer details handy — linked leads show up automatically.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-company">Company</Label>
            <Input id="c-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferences, how you met, reminders…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={mode === 'edit' ? updateC.isPending : createC.isPending}>{mode === 'edit' ? 'Save changes' : 'Add contact'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
