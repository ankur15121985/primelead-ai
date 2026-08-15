import { Link } from 'react-router-dom';
import {
  Globe, Facebook, Instagram, Search, MessageCircle, Store, PhoneCall, Briefcase,
  Building2, ShoppingBag, Zap, QrCode, FileSpreadsheet, UserPlus, ArrowRight, Plug,
} from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';

export function LeadSources() {
  useSeo('Lead Sources — PRIMELEAD AI', 'Connect every channel — website, WhatsApp, IndiaMART, JustDial, QR codes and more — into one lead inbox.');

  const sources = [
    { icon: Globe, name: 'Website forms', desc: 'Embed a lead form or add a Zapier/Webhook step — form submissions become leads instantly.' },
    { icon: Facebook, name: 'Facebook & Instagram', desc: 'Connect Meta lead ads so every enquiry lands in your CRM without manual copying.' },
    { icon: Search, name: 'Google Ads', desc: 'Route paid enquiries straight to the right salesperson with source-level assignment rules.' },
    { icon: MessageCircle, name: 'WhatsApp Business', desc: 'Incoming chats get logged, assigned and turned into tracked leads.' },
    { icon: Store, name: 'IndiaMART', desc: 'Marketplace enquiries flow in, deduplicated and scored, ready for follow-up.' },
    { icon: PhoneCall, name: 'JustDial', desc: 'JustDial enquiries land with their source tag so you know exactly what works.' },
    { icon: Briefcase, name: 'TradeIndia', desc: 'B2B enquiries captured with company details for faster qualification.' },
    { icon: Building2, name: 'Property portals', desc: 'For builders and agents — portal enquiries become pipeline deals.' },
    { icon: ShoppingBag, name: 'Shopify', desc: 'New orders and abandoned carts can feed your sales team.' },
    { icon: Zap, name: 'Zapier & webhooks', desc: 'If a tool can send a webhook, PRIMELEAD can receive it. 8,000+ apps, no code.' },
    { icon: QrCode, name: 'QR code forms', desc: 'Print, scan, done. Perfect for shop counters, exhibitions, pamphlets and site visits.' },
    { icon: FileSpreadsheet, name: 'CSV / Excel import', desc: 'Already tracking leads in Excel? Import with headers and we\'ll deduplicate.' },
    { icon: UserPlus, name: 'Manual entry', desc: 'Capture a walk-in customer in under 10 seconds on mobile.' },
  ];

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">Lead Sources</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Every channel. One inbox.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          PRIMELEAD collects enquiries from everywhere your customers already are — so you never ask "did anyone reply to that DM?"
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((s) => (
          <div key={s.name} className="rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-semibold">{s.name}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            <span className="mt-3 inline-block rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success">Auto-captured</span>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-3xl border bg-slate-50 p-8 sm:p-10">
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center">
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">One inbound webhook for everything else</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Every source runs through the same pipeline: <strong>verify → validate → deduplicate → assign → follow-up → notify</strong>.
              Custom REST APIs and webhook endpoints make PRIMELEAD the hub of your sales stack.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Verify source', 'Normalize lead', 'Detect duplicates', 'Auto-assign owner', 'Create follow-up', 'Log activity', 'Notify salesperson'].map((step) => (
                <span key={step} className="rounded-full border bg-background px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">{step}</span>
              ))}
            </div>
          </div>
          <div className="w-full max-w-sm rounded-2xl border bg-background p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold"><Plug className="h-4 w-4 text-primary" /> Integration abstraction</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Each source is a pluggable module. Missing credentials? The app shows a clear <em>"Connect"</em> screen instead of pretending it works.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-14 text-center">
        <Link to="/signup">
          <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90">
            Connect your first source — free <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
