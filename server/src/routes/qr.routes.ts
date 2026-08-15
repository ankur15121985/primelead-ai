/**
 * QR lead capture — authenticated routes.
 *  - GET    /            list QR codes (with stats + rendered QR image)
 *  - POST   /            create (generates slug + QR image)
 *  - GET    /:id         one QR code with recent captured leads
 *  - PATCH  /:id         update title/description/fields/enabled/campaign
 *  - DELETE /:id         remove (manager+)
 */
import crypto from 'crypto';
import { Router } from 'express';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok, validate, badRequest } from '../lib/http';
import { requireAuth, requirePermission, assertManagerOrAbove, type AuthedRequest } from '../middleware/auth';
import { qrCreateSchema, qrUpdateSchema } from '../validators/schemas';
import { config } from '../config';
import { audit } from '../lib/audit';

const router = Router();
router.use(requireAuth);

const QR_FIELD_DEFAULTS = ['name', 'phone', 'email', 'message'];

function generateSlug(): string {
  return crypto.randomBytes(6).toString('base64url'); // ~8 URL-safe chars
}

/** Full public URL that gets encoded into the QR image. */
export function qrPublicUrl(slug: string): string {
  return `${config.appUrl}/r/${slug}`;
}

export async function renderQrImage(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: 'M' });
}

/** Find a campaign by id or create it by name (org-scoped). */
async function resolveCampaign(orgId: string, campaignId?: string | null, campaignName?: string | null) {
  if (campaignId) {
    const existing = await prisma.campaign.findFirst({ where: { id: campaignId, orgId } });
    if (existing) return existing;
  }
  if (campaignName) {
    const name = campaignName.trim();
    const existing = await prisma.campaign.findFirst({ where: { orgId, name } });
    if (existing) return existing;
    return prisma.campaign.create({ data: { orgId, name, source: 'QR' } });
  }
  return null;
}

interface QrRow {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  fields: unknown;
  scanCount: number;
  leadCount: number;
  enabled: boolean;
  campaignId: string | null;
  campaign: { id: string; name: string } | null;
  createdAt: Date;
}

async function serializeQr(row: QrRow, withImage = true) {
  const url = qrPublicUrl(row.slug);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    slug: row.slug,
    url,
    image: withImage ? await renderQrImage(url) : null,
    fields: (row.fields as string[]) || QR_FIELD_DEFAULTS,
    scanCount: row.scanCount,
    leadCount: row.leadCount,
    conversionRate: row.scanCount > 0 ? Math.round((row.leadCount / row.scanCount) * 100) : 0,
    enabled: row.enabled,
    campaignId: row.campaignId,
    campaign: row.campaign,
    createdAt: row.createdAt,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    // Images are rendered eagerly for the grid; keep the list bounded so the
    // response stays snappy. Detailed views are available per QR code.
    const rows = await prisma.qrCode.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      include: { campaign: { select: { id: true, name: true } } },
      take: 50,
    });
    const items = await Promise.all(rows.map((r) => serializeQr(r as QrRow)));
    const campaigns = await prisma.campaign.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });
    return ok(res, { qrCodes: items, campaigns });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(qrCreateSchema, req.body);

    // unique slug with retry
    let slug = generateSlug();
    for (let i = 0; i < 4; i++) {
      const exists = await prisma.qrCode.findUnique({ where: { slug } });
      if (!exists) break;
      slug = generateSlug();
    }

    const campaign = await resolveCampaign(user.orgId, input.campaignId, input.campaignName);

    const qr = await prisma.qrCode.create({
      data: {
        orgId: user.orgId,
        title: input.title,
        description: input.description || null,
        slug,
        campaignId: campaign?.id || null,
        fields: input.fields as any,
      },
      include: { campaign: { select: { id: true, name: true } } },
    });

    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'QR_CREATED',
      entity: 'QrCode',
      entityId: qr.id,
      metadata: { title: qr.title },
      req,
    });

    return ok(res, { qrCode: await serializeQr(qr as QrRow) }, 201);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const qr = await prisma.qrCode.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!qr) throw badRequest('QR code not found.');

    const recentScans = await prisma.qrScan.findMany({
      where: { qrId: qr.id, leadId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        lead: {
          select: {
            id: true, name: true, phone: true, email: true, status: true, score: true, createdAt: true,
          },
        },
      },
    });
    const recentLeads = recentScans.map((s) => s.lead).filter(Boolean);

    return ok(res, { qrCode: await serializeQr(qr as QrRow), recentLeads });
  })
);

router.patch(
  '/:id',
  requirePermission('qr.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(qrUpdateSchema, req.body);
    const existing = await prisma.qrCode.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw badRequest('QR code not found.');

    const campaign =
      input.campaignId || input.campaignName
        ? await resolveCampaign(user.orgId, input.campaignId, input.campaignName)
        : undefined;

    const qr = await prisma.qrCode.update({
      where: { id: existing.id },
      data: {
        title: input.title ?? undefined,
        description: input.description === undefined ? undefined : (input.description || null),
        fields: input.fields ? (input.fields as any) : undefined,
        enabled: input.enabled ?? undefined,
        campaignId: campaign ? campaign.id : existing.campaignId,
      },
      include: { campaign: { select: { id: true, name: true } } },
    });

    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'QR_UPDATED',
      entity: 'QrCode',
      entityId: qr.id,
      req,
    });

    return ok(res, { qrCode: await serializeQr(qr as QrRow) });
  })
);

router.delete(
  '/:id',
  requirePermission('qr.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const existing = await prisma.qrCode.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw badRequest('QR code not found.');
    await prisma.qrCode.delete({ where: { id: existing.id } });
    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'QR_DELETED',
      entity: 'QrCode',
      entityId: existing.id,
      req,
    });
    return ok(res, { deleted: true });
  })
);

export default router;
