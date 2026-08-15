import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    q: 'Do I need technical knowledge to use LeadFlow?',
    a: 'No. If you can use WhatsApp, you can use LeadFlow. Set up takes about 3 minutes, and the dashboard is designed for a non-technical business owner. Your sales team can start working the same day.',
  },
  {
    q: 'How does automatic lead assignment work?',
    a: 'You can set rules: least-loaded salesperson, round-robin, or per-source assignment (e.g. "all Website leads go to Karan"). Managers can reassign any lead manually, and every assignment is logged.',
  },
  {
    q: 'Does the AI really write follow-ups in Hindi and Hinglish?',
    a: 'Yes. The AI reads the lead\'s history — notes, stage, last contact — and writes a follow-up in English, Hindi or Hinglish, in Professional, Friendly, Short or Persuasive tones. You always edit before sending.',
  },
  {
    q: 'Is my data safe? Is it shared between companies?',
    a: 'Each organisation\'s data is fully isolated — the AI assistant can only ever see your own company\'s data. Passwords are hashed, sessions are secure, and sensitive actions are audit-logged. You can export your data anytime.',
  },
  {
    q: 'Can I use LeadFlow on mobile?',
    a: 'Absolutely. The app is mobile-first with bottom navigation, big touch targets and a phone-friendly lead view, so salespeople can call, WhatsApp, add notes and change stages on the go.',
  },
  {
    q: 'What happens when my free trial ends?',
    a: 'Your data is never deleted. You can pick a paid plan or drop back to the free Starter plan and keep your leads.',
  },
  {
    q: 'Does LeadFlow support GST quotations and invoices?',
    a: 'Yes. Quotations and invoices support CGST+SGST (intra-state) and IGST (inter-state), per-item taxes, discounts, GSTIN fields, HSN/SAC and PDF download.',
  },
  {
    q: 'Can I connect WhatsApp Business?',
    a: 'Yes — the architecture is built for the WhatsApp Business API. Connect with your credentials in Settings. Without credentials, the app clearly shows a "Connect WhatsApp" screen rather than pretending.',
  },
];

export function FAQ() {
  useSeo('FAQ — LeadFlow AI', 'Answers to common questions about LeadFlow AI.');
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="container max-w-3xl py-16">
      <div className="text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">FAQ</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Frequently asked questions</h1>
        <p className="mt-3 text-muted-foreground">Everything you need to know before starting. Still unsure? <Link to="/contact" className="font-semibold text-primary hover:underline">Contact us</Link>.</p>
      </div>

      <div className="mt-12 space-y-3">
        {FAQS.map((f, i) => (
          <div key={f.q} className="overflow-hidden rounded-2xl border bg-card">
            <button
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              <span className="font-semibold">{f.q}</span>
              <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', open === i && 'rotate-180')} />
            </button>
            {open === i && (
              <p className="border-t bg-slate-50/60 px-6 py-4 text-sm leading-relaxed text-muted-foreground animate-fade-in">
                {f.a}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-3xl bg-slate-50 p-8 text-center">
        <h2 className="text-xl font-bold">Still have questions?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Our team replies within one business day — in English or हिन्दी.</p>
        <Link to="/contact">
          <button className="mt-5 h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90">
            Ask us anything
          </button>
        </Link>
      </div>
    </div>
  );
}
