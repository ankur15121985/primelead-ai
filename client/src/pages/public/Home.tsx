import { Link } from 'react-router-dom';
import {
  ArrowRight, Bot, CheckCircle2, Clock, Globe, KanbanSquare, MessageCircle, PhoneCall,
  QrCode, ShieldCheck, Smartphone, Sparkles, Users, Zap, FileText, FileSpreadsheet, BarChart3,
} from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';
import { Badge } from '@/components/ui/badge';

export function Home() {
  useSeo('PRIMELEAD AI — Stop Losing Leads. Start Closing Them.', 'Capture every enquiry, assign it automatically, follow up on time and let AI help your sales team close more business.');

  return (
    <div>
      <Hero />
      <TrustStrip />
      <Problem />
      <WhyAgencies />
      <HowItWorks />
      <Features />
      <Sources />
      <AiSection />
      <Testimonials />
      <FreeTools />
      <CtaSection />
    </div>
  );
}

/* ────────────────────────── Hero ────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="container relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
        <div className="animate-fade-in">
          <Badge tone="primary" className="mb-5">
            <Sparkles className="h-3 w-3" /> Built for Indian agencies, not adapted for them
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Stop Losing Leads.
            <br />
            <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">Start Closing Them.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Capture every enquiry, assign it automatically, follow up on time and let AI help your sales team close more business. Built specifically for Indian marketing & web dev agencies.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup">
              <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30 sm:w-auto">
                Start Free <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link to="/contact">
              <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border bg-background px-7 text-base font-semibold transition-all hover:bg-accent sm:w-auto">
                Book a Demo
              </button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required · Set up in 3 minutes · 14-day free trial
          </p>
        </div>

        <CrmPreview />
      </div>
    </section>
  );
}

function CrmPreview() {
  const rows = [
    { name: 'Rajesh Sharma', src: 'Website', owner: 'Karan', value: '₹2.5L', status: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    { name: 'Priya Patel', src: 'IndiaMART', owner: 'Pooja', value: '₹8.5L', status: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    { name: 'Amit Verma', src: 'Facebook', owner: 'Karan', value: '₹1.2L', status: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
    { name: 'Sunita Reddy', src: 'Website', owner: 'Pooja', value: '₹15L', status: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  ];
  return (
    <div className="relative animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/15 via-transparent to-violet-500/15 blur-2xl" aria-hidden />
      <div className="relative rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">PRIMELEAD AI · Lead Inbox</span>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Live</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-xl border bg-background px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.src} · {r.owner}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="hidden text-sm font-semibold sm:block">{r.value}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status}`}>New</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center rounded-xl border border-dashed py-2.5 text-xs text-muted-foreground">
              + 3 new leads captured in the last hour
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border bg-amber-50/60 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                <Clock className="h-3.5 w-3.5" /> Follow-up overdue
              </p>
              <p className="mt-1.5 text-xs font-semibold">Priya Patel — Quotation follow-up</p>
              <p className="text-[11px] text-amber-700">due yesterday · Call now</p>
            </div>
            <div className="rounded-xl border bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI follow-up
              </p>
              <p className="mt-1.5 text-xs leading-relaxed">
                “Hi Priya, hope the quote reached you well. We can lock in this week's offer — shall I send the invoice?”
              </p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">WhatsApp</span>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Email</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── Trust strip ────────────────────── */

function TrustStrip() {
  const items = [
    { icon: ShieldCheck, title: 'Built for Indian agencies', desc: 'GST-compliant quotations & invoices out of the box. No generic CRM adaptation needed.' },
    { icon: MessageCircle, title: 'WhatsApp-native workflows', desc: 'Your leads already live in WhatsApp — so should your CRM. IndiaMART & Facebook integrations included.' },
    { icon: Bot, title: 'Never write follow-ups from scratch', desc: 'AI follow-up writer reads lead history and writes ready-to-send messages in English, Hindi or Hinglish.' },
    { icon: QrCode, title: 'Capture leads anywhere', desc: 'QR codes for your office, storefront, exhibitions, pamphlets — offline touchpoints become leads instantly.' },
  ];
  return (
    <section className="border-y bg-muted/40">
      <div className="container grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="flex gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{it.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────── Problem ────────────────────────── */

function Problem() {
  return (
    <section className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <SectionTag>Sound familiar?</SectionTag>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Every enquiry has a cost. Missing one is worse.</h2>
        <p className="mt-4 text-muted-foreground">
          In India, the customer who enquires today buys today — often from whoever replies first. A missed WhatsApp, a lost sticky note, a forgotten follow-up… that's revenue walking out the door.
        </p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[
          { title: 'Leads scattered everywhere', desc: 'Website forms, Instagram DMs, IndiaMART, JustDial, your shop counter — every enquiry lives in a different app nobody checks.' },
          { title: 'Follow-ups get forgotten', desc: 'Salespeople mean well, but between calls and site visits, the "call back on Thursday" promise quietly disappears.' },
          { title: 'You can\'t see what\'s working', desc: 'Which source gives real buyers? Who is actually closing? Without numbers, you are running your business on guesswork.' },
        ].map((p) => (
          <div key={p.title} className="rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg">
            <p className="font-semibold">{p.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────── How it works ──────────────────────── */

function WhyAgencies() {
  return (
    <section className="container py-20">
      <div className="mx-auto max-w-3xl text-center">
        <SectionTag>Why marketing & web dev agencies first</SectionTag>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Built for agencies, not adapted for them</h2>
        <p className="mt-4 text-muted-foreground">
          Generic CRMs like Zoho and HubSpot are broad and intimidating for a 3-5 person agency. PRIMELEAD AI's specificity — GST invoicing, WhatsApp-native workflows, QR capture — is the wedge.
        </p>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {[
          { title: 'Digitally fluent', desc: 'Marketing & web dev agencies are comfortable adopting new SaaS tools without hand-holding. Short sales cycle.' },
          { title: 'Already juggling multiple client pipelines', desc: 'The pain of scattered leads is acute and easy to articulate. Multiple client projects = multiple pipelines.' },
          { title: 'Naturally cluster in online communities', desc: 'LinkedIn, Facebook groups, WhatsApp/Telegram agency communities — makes outreach efficient and targeted.' },
          { title: 'Word-of-mouth travels fast', desc: 'Early wins compound into referrals within agency circles. One happy agency owner tells five others.' },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-4 rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Globe, title: 'Capture every lead', desc: 'Website forms, QR codes, WhatsApp, IndiaMART, JustDial, Excel — every enquiry lands in one inbox automatically.' },
    { icon: Users, title: 'Auto-assign to the right person', desc: 'Round-robin or least-loaded rules hand each lead to the right salesperson in seconds — no chasing, no drama.' },
    { icon: CheckCircle2, title: 'Follow up on time', desc: 'The engine reminds your team about every call, WhatsApp and meeting. AI drafts the message, one tap to send.' },
  ];
  return (
    <section className="bg-slate-50/60 py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag>How it works</SectionTag>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From enquiry to deal in three steps</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <s.icon className="h-6 w-6" />
              </div>
              <span className="absolute right-0 top-0 text-6xl font-black text-slate-200/70">{i + 1}</span>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────── Features ───────────────────────── */

function Features() {
  const features = [
    { icon: Users, title: 'Lead management', desc: 'A powerful, simple inbox with search, filters, tags, scoring, duplicate detection and bulk actions.' },
    { icon: KanbanSquare, title: 'Sales pipeline', desc: 'Drag leads from New to Won on a Kanban board. Stage changes are logged automatically.' },
    { icon: Clock, title: 'Follow-up engine', desc: 'Overdue, today and upcoming views. Nobody forgets a follow-up again.' },
    { icon: MessageCircle, title: 'WhatsApp ready', desc: 'Your leads already live in WhatsApp — so should your CRM. Open chats with pre-filled messages, log conversations, schedule follow-ups.' },
    { icon: Bot, title: 'AI follow-up writer', desc: 'Never write another follow-up from scratch. AI reads lead history and writes ready-to-send messages in English, Hindi or Hinglish.' },
    { icon: QrCode, title: 'QR lead capture', desc: 'Capture leads from your office, storefront, or event. Print QR codes for counters, exhibitions, pamphlets — scanned enquiries become leads instantly.' },
    { icon: FileText, title: 'GST quotations', desc: 'Built for Indian agencies: GST-compliant quotations with CGST/SGST/IGST, PDF download and one-tap WhatsApp share.' },
    { icon: FileSpreadsheet, title: 'GST invoices & reports', desc: 'Professional GST invoices with HSN/SAC codes, payment tracking, and honest reports on sources, salespeople and conversion.' },
    { icon: BarChart3, title: 'Dashboards & analytics', desc: 'Pipeline value, revenue, conversion rate and top performers — at a glance.' },
  ];
  return (
    <section className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <SectionTag>Everything you need</SectionTag>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A complete sales system, not just a phone book</h2>
        <p className="mt-4 text-muted-foreground">
          Built specifically for Indian marketing & web development agencies. Generic CRMs like Zoho and HubSpot are broad and intimidating for a 3-5 person agency. PRIMELEAD AI's specificity is the wedge.
        </p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link to="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          Explore all features <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

/* ───────────────────── Lead sources ────────────────────── */

function Sources() {
  const sources = ['Website', 'Facebook', 'Instagram', 'Google Ads', 'WhatsApp', 'IndiaMART', 'JustDial', 'TradeIndia', 'Shopify', 'Zapier', 'Excel', 'QR Codes'];
  return (
    <section className="bg-slate-50/60 py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag>One inbox for everything</SectionTag>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Connect the channels your customers already use</h2>
          <p className="mt-4 text-muted-foreground">No more checking five apps. Every enquiry from every source lands in one clean lead inbox.</p>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {sources.map((s) => (
            <span key={s} className="rounded-full border bg-background px-5 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-primary/40 hover:text-primary">
              {s}
            </span>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/lead-sources" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            See how lead capture works <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── AI section ────────────────────── */

function AiSection() {
  return (
    <section className="container py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionTag>AI that sells</SectionTag>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Your AI sales assistant writes the follow-ups your team keeps postponing</h2>
          <p className="mt-4 text-muted-foreground">
            Ask questions about your own business, and get honest answers from your data:
          </p>
          <ul className="mt-6 space-y-3">
            {[
              '“Which source gave the most qualified leads this month?”',
              '“Who has the most overdue follow-ups?”',
              '“Draft a WhatsApp follow-up for Priya — friendly tone, in Hinglish.”',
              '“Show me leads worth more than ₹5 lakh.”',
            ].map((q) => (
              <li key={q} className="flex items-start gap-3 rounded-xl border bg-card p-3.5 text-sm">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="font-medium">{q}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            AI only ever sees <strong className="text-foreground">your own</strong> organisation's data — never anyone else's.
          </p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-b from-slate-950 to-slate-900 p-6 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm">L</span>
            <div>
              <p className="text-sm font-semibold text-white">PRIMELEAD AI Assistant</p>
              <p className="text-xs text-slate-400">English · Hinglish · हिन्दी</p>
            </div>
          </div>
          <div className="space-y-3 py-4">
            <ChatBubble side="user">Who has the most overdue follow-ups this week?</ChatBubble>
            <ChatBubble side="ai">
              Pooja has 3 overdue follow-ups (highest in your team). Top one: <strong>Priya Patel</strong> — quotation follow-up, due yesterday. Karan has 1. Want me to draft the messages?
            </ChatBubble>
            <ChatBubble side="user">Yes, in Hinglish, friendly tone.</ChatBubble>
            <ChatBubble side="ai">
              Done! 🙌 <em>“Hi Priya ji, quote aapko mili thi? Is week ki special pricing kal tak hai — invoice bhej du kya?”</em> Ready to send on WhatsApp.
            </ChatBubble>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-800/60 px-4 py-3">
            <input
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
              placeholder="Ask anything about your sales…"
              readOnly
            />
            <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Send</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ side, children }: { side: 'user' | 'ai'; children: React.ReactNode }) {
  return (
    <div className={side === 'user' ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          side === 'user'
            ? 'max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground'
            : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-2.5 text-sm leading-relaxed text-slate-100'
        }
      >
        {children}
      </div>
    </div>
  );
}

/* ───────────────────── Testimonials ────────────────────── */

function Testimonials() {
  const items = [
    { name: 'Rohit Sharma', role: 'Interior firm, Gurgaon', quote: 'We used to lose leads on weekends. Now every enquiry is captured, assigned and followed up — our conversions doubled in two months.' },
    { name: 'Meena Iyer', role: 'Real estate agency, Chennai', quote: 'The QR code on our project site captures enquiries even when the office is closed. It feels like magic.' },
    { name: 'Arjun Patel', role: 'Manufacturer, Ahmedabad', quote: 'The AI follow-up writer is the feature I didn\'t know I needed. My team actually sends follow-ups now.' },
  ];
  return (
    <section className="bg-slate-50/60 py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag>Loved by growing businesses</SectionTag>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Sales teams that never miss a lead</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {items.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl border bg-card p-6">
              <div className="mb-3 text-amber-400" aria-label="5 star rating">★★★★★</div>
              <blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                  {t.name.split(' ').map((p) => p[0]).join('')}
                </span>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────── Free tools ────────────────────── */

function FreeTools() {
  const tools = [
    {
      icon: QrCode,
      title: 'Free QR Code Generator',
      desc: 'Create professional QR codes for your business in seconds. No signup required. Perfect for shop counters, exhibitions, pamphlets and visiting cards.',
      link: '/tools/qr-generator',
      cta: 'Generate QR Code'
    },
    {
      icon: FileText,
      title: 'Free GST Invoice Generator',
      desc: 'Create GST-compliant invoices instantly. No login needed. Includes CGST/SGST/IGST calculations, professional PDF download, and WhatsApp share.',
      link: '/tools/gst-invoice-generator',
      cta: 'Create Invoice'
    }
  ];

  return (
    <section className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <SectionTag>Free tools</SectionTag>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Try before you buy — no signup needed</h2>
        <p className="mt-4 text-muted-foreground">
          Start with our free tools and see the value. Upgrade to PRIMELEAD AI when you're ready for the full CRM experience.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {tools.map((tool) => (
          <div key={tool.title} className="rounded-2xl border bg-card p-8 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <tool.icon className="h-7 w-7" />
            </span>
            <h3 className="mt-5 text-xl font-bold">{tool.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.desc}</p>
            <Link to={tool.link} className="mt-6 inline-flex">
              <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90">
                {tool.cta} <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────── CTA ──────────────────────────── */

function CtaSection() {
  return (
    <section className="container py-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-violet-600 px-6 py-16 text-center text-primary-foreground shadow-2xl sm:px-16">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[500px] -translate-x-1/2 rounded-full bg-white/20 blur-3xl" aria-hidden />
        <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Every lead captured. Every lead assigned. Every follow-up remembered.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/85">Join hundreds of Indian businesses that stopped losing enquiries. Your first lead could arrive within minutes.</p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/signup">
            <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-8 text-base font-semibold text-primary shadow-lg transition-all hover:bg-slate-100 sm:w-auto">
              Start Free <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <Link to="/pricing">
            <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/40 px-8 text-base font-semibold text-white transition-all hover:bg-white/10 sm:w-auto">
              See Pricing
            </button>
          </Link>
        </div>
        <p className="relative mt-4 flex items-center justify-center gap-2 text-sm text-primary-foreground/80">
          <PhoneCall className="h-4 w-4" /> Free setup help for your team · English · हिन्दी
        </p>
      </div>
    </section>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">{children}</span>;
}
