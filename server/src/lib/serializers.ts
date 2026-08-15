import { prisma } from './prisma';
import type { Organization, User } from '@prisma/client';

export interface NotifyInput {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/** Create an in-app notification. Fire-and-forget, never throws. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });
  } catch {
    // Notifications must never break the main flow.
  }
}

/** Sanitize a user for client responses. */
export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    title: user.title,
    active: user.active,
    avatarUrl: user.avatarUrl,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

export function publicOrg(org: Organization) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    businessType: org.businessType,
    plan: org.plan,
    status: org.status,
    logoUrl: org.logoUrl,
  };
}
