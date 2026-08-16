/**
 * RBAC service.
 *  - seedOrgRoles: create the built-in Role rows for a new organisation
 *  - rolePermissions: resolve a user's permission set (Role row → legacy fallback)
 *  - orgRoles: list the org's roles for the UI
 */
import { prisma } from '../lib/prisma';
import { SYSTEM_ROLES, rolePermissionsFallback } from '../constants/rbac';

/** Create the system Role rows for an org (idempotent). */
export async function seedOrgRoles(orgId: string): Promise<void> {
  const existing = await prisma.role.findMany({ where: { orgId }, select: { key: true } });
  const have = new Set(existing.map((r) => r.key));
  const missing = SYSTEM_ROLES.filter((r) => !have.has(r.key));
  if (missing.length > 0) {
    await prisma.role.createMany({
      data: missing.map((r) => ({
        orgId,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: true,
        permissions: r.permissions as any,
      })),
    });
  }
  await syncSystemRoles(orgId);
}

/**
 * Refresh every org's built-in role rows to match the code definitions.
 *
 * System roles are defined in code; the DB copy is a cache. When the product
 * ships new permissions (e.g. a new module), existing orgs must receive them
 * without a manual migration. Custom (non-system) roles are left untouched.
 */
export async function syncSystemRoles(orgId: string): Promise<void> {
  await Promise.all(
    SYSTEM_ROLES.map((r) =>
      prisma.role.updateMany({
        where: { orgId, key: r.key, isSystem: true },
        data: { permissions: r.permissions as any },
      })
    )
  );
}

/** Permission set for a user's role within their org. */
export async function rolePermissions(orgId: string, roleKey: string): Promise<string[]> {
  try {
    const role = await prisma.role.findUnique({
      where: { orgId_key: { orgId, key: roleKey } },
      select: { permissions: true },
    });
    const perms = role?.permissions as string[] | null | undefined;
    if (Array.isArray(perms) && perms.length > 0) return perms;
  } catch {
    // fall through to legacy behaviour
  }
  return rolePermissionsFallback(roleKey);
}

/** Org roles for the Roles settings UI (system + custom). */
export async function orgRoles(orgId: string) {
  return prisma.role.findMany({ where: { orgId }, orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] });
}

export const ALL_PERMISSION_KEYS = [...SYSTEM_ROLES[0].permissions];
