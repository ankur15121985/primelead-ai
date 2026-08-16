import { z } from 'zod';
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, ROLES, TASK_KINDS } from '../constants';

const sourceValues = LEAD_SOURCES.map((s) => s.value);
const statusValues = [...LEAD_STATUSES];
const priorityValues = [...PRIORITIES];
const roleValues = [...ROLES];
const taskKindValues = [...TASK_KINDS];

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.string().trim().email('Enter a valid email address').max(120),
  password: passwordSchema,
  orgName: z.string().trim().min(2, 'Business name is required').max(120),
  businessType: z.string().optional(),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const onboardingSchema = z.object({
  businessType: z.string().max(60).optional(),
  addSampleData: z.boolean().optional(),
  inviteEmails: z.array(z.string().email()).max(20).optional(),
});

export const leadCreateSchema = z.object({
  name: z.string().trim().min(1, 'Lead name is required').max(120),
  phone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').max(120).optional().nullable().or(z.literal('')),
  company: z.string().trim().max(120).optional().nullable(),
  source: z.enum(sourceValues as [string, ...string[]]).optional(),
  campaignName: z.string().trim().max(120).optional().nullable(),
  priority: z.enum(priorityValues as [string, ...string[]]).optional(),
  expectedValue: z.coerce.number().min(0).max(1e9).optional(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  customFields: z.record(z.string().max(200)).optional(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(statusValues as [string, ...string[]]).optional(),
  stageId: z.string().optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  expectedCloseAt: z.string().datetime().optional().nullable(),
  wonReason: z.string().trim().max(300).optional().nullable(),
  lostReason: z.string().trim().max(300).optional().nullable(),
});

export const leadUpdateSchema = leadCreateSchema.partial();

export const leadBulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum(['assign', 'status', 'tag', 'delete']),
  ownerId: z.string().optional(),
  status: z.enum(statusValues as [string, ...string[]]).optional(),
  tag: z.string().max(40).optional(),
});

export const activityCreateSchema = z.object({
  type: z.enum(['CALL', 'WHATSAPP', 'EMAIL', 'NOTE', 'MEETING']),
  body: z.string().trim().min(1, 'Add some details').max(5000),
  at: z.string().datetime().optional(),
});

export const taskCreateSchema = z.object({
  leadId: z.string().optional().nullable(),
  userId: z.string().optional(),
  title: z.string().trim().min(1, 'Task title is required').max(200),
  kind: z.enum(taskKindValues as [string, ...string[]]).optional(),
  priority: z.enum(priorityValues as [string, ...string[]]).optional(),
  repeatEveryDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
  dueAt: z.string().datetime('Pick a valid date and time'),
  notes: z.string().max(2000).optional().nullable(),
});

export const taskUpdateSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'CANCELLED']).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  priority: z.enum(priorityValues as [string, ...string[]]).optional(),
  repeatEveryDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

// Roles are validated server-side against the org's Role table (system or custom).
export const teamInviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email('Enter a valid email'),
  role: z.string().trim().min(1).max(40),
  password: passwordSchema.optional(),
});

export const teamUpdateSchema = z.object({
  role: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
  title: z.string().max(80).optional(),
  teamId: z.string().optional().nullable(),
});

export const orgUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  businessType: z.string().max(60).optional(),
  logoUrl: z.string().max(500).optional(),
});

export const aiFollowUpSchema = z.object({
  leadId: z.string(),
  channel: z.enum(['whatsapp', 'email', 'call']).optional(),
  tone: z.enum(['professional', 'friendly', 'short', 'persuasive']).optional(),
  language: z.enum(['english', 'hindi', 'hinglish']).optional(),
  objective: z.string().trim().min(3).max(300).optional(),
  productService: z.string().trim().max(200).optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email('Enter a valid email'),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(5).max(2000),
});

export const csvImportSchema = z.object({
  // CSV rows validated loosely — names required, everything else tolerant
});

export const qrCreateSchema = z.object({
  title: z.string().trim().min(1, 'Give this QR code a name').max(120),
  description: z.string().trim().max(500).optional().nullable(),
  campaignName: z.string().trim().max(120).optional().nullable(),
  campaignId: z.string().optional().nullable(),
  fields: z.array(z.enum(['name', 'phone', 'email', 'message'])).min(1, 'Pick at least one form field'),
});

export const qrUpdateSchema = qrCreateSchema.extend({ enabled: z.boolean().optional() }).partial();

export const publicQrLeadSchema = z.object({
  name: z.string().trim().min(1, 'Please tell us your name').max(120),
  phone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').max(120).optional().nullable().or(z.literal('')),
  message: z.string().trim().max(2000).optional().nullable(),
});

// ── GST ────────────────────────────────────────────────────────

/** 15-character GSTIN format (state code + PAN + entity + check char). */
export const gstinField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)')
  .optional()
  .nullable();

/** Configurable GST rate set stored in org settings (see /settings/gst). */
export const gstRatesSchema = z.object({
  rates: z.array(z.coerce.number().min(0).max(100)).min(1).max(12),
  defaultRate: z.coerce.number().min(0).max(100),
});

// ── Quotations & Invoices (GST) ────────────────────────────────

export const quotationItemSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required').max(300),
  quantity: z.coerce.number().min(0.01, 'Quantity must be at least 0.01').max(1e6),
  rate: z.coerce.number().min(0, 'Rate must be 0 or more').max(1e9),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxPct: z.coerce.number().min(0).max(100).default(0),
  gstType: z.enum(['CGST_SGST', 'IGST']).optional().default('CGST_SGST'),
});

export const quotationCreateSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  company: z.string().trim().max(160).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  gstin: gstinField,
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email('Enter a valid email').max(120).optional().nullable().or(z.literal('')),
  leadId: z.string().optional().nullable(),
  items: z.array(quotationItemSchema).min(1, 'Add at least one item'),
  discount: z.coerce.number().min(0).max(1e9).default(0),
  terms: z.string().trim().max(2000).optional().nullable(),
  validityDays: z.coerce.number().int().min(1).max(365).default(15),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']).optional(),
});

export const quotationUpdateSchema = quotationCreateSchema.partial();

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required').max(300),
  hsnSac: z.string().trim().max(20).optional().nullable(),
  quantity: z.coerce.number().min(0.01, 'Quantity must be at least 0.01').max(1e6),
  rate: z.coerce.number().min(0, 'Rate must be 0 or more').max(1e9),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxPct: z.coerce.number().min(0).max(100).default(0),
  gstType: z.enum(['CGST_SGST', 'IGST']).optional().default('CGST_SGST'),
});

export const invoiceCreateSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  company: z.string().trim().max(160).optional().nullable(),
  billingAddress: z.string().trim().max(300).optional().nullable(),
  gstin: gstinField,
  leadId: z.string().optional().nullable(),
  quotationId: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
  discount: z.coerce.number().min(0).max(1e9).default(0),
  terms: z.string().trim().max(2000).optional().nullable(),
  dueDate: z.string().datetime('Pick a valid due date').optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  paidAmount: z.coerce.number().min(0).max(1e12).optional().default(0),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial();

export const invoicePaymentSchema = z.object({
  paidAmount: z.coerce.number().min(0, 'Amount must be 0 or more').max(1e12),
});

// ── Credit & debit notes ───────────────────────────────────────

export const noteItemSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required').max(300),
  hsnSac: z.string().trim().max(20).optional().nullable(),
  quantity: z.coerce.number().min(0.01, 'Quantity must be at least 0.01').max(1e6),
  rate: z.coerce.number().min(0, 'Rate must be 0 or more').max(1e9),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxPct: z.coerce.number().min(0).max(100).default(0),
  gstType: z.enum(['CGST_SGST', 'IGST']).optional().default('CGST_SGST'),
});

const noteBaseSchema = z.object({
  leadId: z.string().optional().nullable(),
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  company: z.string().trim().max(160).optional().nullable(),
  gstin: gstinField,
  reason: z.string().trim().max(500).optional().nullable(),
  items: z.array(noteItemSchema).min(1, 'Add at least one item'),
  discount: z.coerce.number().min(0).max(1e9).default(0),
  status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED']).optional(),
});

export const creditNoteCreateSchema = noteBaseSchema.extend({
  invoiceId: z.string().optional().nullable(),
});

export const debitNoteCreateSchema = noteBaseSchema;

export const noteUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED']).optional(),
  reason: z.string().trim().max(500).optional().nullable(),
});

// ── AI assistant chat ──────────────────────────────────────────
export const aiChatSchema = z.object({
  message: z.string().trim().min(1, 'Ask something').max(2000),
  conversationId: z.string().optional().nullable(),
});

// ── Integrations ───────────────────────────────────────────────
export const integrationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  config: z.record(z.string().max(500)).optional(),
  enabled: z.boolean().optional(),
  status: z.enum(['DISCONNECTED', 'CONNECTED', 'ERROR']).optional(),
});

// ── Webhooks (inbound lead capture) ────────────────────────────
export const webhookLeadSchema = z.object({
  name: z.string().trim().min(1, 'Lead name is required').max(120),
  phone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').max(120).optional().nullable().or(z.literal('')),
  company: z.string().trim().max(120).optional().nullable(),
  source: z.enum(sourceValues as [string, ...string[]]).optional(),
  campaignName: z.string().trim().max(120).optional().nullable(),
  expectedValue: z.coerce.number().min(0).max(1e9).optional(),
  notes: z.string().max(2000).optional().nullable(),
  priority: z.enum(priorityValues as [string, ...string[]]).optional(),
  ownerId: z.string().optional().nullable(),
  customFields: z.record(z.string().max(200)).optional(),
});

// ── Billing ────────────────────────────────────────────────────
export const billingUpgradeSchema = z.object({
  planSlug: z.enum(['starter', 'growth', 'business']),
  period: z.enum(['MONTHLY', 'YEARLY']).optional().default('MONTHLY'),
});

// ── Contacts ───────────────────────────────────────────────────
export const contactCreateSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required').max(120),
  phone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').max(120).optional().nullable().or(z.literal('')),
  company: z.string().trim().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  leadId: z.string().optional().nullable(),
});

export const contactUpdateSchema = contactCreateSchema.partial();
