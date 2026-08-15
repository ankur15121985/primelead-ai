/** Client mirror of server constants. */

export const LEAD_SOURCES = [
  { value: 'WEBSITE', label: 'Website', icon: 'Globe' },
  { value: 'FACEBOOK', label: 'Facebook', icon: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram', icon: 'Instagram' },
  { value: 'GOOGLE_ADS', label: 'Google Ads', icon: 'Search' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: 'MessageCircle' },
  { value: 'INDIAMART', label: 'IndiaMART', icon: 'Store' },
  { value: 'JUSTDIAL', label: 'JustDial', icon: 'PhoneCall' },
  { value: 'TRADEINDIA', label: 'TradeIndia', icon: 'Briefcase' },
  { value: 'PROPERTY_PORTAL', label: 'Property Portal', icon: 'Building2' },
  { value: 'SHOPIFY', label: 'Shopify', icon: 'ShoppingBag' },
  { value: 'ZAPIER', label: 'Zapier', icon: 'Zap' },
  { value: 'WEBHOOK', label: 'Webhook', icon: 'Webhook' },
  { value: 'API', label: 'REST API', icon: 'Code2' },
  { value: 'CSV', label: 'CSV / Excel', icon: 'FileSpreadsheet' },
  { value: 'QR', label: 'QR Code', icon: 'QrCode' },
  { value: 'MANUAL', label: 'Manual', icon: 'UserPlus' },
] as const;

export const sourceLabel = (value: string): string =>
  LEAD_SOURCES.find((s) => s.value === value)?.label || value || 'Manual';

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;

export const STATUS_META: Record<string, { label: string; className: string }> = {
  NEW: { label: 'New', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  CONTACTED: { label: 'Contacted', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  QUALIFIED: { label: 'Qualified', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  PROPOSAL: { label: 'Proposal', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  NEGOTIATION: { label: 'Negotiation', className: 'bg-pink-50 text-pink-700 border-pink-200' },
  WON: { label: 'Won', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LOST: { label: 'Lost', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const PRIORITY_META: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  MEDIUM: { label: 'Medium', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  HIGH: { label: 'High', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  URGENT: { label: 'Urgent', className: 'bg-red-50 text-red-700 border-red-200' },
};

export const TASK_KINDS = ['FOLLOW_UP', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'TASK'] as const;

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'ACCOUNTANT', 'SUPPORT', 'VIEWER'] as const;

export const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES: 'Salesperson',
  ACCOUNTANT: 'Accountant',
  SUPPORT: 'Support',
  VIEWER: 'Viewer',
};

export const BUSINESS_TYPES = [
  { value: 'RETAIL', label: 'Retail & E-commerce' },
  { value: 'REAL_ESTATE', label: 'Real Estate & Property' },
  { value: 'EDUCATION', label: 'Education & Training' },
  { value: 'SERVICES', label: 'Services & Agencies' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    tagline: 'For solo owners getting organised',
    monthly: 0,
    yearly: 0,
    cta: 'Start Free',
    features: ['Up to 2 users', '1,000 leads', 'Lead management', 'Manual lead entry', 'Email support'],
    highlight: false,
  },
  {
    slug: 'growth',
    name: 'Growth',
    tagline: 'For growing sales teams',
    monthly: 1499,
    yearly: 14990,
    cta: 'Start 14-day trial',
    features: [
      'Up to 10 users',
      '25,000 leads',
      'Automatic lead assignment',
      'WhatsApp integration',
      'AI follow-up writer',
      'Quotations & invoices',
      'Reports & analytics',
      'Priority support',
    ],
    highlight: true,
  },
  {
    slug: 'business',
    name: 'Business',
    tagline: 'For larger organisations',
    monthly: 3999,
    yearly: 39990,
    cta: 'Talk to sales',
    features: [
      'Unlimited users',
      'Unlimited leads',
      'Everything in Growth',
      'QR lead capture campaigns',
      'API & webhooks',
      'CSV import/export',
      'Custom AI assistant',
      'Dedicated success manager',
    ],
    highlight: false,
  },
] as const;
