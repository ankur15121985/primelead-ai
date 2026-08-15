import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useCreateLead } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { LEAD_SOURCES, PRIORITIES } from '@/lib/constants';

export function NewLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createLead = useCreateLead();
  const { success, error } = useToast();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', company: '', source: 'WEBSITE', priority: 'MEDIUM',
    expectedValue: '', notes: '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLead.mutateAsync({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        company: form.company || null,
        source: form.source,
        priority: form.priority,
        expectedValue: Number(form.expectedValue) || 0,
        notes: form.notes || null,
      });
      success('Lead created', `${form.name} captured${form.source !== 'MANUAL' ? ` from ${LEAD_SOURCES.find((s) => s.value === form.source)?.label}` : ''}.`);
      setForm({ name: '', phone: '', email: '', company: '', source: 'WEBSITE', priority: 'MEDIUM', expectedValue: '', notes: '' });
      onOpenChange(false);
    } catch (err) {
      error('Could not create lead', friendlyError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a new lead" description="Capture a lead — it will be auto-assigned to the least-loaded salesperson.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nl-name">Customer name *</Label>
              <Input id="nl-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ramesh Kumar" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-phone">Phone</Label>
              <Input id="nl-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98XXXXXXXX" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nl-email">Email</Label>
              <Input id="nl-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ramesh@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-company">Company</Label>
              <Input id="nl-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Kumar Interiors" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nl-source">Source</Label>
              <Select id="nl-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-priority">Priority</Label>
              <Select id="nl-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-value">Expected value (₹)</Label>
              <Input id="nl-value" type="number" min={0} value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} placeholder="100000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-notes">Notes</Label>
            <Textarea id="nl-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What are they looking for?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={createLead.isPending}>
              <Plus className="h-4 w-4" /> Create lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
