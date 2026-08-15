/** Shared business constants. Mirrored on the client (client/src/lib/constants.ts). */

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES', 'ACCOUNTANT', 'SUPPORT', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Order for hierarchy checks — a role can manage anyone at or below this rank.
 * Custom roles (created in Settings → Roles) are treated as rank 1.
 */
export const ROLE_RANK: Record<string, number> = {
  OWNER: 7,
  ADMIN: 6,
  MANAGER: 5,
  ACCOUNTANT: 2,
  SUPPORT: 1,
  VIEWER: 1,
  SALES: 1,
};

export function canManage(actor: string, target: string): boolean {
  return (ROLE_RANK[actor] ?? 1) > (ROLE_RANK[target] ?? 1);
}

export { SYSTEM_ROLES, PERMISSIONS, rolePermissionsFallback, ROLE_LABEL as SYSTEM_ROLE_LABEL } from './rbac';

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const OPEN_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];
export const WON_STATUS = 'WON';
export const LOST_STATUS = 'LOST';

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_WEIGHT: Record<Priority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };

export const LEAD_SOURCES = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'GOOGLE_ADS', label: 'Google Ads' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INDIAMART', label: 'IndiaMART' },
  { value: 'JUSTDIAL', label: 'JustDial' },
  { value: 'TRADEINDIA', label: 'TradeIndia' },
  { value: 'PROPERTY_PORTAL', label: 'Property Portal' },
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'ZAPIER', label: 'Zapier' },
  { value: 'WEBHOOK', label: 'Webhook' },
  { value: 'API', label: 'REST API' },
  { value: 'CSV', label: 'CSV / Excel' },
  { value: 'QR', label: 'QR Code' },
  { value: 'MANUAL', label: 'Manual' },
] as const;

export const sourceLabel = (value: string) =>
  LEAD_SOURCES.find((s) => s.value === value)?.label || value || 'Manual';

export const TASK_KINDS = ['FOLLOW_UP', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'TASK'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_STATUSES = ['PENDING', 'DONE', 'MISSED', 'CANCELLED'] as const;

export const ACTIVITY_TYPES = [
  'LEAD_CREATED',
  'CALL',
  'WHATSAPP',
  'EMAIL',
  'NOTE',
  'MEETING',
  'QUOTATION',
  'INVOICE',
  'FOLLOW_UP',
  'STATUS_CHANGE',
  'ASSIGNMENT',
  'SYSTEM',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'FOLLOW_UP_OVERDUE',
  'NEW_LEAD',
  'LEAD_ASSIGNED',
  'QUOTATION_ACCEPTED',
  'INVOICE_OVERDUE',
  'LEAD_STALE',
  'SYSTEM',
] as const;

export const BUSINESS_TYPES = [
  { value: 'RETAIL', label: 'Retail & E-commerce' },
  { value: 'REAL_ESTATE', label: 'Real Estate & Property' },
  { value: 'EDUCATION', label: 'Education & Training' },
  { value: 'SERVICES', label: 'Services & Agencies' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const PLANS = ['STARTER', 'GROWTH', 'BUSINESS'] as const;

/** Lead score heuristics (0–100). */
export function computeLeadScore(input: {
  priority: Priority;
  expectedValue: number;
  hasEmail: boolean;
  notes: boolean;
}): number {
  let score = 20;
  score += PRIORITY_WEIGHT[input.priority] * 10; // 10–40
  if (input.expectedValue >= 500000) score += 20;
  else if (input.expectedValue >= 100000) score += 15;
  else if (input.expectedValue >= 25000) score += 10;
  else if (input.expectedValue > 0) score += 5;
  if (input.hasEmail) score += 10;
  if (input.notes) score += 5;
  return Math.min(100, Math.max(0, score));
}
