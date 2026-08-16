/** Shared API DTO types (mirror server serializers). */

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  title: string | null;
  active: boolean;
  avatarUrl: string | null;
  emailVerified: boolean;
  isSuperAdmin?: boolean;
  teamId?: string | null;
  permissions?: string[];
  mfaEnabled?: boolean;
  createdAt: string;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  members: Array<{ id: string; name: string; email: string; role: string }>;
  createdAt: string;
}

export interface UserSession {
  id: string;
  deviceName: string;
  ip: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface LoginHistoryEntry {
  success: boolean;
  reason: string;
  ip: string | null;
  userAgent: string | null;
  newDevice: boolean;
  createdAt: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  businessType: string | null;
  plan: string;
  status: string;
  logoUrl: string | null;
}

export interface LeadOwner {
  id: string;
  name: string;
}

export interface LeadStage {
  id: string;
  name: string;
  color: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string;
  campaignName: string | null;
  status: string;
  stageId: string | null;
  stage: LeadStage | null;
  priority: string;
  score: number;
  expectedValue: number;
  notes: string | null;
  tags: string[] | null;
  customFields: Record<string, string> | null;
  ownerId: string | null;
  owner: LeadOwner | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  expectedCloseAt: string | null;
  wonReason: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: string;
  title: string;
  body: string | null;
  userId: string | null;
  user: { name: string } | null;
  lead?: { name: string } | null;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  kind: string;
  dueAt: string;
  status: string;
  priority: string;
  repeatEveryDays: number | null;
  notes: string | null;
  leadId: string | null;
  lead: { id: string; name: string; phone: string | null } | null;
  userId: string;
  user: { id: string; name: string } | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  probability: number;
  value: number;
  weightedValue: number;
  leads: Lead[];
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stageCount?: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface LeadListResponse {
  rows: Lead[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  counts: { new: number; open: number; won: number; overdue: number };
}

export interface LeadDetail extends Lead {
  activities: Activity[];
  tasks: Task[];
  quotations: unknown[];
  invoices: unknown[];
}

export interface QrCode {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  url: string;
  image: string | null;
  fields: string[];
  scanCount: number;
  leadCount: number;
  conversionRate: number;
  enabled: boolean;
  campaignId: string | null;
  campaign: { id: string; name: string } | null;
  createdAt: string;
}

export interface QrDetail extends QrCode {
  recentLeads: Lead[];
}

export interface PublicQrMeta {
  title: string;
  description: string | null;
  fields: string[];
  orgName: string;
  campaignName: string | null;
}

// ── Super-admin (website handler) ─────────────────────────
export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  businessType: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  users: number;
  leads: number;
  openLeads: number;
  pipelineValue: number;
  overdueTasks: number;
  qrCodes: number;
}

export interface AdminOverview {
  totals: {
    organizations: number;
    activeOrganizations: number;
    suspendedOrganizations: number;
    users: number;
    leads: number;
    wonLeads: number;
    wonValue: number;
    qrCodes: number;
    quotations: number;
    invoices: number;
  };
  organizations: AdminOrg[];
  recentOrganizations: Array<{ id: string; name: string; plan: string; status: string; createdAt: string }>;
  recentErrors: Array<{ at: string; method: string; path: string; message: string; status: number; code: string }>;
}

export interface AdminOrgDetail {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    businessType: string | null;
    logoUrl: string | null;
    createdAt: string;
  };
  users: User[];
  recentLeads: Lead[];
  recentActivity: Activity[];
  subscription: {
    id: string;
    status: string;
    period: string;
    plan: { id: string; name: string } | null;
  } | null;
  stats: {
    users: number;
    leads: number;
    openLeads: number;
    pipelineValue: number;
    overdueTasks: number;
    qrCodes: number;
  };
}

export interface AdminSystem {
  uptimeSeconds: number;
  startedAt: string;
  node: string;
  platform: string;
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  loadAvg: number[];
  cpus: number;
  database: { connected: boolean; provider: string };
  recentErrorCount: number;
  env: Record<string, string>;
}

export interface DashboardData {
  cards: {
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    wonLeads: number;
    openLeads: number;
    weekLeads: number;
    monthLeads: number;
    pipelineValue: number;
    revenue: number;
    conversionRate: number;
    overdue: number;
    today: number;
    upcoming: number;
  };
  charts: {
    leadsBySource: Array<{ source: string; count: number }>;
    leadsByOwner: Array<{ name: string; count: number }>;
    trend: Array<{ date: string; label: string; leads: number; won: number }>;
    funnel: Array<{ stage: string; value: number }>;
    topSalespeople: Array<{ name: string; open: number; wonValue: number }>;
  };
  lists: {
    todaysTasks: Task[];
    overdueTasks: Task[];
    recentLeads: Lead[];
    recentActivity: Activity[];
  };
}

// ── Quotations & Invoices ────────────────────────────────────
export interface DocumentItem {
  id?: string;
  description: string;
  hsnSac?: string | null;
  quantity: number;
  rate: number;
  discountPct: number;
  taxPct: number;
  gstType?: string;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

export interface Quotation {
  id: string;
  number: string;
  leadId: string | null;
  lead: { id: string; name: string } | null;
  customerName: string;
  company: string | null;
  address: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  items: DocumentItem[];
  discount: number;
  gstSummary: { cgst: number; sgst: number; igst: number };
  subtotal: number;
  total: number;
  terms: string | null;
  validityDays: number;
  status: string;
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  leadId: string | null;
  lead: { id: string; name: string } | null;
  quotationId: string | null;
  customerName: string;
  company: string | null;
  billingAddress: string | null;
  gstin: string | null;
  items: DocumentItem[];
  discount: number;
  gstSummary: { cgst: number; sgst: number; igst: number };
  subtotal: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  dueDate: string | null;
  terms: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NoteBase {
  id: string;
  number: string;
  leadId: string | null;
  lead: { id: string; name: string } | null;
  customerName: string;
  company: string | null;
  gstin: string | null;
  reason: string | null;
  items: DocumentItem[];
  discount: number;
  gstSummary: { cgst: number; sgst: number; igst: number };
  subtotal: number;
  total: number;
  status: string; // DRAFT | ISSUED | CANCELLED
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditNote extends NoteBase {
  invoiceId: string | null;
  invoice: { id: string; number: string } | null;
}

export interface DebitNote extends NoteBase {}

export interface GstSettings {
  rates: number[];
  defaultRate: number;
}

export interface AiConversation {
  id: string;
  topic: string | null;
  updatedAt: string;
  preview: string;
}

export interface AiConversationDetail {
  id: string;
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
}

export interface Integration {
  id: string;
  source: string;
  name: string;
  enabled: boolean;
  status: string;
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
  lastSyncAt: string | null;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationCatalogItem {
  source: string;
  name: string;
  description: string;
  kind: string;
  icon: string;
  connected: boolean;
}

export interface ReportData {
  range: { from: string; to: string };
  cards: {
    leadsCreated: number;
    leadsWon: number;
    leadsLost: number;
    conversionRate: number;
    winRate: number;
    openLeads: number;
    tasksDone: number;
    tasksMissed: number;
    quotationsCount: number;
    quotationValue: number;
    invoicesCount: number;
    invoiceValue: number;
    revenue: number;
    activityCount: number;
  };
  charts: {
    bySource: Array<{ source: string; label: string; count: number }>;
    byOwner: Array<{ name: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    byStage: Array<{ name: string; count: number }>;
    trend: Array<{ day: string; count: number }>;
  };
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  userLimit: number;
  leadLimit: number;
}

export interface BillingData {
  org: { id: string; name: string; plan: string; status: string };
  plans: Plan[];
  subscription: {
    id: string;
    status: string;
    period: string;
    startsAt: string;
    endsAt: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    provider: string | null;
    plan: Plan | null;
  } | null;
  currentPlan: Plan | null;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    provider: string | null;
    refundedAmount: number;
    paidAt: string | null;
    createdAt: string;
  }>;
  gateway: { configured: boolean; provider: string | null; mode: 'demo' | 'provider' };
}

export interface Reconciliation {
  range: { from: string | null; to: string | null };
  totals: {
    payments: number;
    succeeded: number;
    failed: number;
    refunded: number;
    collected: number;
    refundedAmount: number;
    net: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    provider: string | null;
    refundedAmount: number;
    paidAt: string | null;
    createdAt: string;
  }>;
}

export interface UpgradeResult {
  applied: boolean;
  mode: string;
  provider?: string;
  plan: string;
  amount: number;
  checkoutUrl?: string | null;
  paymentId?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  notes: string | null;
  tags: string[] | null;
  leadId: string | null;
  lead: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ── WhatsApp / shared inbox ────────────────────────────────────
export interface Conversation {
  id: string;
  leadId: string | null;
  lead: { id: string; name: string; phone: string | null } | null;
  waId: string;
  customerName: string;
  channel: string;
  status: string;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  labels: string[] | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaMessage {
  id: string;
  conversationId: string;
  direction: string;
  channel: string;
  type: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  waTemplateName: string | null;
  status: string;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  unreadTotal: number;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: WaMessage[];
}

export interface WaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaSettings {
  enabled: boolean;
  provider: string;
  phoneNumberId: string | null;
  hasToken: boolean;
  verifyToken: string | null;
}
