/**
 * Email Template Builder — visual template creation and management.
 * 
 * Templates support:
 * - HTML content with variable placeholders {{variable}}
 * - Preview mode with sample data
 * - Category organization
 * - Usage tracking
 */
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/http';

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  required?: boolean;
  defaultValue?: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category: 'MARKETING' | 'TRANSACTIONAL' | 'FOLLOW_UP' | 'SEQUENCE' | 'NEWSLETTER' | 'OTHER';
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables?: TemplateVariable[];
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  tags?: string[];
}

export interface TemplatePreviewData {
  [key: string]: string | number | boolean;
}

/**
 * Create an email template
 */
export async function createTemplate(orgId: string, userId: string, input: CreateTemplateInput) {
  // Validate HTML contains valid placeholder syntax
  const placeholders = extractPlaceholders(input.htmlContent);
  const subjectPlaceholders = extractPlaceholders(input.subject);
  const allPlaceholders = new Set([...placeholders, ...subjectPlaceholders]);
  
  // Auto-detect variables if not provided
  if (!input.variables && allPlaceholders.size > 0) {
    input.variables = Array.from(allPlaceholders).map(name => ({
      name,
      label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: 'text' as const,
      required: true,
    }));
  }
  
  return prisma.emailTemplate.create({
    data: {
      orgId,
      createdBy: userId,
      name: input.name,
      description: input.description || null,
      category: input.category || 'OTHER',
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent || null,
      variables: (input.variables || []) as any,
      fromName: input.fromName || null,
      fromEmail: input.fromEmail || null,
      replyTo: input.replyTo || null,
      tags: (input.tags || []) as any,
    },
  });
}

/**
 * List email templates with optional filters
 */
export async function listTemplates(orgId: string, filters?: { category?: string; search?: string }) {
  const where: Record<string, unknown> = { orgId };
  
  if (filters?.category) {
    where.category = filters.category;
  }
  
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { description: { contains: filters.search } },
      { tags: { contains: filters.search } },
    ];
  }
  
  return prisma.emailTemplate.findMany({
    where,
    orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Get a single template
 */
export async function getTemplate(orgId: string, id: string) {
  const template = await prisma.emailTemplate.findFirst({
    where: { id, orgId },
  });
  if (!template) throw notFound('Email template not found');
  return template;
}

/**
 * Update a template
 */
export async function updateTemplate(orgId: string, id: string, data: Partial<CreateTemplateInput>) {
  await getTemplate(orgId, id);
  
  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category) updateData.category = data.category;
  if (data.subject) updateData.subject = data.subject;
  if (data.htmlContent) updateData.htmlContent = data.htmlContent;
  if (data.textContent !== undefined) updateData.textContent = data.textContent;
  if (data.variables) updateData.variables = data.variables;
  if (data.fromName !== undefined) updateData.fromName = data.fromName;
  if (data.fromEmail !== undefined) updateData.fromEmail = data.fromEmail;
  if (data.replyTo !== undefined) updateData.replyTo = data.replyTo;
  if (data.tags) updateData.tags = data.tags;
  
  return prisma.emailTemplate.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete a template
 */
export async function deleteTemplate(orgId: string, id: string) {
  await getTemplate(orgId, id);
  await prisma.emailTemplate.delete({ where: { id } });
  return { deleted: true };
}

/**
 * Preview a template with sample data
 */
export async function previewTemplate(orgId: string, id: string, data: TemplatePreviewData) {
  const template = await getTemplate(orgId, id);
  
  return {
    subject: renderTemplate(template.subject, data),
    htmlContent: renderTemplate(template.htmlContent, data),
    textContent: template.textContent ? renderTemplate(template.textContent, data) : null,
    fromName: template.fromName,
    fromEmail: template.fromEmail,
  };
}

/**
 * Render a template string by replacing {{variable}} placeholders
 */
export function renderTemplate(content: string, data: TemplatePreviewData): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) {
      return match; // Keep placeholder if no value
    }
    return String(value);
  });
}

/**
 * Extract all {{variable}} placeholders from content
 */
export function extractPlaceholders(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

/**
 * Duplicate a template
 */
export async function duplicateTemplate(orgId: string, userId: string, id: string, newName?: string) {
  const original = await getTemplate(orgId, id);
  
  return prisma.emailTemplate.create({
    data: {
      orgId,
      createdBy: userId,
      name: newName || `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      subject: original.subject,
      htmlContent: original.htmlContent,
      textContent: original.textContent,
      variables: original.variables as any,
      fromName: original.fromName,
      fromEmail: original.fromEmail,
      replyTo: original.replyTo,
      tags: original.tags as any,
    },
  });
}

/**
 * Increment usage count for a template
 */
export async function trackTemplateUsage(id: string) {
  return prisma.emailTemplate.update({
    where: { id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Get template statistics
 */
export async function getTemplateStats(orgId: string) {
  const templates = await prisma.emailTemplate.findMany({
    where: { orgId },
    select: {
      category: true,
      usageCount: true,
    },
  });
  
  const byCategory: Record<string, { count: number; totalUsage: number }> = {};
  let totalUsage = 0;
  
  for (const t of templates) {
    if (!byCategory[t.category]) {
      byCategory[t.category] = { count: 0, totalUsage: 0 };
    }
    byCategory[t.category].count++;
    byCategory[t.category].totalUsage += t.usageCount;
    totalUsage += t.usageCount;
  }
  
  return {
    totalTemplates: templates.length,
    totalUsage,
    byCategory,
  };
}

/**
 * Pre-built template examples
 */
export const TEMPLATE_EXAMPLES: Array<{
  name: string;
  category: CreateTemplateInput['category'];
  subject: string;
  htmlContent: string;
  variables: TemplateVariable[];
}> = [
  {
    name: 'Welcome Email',
    category: 'TRANSACTIONAL',
    subject: 'Welcome to {{company_name}}, {{first_name}}!',
    htmlContent: `
      <h1>Welcome, {{first_name}}!</h1>
      <p>Thank you for joining <strong>{{company_name}}</strong>.</p>
      <p>Your account is ready. Here's what you can do next:</p>
      <ul>
        <li>Complete your profile</li>
        <li>Explore the dashboard</li>
        <li>Connect your integrations</li>
      </ul>
      <p>Need help? Reply to this email or check our <a href="{{help_url}}">help center</a>.</p>
      <p>Best regards,<br>The {{company_name}} Team</p>
    `,
    variables: [
      { name: 'first_name', label: 'First Name', type: 'text', required: true },
      { name: 'company_name', label: 'Company Name', type: 'text', required: true },
      { name: 'help_url', label: 'Help URL', type: 'text' },
    ],
  },
  {
    name: 'Follow-up Reminder',
    category: 'FOLLOW_UP',
    subject: 'Following up on our conversation, {{lead_name}}',
    htmlContent: `
      <p>Hi {{lead_name}},</p>
      <p>I hope this email finds you well. I wanted to follow up on our recent conversation about {{topic}}.</p>
      {{#if custom_message}}
      <p>{{custom_message}}</p>
      {{/if}}
      <p>Would you be available for a quick call this {{preferred_day}}? I'd love to discuss how we can help with {{pain_point}}.</p>
      <p>Best,<br>{{sender_name}}</p>
    `,
    variables: [
      { name: 'lead_name', label: 'Lead Name', type: 'text', required: true },
      { name: 'topic', label: 'Topic', type: 'text', required: true },
      { name: 'sender_name', label: 'Your Name', type: 'text', required: true },
      { name: 'preferred_day', label: 'Preferred Day', type: 'text' },
      { name: 'pain_point', label: 'Pain Point', type: 'text' },
    ],
  },
  {
    name: 'Invoice Ready',
    category: 'TRANSACTIONAL',
    subject: 'Invoice #{{invoice_number}} from {{company_name}}',
    htmlContent: `
      <h2>Invoice Ready</h2>
      <p>Hi {{client_name}},</p>
      <p>Your invoice <strong>#{{invoice_number}}</strong> is ready for review.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">{{currency}} {{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Due Date:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">{{due_date}}</td>
        </tr>
      </table>
      <p><a href="{{payment_url}}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Pay Now</a></p>
      <p>If you have any questions, please don't hesitate to reach out.</p>
      <p>Thank you for your business!</p>
    `,
    variables: [
      { name: 'client_name', label: 'Client Name', type: 'text', required: true },
      { name: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
      { name: 'company_name', label: 'Your Company', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'text', required: true },
      { name: 'currency', label: 'Currency', type: 'text', defaultValue: '₹' },
      { name: 'due_date', label: 'Due Date', type: 'date', required: true },
      { name: 'payment_url', label: 'Payment URL', type: 'text', required: true },
    ],
  },
  {
    name: 'Meeting Confirmation',
    category: 'OTHER',
    subject: 'Meeting Confirmed: {{meeting_title}} on {{meeting_date}}',
    htmlContent: `
      <h2>Meeting Confirmed</h2>
      <p>Hi {{attendee_name}},</p>
      <p>Your meeting has been confirmed:</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Topic:</strong> {{meeting_title}}</p>
        <p><strong>Date:</strong> {{meeting_date}}</p>
        <p><strong>Time:</strong> {{meeting_time}}</p>
        {{#if meeting_link}}
        <p><strong>Join Link:</strong> <a href="{{meeting_link}}">{{meeting_link}}</a></p>
        {{/if}}
        {{#if meeting_location}}
        <p><strong>Location:</strong> {{meeting_location}}</p>
        {{/if}}
      </div>
      <p>Please let me know if you need to reschedule.</p>
      <p>Best regards,<br>{{organizer_name}}</p>
    `,
    variables: [
      { name: 'attendee_name', label: 'Attendee Name', type: 'text', required: true },
      { name: 'meeting_title', label: 'Meeting Title', type: 'text', required: true },
      { name: 'meeting_date', label: 'Meeting Date', type: 'date', required: true },
      { name: 'meeting_time', label: 'Meeting Time', type: 'text', required: true },
      { name: 'meeting_link', label: 'Meeting Link', type: 'text' },
      { name: 'meeting_location', label: 'Location', type: 'text' },
      { name: 'organizer_name', label: 'Organizer Name', type: 'text', required: true },
    ],
  },
];
