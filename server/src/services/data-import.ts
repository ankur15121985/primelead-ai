/**
 * Phase 15 — Enhanced data import with field mapping, preview, dry-run.
 *
 * Supports: leads, contacts, companies.
 * Flow: upload → parse → auto-detect columns → user maps fields → preview → dry-run → import.
 */
import { parse as parseCsv } from 'csv-parse/sync';
import { prisma } from '../lib/prisma';
import { sanitizeCsvCell } from '../lib/file-security';

/* ── Entity field definitions ────────────────────────────────── */

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'email' | 'phone' | 'enum' | 'date' | 'json';
  options?: string[];
}

export const ENTITY_FIELDS: Record<string, FieldDef[]> = {
  LEAD: [
    { key: 'name', label: 'Name', required: true, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'phone' },
    { key: 'email', label: 'Email', required: false, type: 'email' },
    { key: 'company', label: 'Company', required: false, type: 'string' },
    { key: 'source', label: 'Source', required: false, type: 'string' },
    { key: 'status', label: 'Status', required: false, type: 'enum', options: ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST', 'UNSUBSCRIBED'] },
    { key: 'priority', label: 'Priority', required: false, type: 'enum', options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    { key: 'expectedValue', label: 'Expected Value', required: false, type: 'number' },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
    { key: 'tags', label: 'Tags', required: false, type: 'string' },
  ],
  CONTACT: [
    { key: 'name', label: 'Name', required: true, type: 'string' },
    { key: 'email', label: 'Email', required: false, type: 'email' },
    { key: 'phone', label: 'Phone', required: false, type: 'phone' },
    { key: 'company', label: 'Company', required: false, type: 'string' },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
    { key: 'tags', label: 'Tags', required: false, type: 'string' },
  ],
  COMPANY: [
    { key: 'name', label: 'Company Name', required: true, type: 'string' },
    { key: 'domain', label: 'Domain', required: false, type: 'string' },
    { key: 'website', label: 'Website', required: false, type: 'string' },
    { key: 'industry', label: 'Industry', required: false, type: 'string' },
    { key: 'employeeCount', label: 'Employee Count', required: false, type: 'number' },
    { key: 'employeeRange', label: 'Employee Range', required: false, type: 'enum', options: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] },
    { key: 'revenueRange', label: 'Revenue Range', required: false, type: 'string' },
    { key: 'country', label: 'Country', required: false, type: 'string' },
    { key: 'city', label: 'City', required: false, type: 'string' },
    { key: 'phone', label: 'Phone', required: false, type: 'phone' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
  ],
};

/* ── Auto-detect column mapping ───────────────────────────────── */

export function autoDetectMapping(
  entity: string,
  csvHeaders: string[]
): Record<string, string> {
  const fields = ENTITY_FIELDS[entity] || [];
  const mapping: Record<string, string> = {};

  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const field of fields) {
      const fieldNormalized = field.key.toLowerCase();
      if (
        normalized === fieldNormalized ||
        normalized.includes(fieldNormalized) ||
        fieldNormalized.includes(normalized) ||
        // Common aliases
        (field.key === 'name' && ['companyname', 'companyname', 'fullname', 'leadname', 'customername', 'contactname'].includes(normalized)) ||
        (field.key === 'firstName' && ['fname', 'first', 'givenname'].includes(normalized)) ||
        (field.key === 'lastName' && ['lname', 'last', 'surname', 'familyname'].includes(normalized)) ||
        (field.key === 'phone' && ['phonenumber', 'mobile', 'cell', 'telephone'].includes(normalized)) ||
        (field.key === 'email' && ['emailaddress', 'mail'].includes(normalized)) ||
        (field.key === 'company' && ['organization', 'org', 'companyname'].includes(normalized)) ||
        (field.key === 'jobTitle' && ['title', 'position', 'role'].includes(normalized)) ||
        (field.key === 'employeeCount' && ['employees', 'headcount', 'size'].includes(normalized))
      ) {
        mapping[header] = field.key;
        break;
      }
    }
  }

  return mapping;
}

/* ── Parse CSV buffer ─────────────────────────────────────────── */

export function parseCsvBuffer(buffer: Buffer): { headers: string[]; rows: Record<string, string>[]; totalRows: number } {
  const text = buffer.toString('utf-8');
  const records = parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records, totalRows: records.length };
}

/* ── Validate rows against mapping ────────────────────────────── */

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: Array<{ row: number; field: string; message: string }>;
  stats: {
    total: number;
    valid: number;
    withErrors: number;
    duplicateCheck: number;
  };
}

export function validateRows(
  entity: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>
): ValidationResult {
  const fields = ENTITY_FIELDS[entity] || [];
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];
  let validCount = 0;
  let withErrors = 0;
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  let duplicateCheck = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rowHasError = false;

    for (const field of fields) {
      const csvColumn = Object.entries(mapping).find(([, v]) => v === field.key)?.[0];
      if (!csvColumn) continue;

      const value = (row[csvColumn] || '').trim();

      // Required check
      if (field.required && !value) {
        errors.push({ row: i + 1, field: field.key, message: `${field.label} is required` });
        rowHasError = true;
        continue;
      }

      if (!value) continue;

      // Type validation
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        warnings.push({ row: i + 1, field: field.key, message: `Invalid email format: "${value}"` });
      }
      if (field.type === 'phone' && !/^[+\d\s()-]{7,20}$/.test(value)) {
        warnings.push({ row: i + 1, field: field.key, message: `Phone format unusual: "${value}"` });
      }
      if (field.type === 'number' && isNaN(Number(value))) {
        errors.push({ row: i + 1, field: field.key, message: `"${value}" is not a valid number` });
        rowHasError = true;
      }
      if (field.type === 'enum' && field.options && !field.options.includes(value.toUpperCase())) {
        warnings.push({ row: i + 1, field: field.key, message: `"${value}" is not a standard value (expected: ${field.options.join(', ')})` });
      }

      // Duplicate detection
      if (field.key === 'email' && value) {
        const normalized = value.toLowerCase();
        if (seenEmails.has(normalized)) {
          duplicateCheck++;
          warnings.push({ row: i + 1, field: field.key, message: `Duplicate email: "${value}"` });
        }
        seenEmails.add(normalized);
      }
      if (field.key === 'name' && value) {
        const normalized = value.toLowerCase();
        if (seenNames.has(normalized)) {
          duplicateCheck++;
          warnings.push({ row: i + 1, field: field.key, message: `Possible duplicate: "${value}"` });
        }
        seenNames.add(normalized);
      }
    }

    if (!rowHasError) validCount++;
    else withErrors++;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      total: rows.length,
      valid: validCount,
      withErrors,
      duplicateCheck,
    },
  };
}

/* ── Execute import ───────────────────────────────────────────── */

export interface ImportResult {
  entity: string;
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export async function executeImport(
  orgId: string,
  actorId: string,
  entity: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  dryRun: boolean
): Promise<ImportResult> {
  if (dryRun) {
    const validation = validateRows(entity, rows, mapping);
    return {
      entity,
      created: validation.stats.valid,
      skipped: validation.stats.withErrors,
      errors: validation.errors.map((e) => ({ row: e.row, message: `[${e.field}] ${e.message}` })),
    };
  }

  const errors: ImportResult['errors'] = [];
  let created = 0;
  let skipped = 0;

  // Build reverse mapping: entity field → CSV column
  const fieldToColumn: Record<string, string> = {};
  for (const [csvCol, entityField] of Object.entries(mapping)) {
    fieldToColumn[entityField] = csvCol;
  }

  const getVal = (row: Record<string, string>, field: string): string => {
    const col = fieldToColumn[field];
    return col ? (row[col] || '').trim() : '';
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      switch (entity) {
        case 'LEAD': {
          const name = getVal(row, 'name');
          const phone = getVal(row, 'phone') || null;
          const email = getVal(row, 'email') || null;
          if (!name || (!phone && !email)) {
            errors.push({ row: i + 1, message: 'Missing name and phone/email' });
            skipped++;
            break;
          }
          // Dedupe by phone/email
          if (phone || email) {
            const existing = await prisma.lead.findFirst({
              where: {
                orgId,
                deletedAt: null,
                OR: [
                  ...(phone ? [{ phone }] : []),
                  ...(email ? [{ email: email.toLowerCase() }] : []),
                ],
              },
            });
            if (existing) {
              skipped++;
              break;
            }
          }
          await prisma.lead.create({
            data: {
              orgId,
              name,
              phone,
              email: email?.toLowerCase() || null,
              company: getVal(row, 'company') || null,
              source: getVal(row, 'source') || 'CSV_IMPORT',
              status: getVal(row, 'status') || 'NEW',
              priority: getVal(row, 'priority') || 'MEDIUM',
              expectedValue: Math.round((Number(getVal(row, 'expectedValue')) || 0) * 100),
              notes: getVal(row, 'notes') || null,
              tags: getVal(row, 'tags') ? getVal(row, 'tags').split(',').map((t) => t.trim()) : undefined,
            },
          });
          created++;
          break;
        }
        case 'CONTACT': {
          const name = getVal(row, 'name');
          if (!name) {
            errors.push({ row: i + 1, message: 'Name is required' });
            skipped++;
            break;
          }
          const email = getVal(row, 'email') || null;
          if (email) {
            const existing = await prisma.contact.findFirst({
              where: { orgId, email: email.toLowerCase() },
            });
            if (existing) { skipped++; break; }
          }
          await prisma.contact.create({
            data: {
              orgId,
              name,
              email: email?.toLowerCase() || null,
              phone: getVal(row, 'phone') || null,
              company: getVal(row, 'company') || null,
              notes: getVal(row, 'notes') || null,
              tags: getVal(row, 'tags') ? getVal(row, 'tags').split(',').map((t: string) => t.trim()) : undefined,
            },
          });
          created++;
          break;
        }
        case 'COMPANY': {
          const name = getVal(row, 'name');
          if (!name) {
            errors.push({ row: i + 1, message: 'Company name is required' });
            skipped++;
            break;
          }
          const domain = getVal(row, 'domain') || null;
          if (domain) {
            const existing = await prisma.company.findFirst({
              where: { orgId, domain: domain.toLowerCase() },
            });
            if (existing) { skipped++; break; }
          }
          const empCount = Number(getVal(row, 'employeeCount')) || null;
          await prisma.company.create({
            data: {
              orgId,
              name,
              domain: domain?.toLowerCase() || null,
              website: getVal(row, 'website') || null,
              industry: getVal(row, 'industry') || null,
              employeeCount: empCount,
              employeeRange: getVal(row, 'employeeRange') || null,
              revenueRange: getVal(row, 'revenueRange') || null,
              country: getVal(row, 'country') || null,
              city: getVal(row, 'city') || null,
              phone: getVal(row, 'phone') || null,
              description: getVal(row, 'description') || null,
            },
          });
          created++;
          break;
        }
      }
    } catch (err: any) {
      errors.push({ row: i + 1, message: err?.message || 'Unknown error' });
      skipped++;
    }
  }

  return { entity, created, skipped, errors };
}
