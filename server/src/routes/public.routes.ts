/**
 * Public QR lead-capture endpoints (no auth — customers scan a QR to land here).
 *  - GET  /api/public/qr/:slug      form metadata + records a scan
 *  - POST /api/public/qr/:slug/lead accepts a lead from the form
 *
 * Org isolation: the QR slug is globally unique, so the org is resolved from
 * the QR record itself — never from client-supplied ids.
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok, validate, badRequest, ApiError } from '../lib/http';
import { publicQrLeadSchema } from '../validators/schemas';
import { publicLeadLimiter } from '../middleware/rate-limit';
import { createLead, findDuplicate } from '../services/leads';

const router = Router();

async function loadQr(slug: string) {
  const qr = await prisma.qrCode.findUnique({
    where: { slug },
    include: { campaign: { select: { id: true, name: true } }, org: { select: { name: true } } },
  });
  return qr;
}

/**
 * Record that someone opened the form (scan tracking).
 * - Duplicate/returning submissions record the scan row but do NOT inflate leadCount.
 * - Page views are deduped per IP within a short window so refreshes/focus don't inflate scanCount.
 */
async function recordScan(
  qrId: string,
  ip: string | undefined,
  leadId?: string,
  opts: { countLead?: boolean } = {}
) {
  const countLead = opts.countLead ?? Boolean(leadId);
  const recent = await prisma.qrScan.findFirst({
    where: {
      qrId,
      leadId: null,
      ip: ip || null,
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // 30-minute window
    },
  });
  if (!leadId && recent) return; // already counted this device's scan recently
  await prisma.qrScan.create({ data: { qrId, ip: ip || null, leadId } });
  await prisma.qrCode.update({
    where: { id: qrId },
    data: countLead ? { leadCount: { increment: 1 } } : { scanCount: { increment: 1 } },
  });
}

router.get(
  '/qr/:slug',
  asyncHandler(async (req, res) => {
    const qr = await loadQr(req.params.slug);
    if (!qr) throw badRequest('This QR code is not valid or has been removed.');
    if (!qr.enabled) throw badRequest('This lead form is currently paused. Please contact the business directly.');

    // every page view of the form counts as a scan
    await recordScan(qr.id, req.ip);

    return ok(res, {
      title: qr.title,
      description: qr.description,
      fields: (qr.fields as string[]) || ['name', 'phone', 'email', 'message'],
      orgName: qr.org.name,
      campaignName: qr.campaign?.name || null,
    });
  })
);

router.post(
  '/qr/:slug/lead',
  publicLeadLimiter,
  asyncHandler(async (req, res) => {
    const qr = await loadQr(req.params.slug);
    if (!qr) throw badRequest('This QR code is not valid or has been removed.');
    if (!qr.enabled) throw badRequest('This lead form is currently paused. Please contact the business directly.');

    const input = validate(publicQrLeadSchema, req.body);
    const name = input.name.trim();

    // Duplicate phone/email? Don't create a second lead — just acknowledge.
    const duplicate = await findDuplicate(qr.orgId, input.phone || null, input.email || null);
    if (duplicate) {
      await recordScan(qr.id, req.ip, duplicate.id, { countLead: false });
      return ok(
        res,
        {
          received: true,
          duplicate: true,
          message: 'Thanks! Our records show we already have your details — our team will reach out shortly.',
        },
        200
      );
    }

    try {
      const lead = await createLead({
        orgId: qr.orgId,
        name,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.message || null,
        source: 'QR',
        campaignId: qr.campaignId || null,
        campaignName: qr.campaign?.name || null,
        priority: 'MEDIUM',
        createdVia: 'qr-form',
      });
      await recordScan(qr.id, req.ip, lead.id);
      return ok(
        res,
        { received: true, message: `Thanks ${name.split(' ')[0]}! We've got your details and will get back to you soon.` },
        201
      );
    } catch (err) {
      // A same-moment duplicate (between the check and the insert) is fine to acknowledge.
      if (err instanceof ApiError && err.status === 409) {
        const existing = await findDuplicate(qr.orgId, input.phone || null, input.email || null);
        if (existing) await recordScan(qr.id, req.ip, existing.id, { countLead: false });
        return ok(res, { received: true, duplicate: true, message: 'Thanks! We already have your details — our team will reach out shortly.' }, 200);
      }
      throw err;
    }
  })
);

export default router;
