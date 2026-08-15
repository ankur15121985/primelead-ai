import { Link } from 'react-router-dom';
import {
  Users, KanbanSquare, Clock, MessageCircle, Bot, QrCode, FileText, FileSpreadsheet,
  BarChart3, PhoneCall, Mail, ShieldCheck, Smartphone, ArrowRight, Zap, Search, Filter, Download,
} from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';

export function Features() {
  useSeo('Features — LeadFlow AI', 'Everything you need to capture, assign, follow up and close more leads.');

  const blocks = [
    {
      icon: Users, title: 'Lead management', desc: 'A powerful but simple lead inbox.',
      points: ['Search, filter, sort and paginate — even with 50,000 leads', 'Lead scoring from priority, value and completeness', 'Duplicate detection by phone or email with merge support', 'Bulk assign, bulk status change, bulk tagging', 'CSV import and one-click CSV export', 'Custom fields and tags for your business'],
    },
    {
      icon: KanbanSquare, title: 'Sales pipeline', desc: 'See where every deal stands.',
      points: ['Drag-and-drop Kanban board', 'Columns for New → Contacted → Qualified → Proposal → Negotiation → Won', 'Customisable stages with colours', 'Stage changes logged as activities automatically', 'Pipeline value shown per stage'],
    },
    {
      icon: Clock, title: 'Follow-up engine', desc: 'Nobody forgets a follow-up again.',
      points: ['Overdue / today / upcoming / missed views', 'One-tap "complete" on calls and WhatsApps', 'Recurring follow-ups for long sales cycles', 'Notifications when follow-ups go overdue', 'Dashboard that tells each salesperson who to contact today'],
    },
    {
      icon: Bot, title: 'AI follow-up writer', desc: 'AI writes the messages your team keeps postponing.',
      points: ['Reads the lead\'s real history — notes, stage, last contact', 'Tones: Professional, Friendly, Short, Persuasive', 'Languages: English, Hindi, Hinglish', 'Edit before sending, one tap to open WhatsApp', 'Conversational AI assistant answers questions about your CRM data'],
    },
    {
      icon: QrCode, title: 'QR lead capture', desc: 'Turn every physical touchpoint into a lead.',
      points: ['Print QR codes for counters, exhibitions, pamphlets, visiting cards', 'Mobile-friendly lead form — no app needed', 'Auto-creates the lead with source = QR', 'Track scans, leads and conversion per campaign'],
    },
    {
      icon: MessageCircle, title: 'WhatsApp integration', desc: 'Meet your customers where they already are.',
      points: ['Open WhatsApp with a pre-filled message', 'Log every WhatsApp conversation on the lead timeline', 'Schedule WhatsApp follow-ups', 'WhatsApp Business API-ready architecture with a clear "Connect" flow'],
    },
    {
      icon: FileText, title: 'Quotations', desc: 'Professional quotes in minutes.',
      points: ['Quotation numbers, GSTIN, terms and validity', 'Auto GST: CGST + SGST or IGST per item', 'Item-level discounts and document-level discounts', 'PDF download and WhatsApp share', 'One-click convert to invoice'],
    },
    {
      icon: FileSpreadsheet, title: 'Invoices', desc: 'GST-ready invoicing that feels fair.',
      points: ['Invoice numbers, HSN/SAC, billing address', 'Payment statuses: Draft, Sent, Paid, Overdue', 'Track partial payments', 'Professional PDF invoices'],
    },
    {
      icon: BarChart3, title: 'Reports & analytics', desc: 'Honest numbers, not guesswork.',
      points: ['Leads by source and by salesperson', 'Conversion funnel and revenue trend', 'Top performers leaderboard', 'Campaign and QR campaign reports', 'Export reports to CSV'],
    },
  ];

  const extras = [
    { icon: ShieldCheck, title: 'Security', desc: 'Password hashing, rate limiting, CSRF protection, audit logs, role-based access and hard org isolation.' },
    { icon: Smartphone, title: 'Mobile-first', desc: 'Bottom navigation, big touch targets, swipe-friendly cards — built for salespeople on the move.' },
    { icon: Zap, title: 'Fast', desc: 'Paginated APIs, debounced search, lazy-loaded routes and optimised charts.' },
  ];

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">Features</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Everything a sales team needs. Nothing it doesn't.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Built around one promise: every lead captured, every lead assigned, every follow-up remembered.
        </p>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.title} className="flex flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <b.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{b.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{b.desc}</p>
            <ul className="mt-4 space-y-2.5">
              {b.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {extras.map((e) => (
          <div key={e.title} className="flex items-start gap-4 rounded-2xl bg-slate-50 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <e.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">{e.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{e.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-primary to-violet-600 p-10 text-center text-primary-foreground">
        <h2 className="text-2xl font-bold">Ready to stop losing leads?</h2>
        <Link to="/signup">
          <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 font-semibold text-primary shadow-lg transition-all hover:bg-slate-100">
            Start Free <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
        <p className="text-sm text-primary-foreground/80">
          <Filter className="mr-1 inline h-4 w-4" /> 14-day trial · <Search className="mr-1 inline h-4 w-4" /> No credit card · <Download className="mr-1 inline h-4 w-4" /> Export your data anytime
        </p>
      </div>
    </div>
  );
}

import { Check } from 'lucide-react';
void PhoneCall; void Mail;
