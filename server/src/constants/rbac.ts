/**
 * RBAC catalog — granular permissions + system role definitions.
 *
 * Roles are stored per-organization in the `Role` table (isSystem = true for
 * the built-in roles below). Every org gets these seeded on creation, and
 * admins can create custom roles with any subset of PERMISSIONS.
 *
 * `rolePermissionsFallback()` keeps old databases working: when a Role row is
 * missing it derives permissions from the legacy role hierarchy.
 */

export const PERMISSIONS = [
  // Dashboard & navigation
  'dashboard.view',
  // Leads
  'leads.view',
  'leads.create',
  'leads.edit',
  'leads.delete',
  'leads.assign',
  'leads.export',
  // Contacts
  'contacts.view',
  'contacts.create',
  'contacts.edit',
  'contacts.delete',
  // Pipeline / deals
  'pipeline.view',
  'pipeline.edit',
  // Tasks & follow-ups
  'tasks.view',
  'tasks.create',
  'tasks.edit',
  'tasks.complete',
  // Quotations
  'quotations.view',
  'quotations.create',
  'quotations.edit',
  'quotations.delete',
  'quotations.convert',
  // Invoices & payments
  'invoices.view',
  'invoices.create',
  'invoices.edit',
  'invoices.delete',
  'invoices.cancel',
  'invoices.pay',
  'invoices.export',
  // Reports
  'reports.view',
  'reports.export',
  // QR lead capture
  'qr.manage',
  // AI
  'ai.use',
  'ai.manage',
  // Integrations
  'integrations.manage',
  // Team, roles & org
  'users.manage',
  'teams.manage',
  'roles.manage',
  'settings.manage',
  'billing.manage',
  'audit.view',
  // Platform (super-admin only)
  'admin.access',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ALL_PERMISSIONS: string[] = [...PERMISSIONS];

export interface SystemRoleDef {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

/** Built-in roles seeded into every organisation. */
export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    key: 'OWNER',
    name: 'Owner',
    description: 'Full control over the organisation, billing and team.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    description: 'Manages settings, team, integrations and billing — no platform access.',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'admin.access'),
  },
  {
    key: 'MANAGER',
    name: 'Manager',
    description: 'Leads a team: manages leads, documents and integrations.',
    permissions: [
      'dashboard.view',
      'leads.view', 'leads.create', 'leads.edit', 'leads.delete', 'leads.assign', 'leads.export',
      'contacts.view', 'contacts.create', 'contacts.edit', 'contacts.delete',
      'pipeline.view', 'pipeline.edit',
      'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.complete',
      'quotations.view', 'quotations.create', 'quotations.edit', 'quotations.delete', 'quotations.convert',
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.cancel', 'invoices.pay', 'invoices.export',
      'reports.view', 'reports.export',
      'qr.manage',
      'ai.use',
      'integrations.manage',
      'audit.view',
    ],
  },
  {
    key: 'SALES',
    name: 'Salesperson',
    description: 'Owns leads, follows up and creates quotations for their own leads.',
    permissions: [
      'dashboard.view',
      'leads.view', 'leads.create', 'leads.edit',
      'contacts.view', 'contacts.create', 'contacts.edit',
      'pipeline.view',
      'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.complete',
      'quotations.view', 'quotations.create', 'quotations.edit',
      'invoices.view',
      'reports.view',
      'ai.use',
    ],
  },
  {
    key: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Handles quotations, invoices and payments.',
    permissions: [
      'dashboard.view',
      'leads.view',
      'contacts.view',
      'pipeline.view',
      'tasks.view',
      'quotations.view', 'quotations.create', 'quotations.edit',
      'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.pay', 'invoices.cancel', 'invoices.export',
      'reports.view', 'reports.export',
    ],
  },
  {
    key: 'SUPPORT',
    name: 'Support',
    description: 'Reads leads and conversations to help customers.',
    permissions: [
      'dashboard.view',
      'leads.view',
      'contacts.view',
      'pipeline.view',
      'tasks.view',
      'quotations.view',
      'invoices.view',
      'ai.use',
    ],
  },
  {
    key: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access to the workspace.',
    permissions: [
      'dashboard.view',
      'leads.view',
      'contacts.view',
      'pipeline.view',
      'tasks.view',
      'quotations.view',
      'invoices.view',
      'reports.view',
    ],
  },
];

export const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key);

export const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  SYSTEM_ROLES.map((r) => [r.key, r.name])
);

/** Legacy hierarchy fallback when no Role row exists (pre-RBAC databases). */
export function rolePermissionsFallback(role: string): string[] {
  const def = SYSTEM_ROLES.find((r) => r.key === role);
  if (def) return def.permissions;
  // Unknown/custom role without a Role row → read-only, safest default.
  return ['dashboard.view'];
}
