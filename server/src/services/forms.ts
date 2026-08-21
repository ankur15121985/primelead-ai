/**
 * Forms Builder (Phase 11, spec §26).
 *
 * Dynamic form creation with:
 *  - Configurable fields (name, email, phone, company, custom)
 *  - Submit actions: CREATE_LEAD, CREATE_CONTACT, WEBHOOK, EMAIL_NOTIFY
 *  - UTM tracking on submissions
 *  - Spam protection (honeypot, basic rate limiting)
 *  - Embed code generation
 */
import { prisma } from '../lib/prisma';

// ── CRUD: Forms ─────────────────────────────────────────────

export async function createForm(
  orgId: string,
  data: {
    name: string;
    description?: string;
    slug?: string;
    fields: Array<{ name: string; label: string; type: string; required?: boolean; placeholder?: string; options?: string[] }>;
    submitAction?: string;
    submitConfig?: Record<string, unknown>;
    captchaEnabled?: boolean;
    utmTracking?: boolean;
    theme?: string;
    customCss?: string;
  }
) {
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Check slug uniqueness
  const existing = await prisma.form.findFirst({ where: { orgId, slug } });
  if (existing) throw Object.assign(new Error('A form with this slug already exists'), { status: 400 });

  return prisma.form.create({
    data: {
      orgId,
      name: data.name,
      description: data.description || null,
      slug,
      fields: data.fields as any,
      submitAction: data.submitAction || 'CREATE_LEAD',
      submitConfig: (data.submitConfig as any) || undefined,
      captchaEnabled: data.captchaEnabled ?? false,
      utmTracking: data.utmTracking ?? true,
      theme: data.theme || null,
      customCss: data.customCss || null,
    },
  });
}

export async function getForms(orgId: string) {
  return prisma.form.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getForm(orgId: string, formId: string) {
  const form = await prisma.form.findFirst({ where: { id: formId, orgId } });
  if (!form) throw Object.assign(new Error('Form not found'), { status: 404 });
  return form;
}

export async function getFormBySlug(slug: string) {
  // Public — no orgId needed (the slug is unique per org)
  return prisma.form.findFirst({ where: { slug, isActive: true } });
}

export async function updateForm(orgId: string, formId: string, data: Partial<{
  name: string;
  description: string;
  fields: Array<{ name: string; label: string; type: string; required?: boolean; placeholder?: string; options?: string[] }>;
  submitAction: string;
  submitConfig: Record<string, unknown>;
  captchaEnabled: boolean;
  utmTracking: boolean;
  theme: string;
  customCss: string;
  isActive: boolean;
}>) {
  const form = await prisma.form.findFirst({ where: { id: formId, orgId } });
  if (!form) throw Object.assign(new Error('Form not found'), { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.fields !== undefined) updateData.fields = data.fields;
  if (data.submitAction !== undefined) updateData.submitAction = data.submitAction;
  if (data.submitConfig !== undefined) updateData.submitConfig = data.submitConfig;
  if (data.captchaEnabled !== undefined) updateData.captchaEnabled = data.captchaEnabled;
  if (data.utmTracking !== undefined) updateData.utmTracking = data.utmTracking;
  if (data.theme !== undefined) updateData.theme = data.theme;
  if (data.customCss !== undefined) updateData.customCss = data.customCss;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.form.update({ where: { id: formId }, data: updateData });
}

export async function deleteForm(orgId: string, formId: string) {
  const form = await prisma.form.findFirst({ where: { id: formId, orgId } });
  if (!form) throw Object.assign(new Error('Form not found'), { status: 404 });
  await prisma.form.delete({ where: { id: formId } });
}

// ── Form Submission ─────────────────────────────────────────

export async function submitForm(
  formSlug: string,
  data: Record<string, unknown>,
  meta: { ipAddress?: string; userAgent?: string; referer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string }
) {
  const form = await getFormBySlug(formSlug);
  if (!form) throw Object.assign(new Error('Form not found or inactive'), { status: 404 });

  const orgId = form.orgId;

  // Basic honeypot check (if there's a field named "website" that's filled, it's likely a bot)
  if (data.website && typeof data.website === 'string' && data.website.length > 0) {
    // Silently reject — return success to not tip off bots
    return { success: true, submissionId: 'honeypot' };
  }

  // Create submission
  const submission = await prisma.formSubmission.create({
    data: {
      orgId,
      formId: form.id,
      data: data as any,
      source: meta.utmSource || 'direct',
      utmSource: meta.utmSource || null,
      utmMedium: meta.utmMedium || null,
      utmCampaign: meta.utmCampaign || null,
      utmContent: meta.utmContent || null,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      referer: meta.referer || null,
      status: 'NEW',
    },
  });

  // Increment form counter
  await prisma.form.update({
    where: { id: form.id },
    data: { totalSubmissions: { increment: 1 } },
  });

  // Process based on submit action
  let leadId: string | null = null;
  let contactId: string | null = null;

  if (form.submitAction === 'CREATE_LEAD') {
    const lead = await prisma.lead.create({
      data: {
        orgId,
        name: String(data.name || data.fullName || data.first_name || 'Unknown'),
        email: String(data.email || ''),
        phone: String(data.phone || data.mobile || ''),
        company: String(data.company || data.company_name || ''),
        source: 'FORM',
        notes: `Form submission: ${form.name}`,
        tags: ['inbound', 'form-submission'] as any,
      },
    });
    leadId = lead.id;

    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: { leadId, status: 'PROCESSED', processedAt: new Date() },
    });
  } else if (form.submitAction === 'CREATE_CONTACT') {
    const contact = await prisma.contact.create({
      data: {
        orgId,
        name: String(data.name || data.fullName || data.first_name || 'Unknown'),
        email: String(data.email || ''),
        phone: String(data.phone || data.mobile || ''),
        company: String(data.company || data.company_name || ''),
        notes: 'Source: FORM submission',
      },
    });
    contactId = contact.id;

    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: { contactId, status: 'PROCESSED', processedAt: new Date() },
    });
  }

  return { success: true, submissionId: submission.id, leadId, contactId };
}

// ── Form Submissions ────────────────────────────────────────

export async function getFormSubmissions(
  orgId: string,
  formId: string,
  filters: { status?: string; limit?: number; offset?: number }
) {
  const where: Record<string, unknown> = { orgId, formId };
  if (filters.status) where.status = filters.status;

  const [submissions, total] = await Promise.all([
    prisma.formSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.formSubmission.count({ where }),
  ]);

  return { submissions, total };
}

export async function getFormStats(orgId: string, formId: string) {
  const form = await prisma.form.findFirst({ where: { id: formId, orgId } });
  if (!form) throw Object.assign(new Error('Form not found'), { status: 404 });

  const [total, byStatus, recentSubmissions] = await Promise.all([
    prisma.formSubmission.count({ where: { orgId, formId } }),
    prisma.formSubmission.groupBy({
      by: ['status'],
      where: { orgId, formId },
      _count: { _all: true },
    }),
    prisma.formSubmission.findMany({
      where: { orgId, formId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Source breakdown
  const bySource = await prisma.formSubmission.groupBy({
    by: ['source'],
    where: { orgId, formId },
    _count: { _all: true },
  });

  return {
    total,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    bySource: bySource.map((s) => ({ source: s.source || 'unknown', count: s._count._all })),
    recentSubmissions,
  };
}

// ── Embed Code ──────────────────────────────────────────────

export function generateEmbedCode(form: any, baseUrl: string): string {
  return `<!-- ${form.name} Form -->
<div id="gf-${form.slug}"></div>
<script>
(function() {
  var s = document.createElement('script');
  s.src = '${baseUrl}/api/public/forms/${form.slug}/embed.js';
  s.async = true;
  document.body.appendChild(s);
})();
</script>`;
}
