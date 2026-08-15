import { Router } from 'express';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { scopedWhere } from '../middleware/auth';
import { audit } from '../lib/audit';
import { notify } from '../lib/serializers';
import {
  buildLeadWhere,
  leadOrderBy,
  createLead,
  leadsToCsv,
  normalizePhone,
} from '../services/leads';
import { recordAssignment } from '../services/assignment';
import { createFollowUp, completeFollowUp } from '../services/followups';
import { isManagerOrAbove, assertManagerOrAbove } from '../middleware/auth';
import {
  leadCreateSchema,
  leadUpdateSchema,
  leadBulkSchema,
  activityCreateSchema,
  taskCreateSchema,
} from '../validators/schemas';
import { computeLeadScore, OPEN_STATUSES } from '../constants';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── List (paginated, searchable, filterable, sortable) ─────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));

    const where = buildLeadWhere({
      orgId: user.orgId,
      scope: scopedWhere(user, user.orgId),
      search: q.search,
      status: q.status,
      source: q.source,
      ownerId: q.ownerId,
      stageId: q.stageId,
      priority: q.priority,
      minValue: q.minValue ? Number(q.minValue) : undefined,
      from: q.from,
      to: q.to,
    });

    const [total, rows] = await Promise.all([
      prisma.lead.count({ where: where as any }),
      prisma.lead.findMany({
        where: where as any,
        orderBy: leadOrderBy({ sort: q.sort, dir: q.dir === 'asc' ? 'asc' : 'desc' }) as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true, color: true } },
        },
      }),
    ]);

    const [newCount, openCount, wonCount, overdueCount] = await Promise.all([
      prisma.lead.count({ where: { ...where, status: 'NEW' } as any }),
      prisma.lead.count({ where: { ...where, status: { in: OPEN_STATUSES } } as any }),
      prisma.lead.count({ where: { ...where, status: 'WON' } as any }),
      prisma.task.count({
        where: {
          orgId: user.orgId,
          status: 'PENDING',
          dueAt: { lt: new Date() },
          ...(user.role === 'SALES' ? { userId: user.id } : {}),
        },
      }),
    ]);

    return ok(res, {
      rows,
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      counts: { new: newCount, open: openCount, won: wonCount, overdue: overdueCount },
    });
  })
);

// ── CSV export ──────────────────────────────────────────────────────
router.get(
  '/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const where = buildLeadWhere({
      orgId: user.orgId,
      scope: scopedWhere(user, user.orgId),
      search: q.search,
      status: q.status,
      source: q.source,
      ownerId: q.ownerId,
    });
    const rows = await prisma.lead.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: { owner: { select: { name: true } } },
    });
    const csv = leadsToCsv(
      rows.map((r) => ({
        name: r.name,
        phone: r.phone,
        email: r.email,
        company: r.company,
        source: r.source,
        status: r.status,
        owner: r.owner?.name,
        score: r.score,
        expectedValue: r.expectedValue,
        nextFollowUpAt: r.nextFollowUpAt?.toISOString(),
        createdAt: r.createdAt.toISOString(),
      }))
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);
    return res.send(csv);
  })
);

// ── CSV import ─────────────────────────────────────────────────────
router.post(
  '/import',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (!req.file) throw badRequest('Attach a CSV file to import.');
    const text = req.file.buffer.toString('utf-8');
    let records: Record<string, string>[];
    try {
      records = parseCsv(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    } catch {
      throw badRequest('Could not read that CSV file. Make sure it has a header row.');
    }
    if (!records.length) throw badRequest('The CSV file is empty.');

    const pick = (...keys: string[]) => {
      const key = keys.find((k) => records[0] && k in records[0]);
      return key ? records[0][key] : undefined;
    };
    void pick;

    let created = 0;
    const errors: string[] = [];
    for (const row of records) {
      const name = row.Name || row.name || row['Lead Name'] || row['Customer Name'];
      const phone = row.Phone || row.phone || row.Mobile || row['Phone Number'];
      const email = row.Email || row.email;
      if (!name || (!phone && !email)) {
        errors.push(`Row skipped: missing name and phone/email`);
        continue;
      }
      try {
        await createLead({
          orgId: user.orgId,
          actorId: user.id,
          name,
          phone,
          email,
          company: row.Company || row.company,
          source: 'CSV',
          expectedValue: Number(row['Expected Value'] || row.expectedValue || 0) || 0,
          notes: row.Notes || row.notes || undefined,
          ownerId: row.Owner ? undefined : null,
        });
        created++;
      } catch (err: any) {
        if (err?.status === 409) {
          errors.push(`Skipped duplicate: ${name}`);
        } else {
          errors.push(`Failed: ${name} — ${err?.message || 'unknown error'}`);
        }
      }
    }
    await audit({ orgId: user.orgId, userId: user.id, action: 'LEADS_IMPORTED', entity: 'Lead', metadata: { created, errors: errors.length } });
    return ok(res, { created, skipped: errors.length, errors: errors.slice(0, 20) });
  })
);

// ── Create ─────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(leadCreateSchema, req.body);
    // ownerId must belong to the caller's organisation (prevents cross-org assignment/notification leaks)
    if (input.ownerId) {
      const target = await prisma.user.findFirst({ where: { id: input.ownerId, orgId: user.orgId, active: true } });
      if (!target) throw badRequest('The assigned user is not part of your team.');
    }
    const lead = await createLead({
      orgId: user.orgId,
      actorId: user.id,
      ...input,
      priority: (input.priority as any) || 'MEDIUM',
      // A salesperson manually entering a lead keeps it; managers' entries flow through the auto-assignment engine.
      ownerId: user.role === 'SALES' ? user.id : input.ownerId || null,
      phone: (input.phone as string) || null,
      email: (input.email as string) || null,
      nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
    });
    return ok(res, { lead }, 201);
  })
);

// ── Bulk actions ───────────────────────────────────────────────────
router.post(
  '/bulk',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(leadBulkSchema, req.body);
    const where = { id: { in: input.ids }, orgId: user.orgId, deletedAt: null };
    const leads = await prisma.lead.findMany({ where: { ...where, ...scopedWhere(user, user.orgId) } as any });

    if (input.action === 'delete') {
      await prisma.lead.updateMany({
        where: { id: { in: leads.map((l) => l.id) }, orgId: user.orgId },
        data: { deletedAt: new Date() },
      });
      await audit({ orgId: user.orgId, userId: user.id, action: 'LEADS_BULK_DELETED', entity: 'Lead', metadata: { ids: leads.map((l) => l.id) } });
    } else if (input.action === 'status' && input.status) {
      assertManagerOrAbove(user);
      await prisma.lead.updateMany({
        where: { id: { in: leads.map((l) => l.id) }, orgId: user.orgId },
        data: { status: input.status },
      });
    } else if (input.action === 'assign' && input.ownerId) {
      assertManagerOrAbove(user);
      await prisma.lead.updateMany({
        where: { id: { in: leads.map((l) => l.id) }, orgId: user.orgId },
        data: { ownerId: input.ownerId },
      });
      const owner = await prisma.user.findFirst({ where: { id: input.ownerId, orgId: user.orgId } });
      await notify({
        orgId: user.orgId,
        userId: input.ownerId,
        type: 'LEAD_ASSIGNED',
        title: `${leads.length} lead${leads.length > 1 ? 's' : ''} assigned to you`,
        link: '/app/leads',
      });
      if (owner) {
        for (const lead of leads) {
          await recordAssignment({
            orgId: user.orgId,
            leadId: lead.id,
            leadName: lead.name,
            newOwnerId: input.ownerId,
            actorId: user.id,
            mode: 'bulk',
          });
        }
      }
    } else if (input.action === 'tag' && input.tag) {
      for (const lead of leads) {
        const tags = Array.isArray(lead.tags) ? (lead.tags as string[]) : [];
        if (!tags.includes(input.tag)) {
          await prisma.lead.update({ where: { id: lead.id }, data: { tags: [...tags, input.tag] as any } });
        }
      }
    }

    return ok(res, { updated: leads.length });
  })
);

// ── Detail ─────────────────────────────────────────────────────────
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        stage: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 50, include: { user: { select: { name: true } } } },
        tasks: { orderBy: { dueAt: 'asc' }, take: 20 },
        quotations: { orderBy: { createdAt: 'desc' }, take: 10 },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!lead) throw notFound('Lead not found');
    // salespeople can only view their own leads
    if (user.role === 'SALES' && lead.ownerId !== user.id) throw notFound('Lead not found');
    return ok(res, { lead });
  })
);

// ── Update / move stage / change owner ─────────────────────────────
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(leadUpdateSchema, req.body);
    const existing = await prisma.lead.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw notFound('Lead not found');
    // Salespeople may only modify leads they own.
    if (user.role === 'SALES' && existing.ownerId !== user.id) {
      throw notFound('Lead not found');
    }
    // ownerId must belong to the caller's organisation
    if (input.ownerId) {
      const target = await prisma.user.findFirst({ where: { id: input.ownerId, orgId: user.orgId } });
      if (!target) throw badRequest('The assigned user is not part of your team.');
    }

    const data: Record<string, unknown> = {};
    const activityNotes: string[] = [];

    if (input.name !== undefined) data.name = input.name;
    if (input.company !== undefined) data.company = input.company || null;
    if (input.notes !== undefined) data.notes = input.notes || null;
    if (input.priority !== undefined) { data.priority = input.priority; activityNotes.push(`Priority → ${input.priority}`); }
    if (input.expectedValue !== undefined) data.expectedValue = input.expectedValue;
    if (input.source !== undefined) data.source = input.source;
    if (input.campaignName !== undefined) data.campaignName = input.campaignName || null;
    if (input.phone !== undefined) data.phone = normalizePhone((input.phone as string) || null);
    if (input.email !== undefined) data.email = input.email?.toLowerCase().trim() || null;
    if (input.tags !== undefined) data.tags = (input.tags as any) || undefined;
    if (input.customFields !== undefined) data.customFields = (input.customFields as any) || undefined;
    if (input.nextFollowUpAt !== undefined) data.nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null;
    if (input.stageId !== undefined) { data.stageId = input.stageId || null; }

    // stage/status change → activity
    const stageChanged = input.stageId && input.stageId !== existing.stageId;
    const statusChanged = input.status && input.status !== existing.status;

    // owner change → activity + notification
    if (input.ownerId !== undefined && input.ownerId !== existing.ownerId) {
      assertManagerOrAbove(user);
      data.ownerId = input.ownerId || null;
      await recordAssignment({
        orgId: user.orgId,
        leadId: existing.id,
        leadName: existing.name,
        newOwnerId: input.ownerId || null,
        oldOwnerId: existing.ownerId,
        actorId: user.id,
        mode: 'manual',
      });
      activityNotes.push('Owner updated');
    }

    if (input.status !== undefined) data.status = input.status;

    // Recompute score
    const nextScore = computeLeadScore({
      priority: (input.priority as any) || existing.priority,
      expectedValue: input.expectedValue ?? existing.expectedValue,
      hasEmail: Boolean(input.email ?? existing.email),
      notes: Boolean(input.notes ?? existing.notes),
    });
    data.score = nextScore;

    const updated = await prisma.lead.update({
      where: { id: existing.id },
      data,
      include: { owner: { select: { id: true, name: true } }, stage: true },
    });

    if (stageChanged || statusChanged) {
      const newStage = input.stageId ? await prisma.pipelineStage.findFirst({ where: { id: input.stageId, orgId: user.orgId } }) : null;
      const statusText = input.status ? `Status → ${input.status}` : '';
      const stageText = newStage ? `Stage → ${newStage.name}` : '';
      await prisma.activity.create({
        data: {
          orgId: user.orgId,
          leadId: existing.id,
          userId: user.id,
          type: 'STATUS_CHANGE',
          title: 'Pipeline stage changed',
          body: [statusText, stageText].filter(Boolean).join(' · '),
          metadata: { status: input.status, stageId: input.stageId },
        },
      });
    }

    if (activityNotes.length) {
      await prisma.activity.create({
        data: {
          orgId: user.orgId,
          leadId: existing.id,
          userId: user.id,
          type: 'NOTE',
          title: 'Lead details updated',
          body: activityNotes.join(', '),
        },
      });
    }

    return ok(res, { lead: updated });
  })
);

// ── Soft delete ────────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const existing = await prisma.lead.findFirst({ where: { id: req.params.id, orgId: user.orgId, deletedAt: null } });
    if (!existing) throw notFound('Lead not found');
    await prisma.lead.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await audit({ orgId: user.orgId, userId: user.id, action: 'LEAD_DELETED', entity: 'Lead', entityId: existing.id });
    return ok(res, { deleted: true });
  })
);

// ── Activities ─────────────────────────────────────────────────────
router.post(
  '/:id/activity',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(activityCreateSchema, req.body);
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, orgId: user.orgId, deletedAt: null } });
    if (!lead) throw notFound('Lead not found');
    if (user.role === 'SALES' && lead.ownerId !== user.id) throw notFound('Lead not found');

    const activity = await prisma.activity.create({
      data: {
        orgId: user.orgId,
        leadId: lead.id,
        userId: user.id,
        type: input.type,
        title: activityTitle(input.type),
        body: input.body,
      },
    });
    // Logging a call/WhatsApp counts as contacting the lead
    if (['CALL', 'WHATSAPP', 'EMAIL', 'MEETING'].includes(input.type)) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: input.at ? new Date(input.at) : new Date() },
      });
    }
    return ok(res, { activity }, 201);
  })
);

// ── Follow-ups on a lead ───────────────────────────────────────────
router.post(
  '/:id/tasks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(taskCreateSchema, req.body);
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, orgId: user.orgId, deletedAt: null } });
    if (!lead) throw notFound('Lead not found');
    if (user.role === 'SALES' && lead.ownerId !== user.id) throw notFound('Lead not found');
    await createFollowUp({
      orgId: user.orgId,
      leadId: lead.id,
      userId: input.userId || user.id,
      title: input.title,
      kind: (input.kind as any) || 'FOLLOW_UP',
      dueAt: new Date(input.dueAt),
      notes: input.notes || undefined,
      actorId: user.id,
    });
    return ok(res, { created: true }, 201);
  })
);

router.post(
  '/tasks/:taskId/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    await completeFollowUp(req.params.taskId, user.orgId, user.id);
    return ok(res, { completed: true });
  })
);

function activityTitle(type: string): string {
  const map: Record<string, string> = {
    CALL: 'Call logged',
    WHATSAPP: 'WhatsApp message',
    EMAIL: 'Email sent',
    NOTE: 'Note added',
    MEETING: 'Meeting held',
  };
  return map[type] || 'Activity logged';
}

export default router;
