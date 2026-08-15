import { useState } from 'react';
import { Mail, MapPin, MessageSquare, Phone, Send } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { friendlyError } from '@/hooks/use-auth';

export function Contact() {
  useSeo('Contact — PRIMELEAD AI', 'Get in touch with the PRIMELEAD AI team.');
  const { success, error } = useToast();
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await api<{ message: string }>('/contact', { body: form });
      success('Message sent', res.message);
      setForm({ name: '', email: '', company: '', message: '' });
    } catch (err) {
      error('Could not send', friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container max-w-5xl py-16">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">Contact</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Talk to a human</h1>
          <p className="mt-4 text-muted-foreground">
            Whether it's a demo for your team, a question about pricing, or help moving from Excel — we're happy to help.
          </p>
          <div className="mt-10 space-y-5">
            {[
              { icon: Mail, label: 'Email', value: 'hello@primelead.example' },
              { icon: Phone, label: 'Phone / WhatsApp', value: '+91 98xxx xxxxx (Mon–Sat, 10am–7pm IST)' },
              { icon: MapPin, label: 'Office', value: 'Bengaluru, Karnataka, India' },
              { icon: MessageSquare, label: 'Languages', value: 'English · हिन्दी · Hinglish' },
            ].map((c) => (
              <div key={c.label} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className="font-medium">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border bg-card p-7 shadow-sm">
          <h2 className="text-lg font-semibold">Send us a message</h2>
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Your name *</Label>
                <Input id="c-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ramesh Kumar" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email *</Label>
                <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-company">Company</Label>
              <Input id="c-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Your business name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-msg">Message *</Label>
              <Textarea id="c-msg" required minLength={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us what you need…" className="min-h-[120px]" />
            </div>
            <Button type="submit" loading={sending} className="w-full" size="lg">
              <Send className="h-4 w-4" /> Send message
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
