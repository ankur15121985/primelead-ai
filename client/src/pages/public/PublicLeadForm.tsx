import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  QrCode, CheckCircle2, Send, ArrowLeft, Sparkles, AlertCircle, Loader2,
} from 'lucide-react';
import { usePublicQrMeta, useSubmitPublicLead } from '@/hooks/queries';
import { friendlyError } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

const FIELD_META: Record<string, { label: string; placeholder: string; type: string; required: boolean }> = {
  name: { label: 'Your name', placeholder: 'e.g. Ramesh Kumar', type: 'text', required: true },
  phone: { label: 'Phone number', placeholder: 'e.g. 98100 12345', type: 'tel', required: false },
  email: { label: 'Email address', placeholder: 'you@example.com', type: 'email', required: false },
  message: { label: 'Message / enquiry', placeholder: 'What are you looking for?', type: 'textarea', required: false },
};

export function PublicLeadForm() {
  const { slug = '' } = useParams();
  const { data: meta, isLoading, error: metaError } = usePublicQrMeta(slug);
  const submitLead = useSubmitPublicLead();
  const [form, setForm] = useState<Record<string, string>>({ name: '', phone: '', email: '', message: '' });
  const [done, setDone] = useState<{ message: string; duplicate: boolean } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // A name is always required for a lead — even if the owner configured
  // a QR that omits it, we still ask for it.
  const fields = meta?.fields || ['name', 'phone', 'email', 'message'];
  const formFields = fields.includes('name') ? fields : ['name', ...fields];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const res = await submitLead.mutateAsync({ slug, ...form });
      setDone({ message: res.message, duplicate: Boolean(res.duplicate) });
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Slim top strip — never blocks the form */}
      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 pt-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {meta?.orgName || 'Business'}
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <div className="flex items-center gap-2 text-primary">
          <QrCode className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">{meta?.orgName || 'Enquiry form'}</span>
        </div>

        {done ? (
          <Card className="mt-8 flex flex-col items-center border-success/30 bg-white p-10 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              {done.duplicate ? <Sparkles className="h-8 w-8 text-success" /> : <CheckCircle2 className="h-8 w-8 text-success" />}
            </div>
            <h1 className="mt-5 text-xl font-bold">{done.duplicate ? 'You are already with us!' : 'Thank you!'}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{done.message}</p>
            <p className="mt-4 text-xs text-muted-foreground">Our team typically responds within one business day.</p>
          </Card>
        ) : metaError ? (
          <Card className="mt-8 flex flex-col items-center border-destructive/30 bg-white p-10 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="mt-5 text-xl font-bold">Link not available</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {friendlyError(metaError)} If you think this is a mistake, contact the business directly.
            </p>
          </Card>
        ) : isLoading ? (
          <div className="mt-8 flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Opening the form…</p>
          </div>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{meta?.title}</h1>
            {meta?.description && <p className="mt-1.5 text-sm text-muted-foreground">{meta.description}</p>}

            <Card className="mt-6 border-none bg-white p-6 shadow-sm">
              <form onSubmit={submit} className="space-y-4">
                {formFields.map((f) => {
                  const m = FIELD_META[f] || FIELD_META.name;
                  if (m.type === 'textarea') {
                    return (
                      <div key={f} className="space-y-1.5">
                        <Label htmlFor={`f-${f}`}>{m.label}</Label>
                        <Textarea
                          id={`f-${f}`}
                          rows={3}
                          value={form[f] || ''}
                          onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                          placeholder={m.placeholder}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={f} className="space-y-1.5">
                      <Label htmlFor={`f-${f}`}>{m.label}</Label>
                      <Input
                        id={`f-${f}`}
                        type={m.type}
                        required={m.required}
                        value={form[f] || ''}
                        onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                        placeholder={m.placeholder}
                        autoComplete={f === 'name' ? 'name' : f === 'email' ? 'email' : f === 'phone' ? 'tel' : undefined}
                      />
                    </div>
                  );
                })}

                {submitError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{submitError}</p>
                )}

                <Button type="submit" className="w-full" size="lg" loading={submitLead.isPending}>
                  <Send className="h-4 w-4" /> Submit enquiry
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Your details go straight to {meta?.orgName || 'the business'} — no spam, ever.
                </p>
              </form>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
