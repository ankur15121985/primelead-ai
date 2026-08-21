/**
 * Phase 16 — Custom report builder.
 *
 * Users create reports by picking: entity → metrics → dimensions → filters.
 * Reports are saved and can be shared, scheduled, or exported.
 */
import { prisma } from '../lib/prisma';

/* ── Available metrics & dimensions per entity ────────────────── */

export interface MetricDef {
  key: string;
  label: string;
  type: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field?: string; // for sum/avg
}

export interface DimensionDef {
  key: string;
  label: string;
  type: 'field' | 'date' | 'range';
  field?: string;
  dateGroupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export const ENTITY_METRICS: Record<string, MetricDef[]> = {
  LEAD: [
    { key: 'leadCount', label: 'Lead Count', type: 'count' },
    { key: 'totalValue', label: 'Total Value', type: 'sum', field: 'expectedValue' },
    { key: 'avgValue', label: 'Avg Value', type: 'avg', field: 'expectedValue' },
    { key: 'wonCount', label: 'Won Leads', type: 'count' },
    { key: 'lostCount', label: 'Lost Leads', type: 'count' },
  ],
  CONTACT: [
    { key: 'contactCount', label: 'Contact Count', type: 'count' },
  ],
  COMPANY: [
    { key: 'companyCount', label: 'Company Count', type: 'count' },
    { key: 'avgEmployees', label: 'Avg Employees', type: 'avg', field: 'employeeCount' },
  ],
  DEAL: [
    { key: 'dealCount', label: 'Deal Count', type: 'count' },
    { key: 'totalValue', label: 'Total Value', type: 'sum', field: 'expectedValue' },
    { key: 'avgValue', label: 'Avg Deal Value', type: 'avg', field: 'expectedValue' },
  ],
  TASK: [
    { key: 'taskCount', label: 'Task Count', type: 'count' },
    { key: 'completedCount', label: 'Completed', type: 'count' },
    { key: 'missedCount', label: 'Missed', type: 'count' },
  ],
  CALL: [
    { key: 'callCount', label: 'Call Count', type: 'count' },
    { key: 'totalDuration', label: 'Total Duration', type: 'sum', field: 'durationSeconds' },
    { key: 'avgDuration', label: 'Avg Duration', type: 'avg', field: 'durationSeconds' },
  ],
  MEETING: [
    { key: 'meetingCount', label: 'Meeting Count', type: 'count' },
  ],
  ACTIVITY: [
    { key: 'activityCount', label: 'Activity Count', type: 'count' },
  ],
  SEQUENCE_EMAIL_LOG: [
    { key: 'sentCount', label: 'Emails Sent', type: 'count' },
    { key: 'openCount', label: 'Opens', type: 'count' },
    { key: 'replyCount', label: 'Replies', type: 'count' },
    { key: 'bounceCount', label: 'Bounces', type: 'count' },
  ],
};

export const ENTITY_DIMENSIONS: Record<string, DimensionDef[]> = {
  LEAD: [
    { key: 'source', label: 'Source', type: 'field', field: 'source' },
    { key: 'status', label: 'Status', type: 'field', field: 'status' },
    { key: 'priority', label: 'Priority', type: 'field', field: 'priority' },
    { key: 'owner', label: 'Owner', type: 'field', field: 'ownerId' },
    { key: 'createdAt', label: 'Created Date', type: 'date', field: 'createdAt', dateGroupBy: 'day' },
    { key: 'createdAt_week', label: 'Created Week', type: 'date', field: 'createdAt', dateGroupBy: 'week' },
    { key: 'createdAt_month', label: 'Created Month', type: 'date', field: 'createdAt', dateGroupBy: 'month' },
  ],
  CONTACT: [
    { key: 'company', label: 'Company', type: 'field', field: 'company' },
    { key: 'department', label: 'Department', type: 'field', field: 'department' },
    { key: 'seniority', label: 'Seniority', type: 'field', field: 'seniority' },
    { key: 'createdAt', label: 'Created Date', type: 'date', field: 'createdAt', dateGroupBy: 'day' },
  ],
  COMPANY: [
    { key: 'industry', label: 'Industry', type: 'field', field: 'industry' },
    { key: 'country', label: 'Country', type: 'field', field: 'country' },
    { key: 'employeeRange', label: 'Size', type: 'field', field: 'employeeRange' },
  ],
  CALL: [
    { key: 'direction', label: 'Direction', type: 'field', field: 'direction' },
    { key: 'disposition', label: 'Disposition', type: 'field', field: 'disposition' },
    { key: 'createdAt', label: 'Date', type: 'date', field: 'createdAt', dateGroupBy: 'day' },
  ],
};

/* ── Date filter helpers ──────────────────────────────────────── */

export function parseDateRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const toD = to ? new Date(to) : now;
  const fromD = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: fromD, to: toD };
}

function dateTruncExpr(field: string, groupBy: string): string {
  // SQLite: date(createdAt, 'start of day'|'weekday 0'|'start of month')
  switch (groupBy) {
    case 'day': return `date(${field})`;
    case 'week': return `date(${field}, '-${new Date().getDay()} days', 'weekday 0')`;
    case 'month': return `date(${field}, 'start of month')`;
    case 'quarter': {
      // Approximate quarter grouping for SQLite
      return `strftime('%Y-Q', ${field}) || ((CAST(strftime('%m', ${field}) AS INTEGER) - 1) / 3 + 1)`;
    }
    case 'year': return `strftime('%Y', ${field})`;
    default: return `date(${field})`;
  }
}

/* ── Execute a custom report ──────────────────────────────────── */

export interface ReportConfig {
  entity: string;
  metrics: string[]; // metric keys
  dimensions: string[]; // dimension keys
  filters?: Record<string, string>;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface ReportResult {
  config: ReportConfig;
  groups: Array<Record<string, unknown>>;
  totals: Record<string, number>;
  generatedAt: string;
}

// Map entity → Prisma model (for raw queries since we need aggregation)
const ENTITY_TABLE: Record<string, string> = {
  LEAD: 'Lead',
  CONTACT: 'Contact',
  COMPANY: 'Company',
  DEAL: 'Lead', // deals are leads
  TASK: 'Task',
  CALL: 'Call',
  MEETING: 'Meeting',
  ACTIVITY: 'Activity',
  SEQUENCE_EMAIL_LOG: 'SequenceEmailLog',
};

const ENTITY_STATUS_FILTER: Record<string, string> = {
  DEAL: 'status',
};

export async function executeReport(orgId: string, config: ReportConfig): Promise<ReportResult> {
  const table = ENTITY_TABLE[config.entity];
  if (!table) throw Object.assign(new Error(`Unknown entity: ${config.entity}`), { status: 400 });

  const metrics = (config.metrics || []).map((k) => {
    const defs = ENTITY_METRICS[config.entity] || [];
    return defs.find((d) => d.key === k);
  }).filter(Boolean) as MetricDef[];

  const dimensions = (config.dimensions || []).map((k) => {
    const defs = ENTITY_DIMENSIONS[config.entity] || [];
    return defs.find((d) => d.key === k);
  }).filter(Boolean) as DimensionDef[];

  if (metrics.length === 0 && dimensions.length === 0) {
    throw Object.assign(new Error('Select at least one metric or dimension.'), { status: 400 });
  }

  const { from, to } = parseDateRange(config.dateFrom, config.dateTo);

  // Build raw SQL query for SQLite
  const selectClauses: string[] = [];
  const groupByClauses: string[] = [];
  const whereClauses: string[] = [`orgId = '${orgId}'`];

  // Date filter on createdAt (most entities have this)
  whereClauses.push(`createdAt >= '${from.toISOString()}'`);
  whereClauses.push(`createdAt <= '${to.toISOString()}'`);

  // Soft delete for leads
  if (config.entity === 'LEAD' || config.entity === 'DEAL') {
    whereClauses.push(`deletedAt IS NULL`);
  }

  // Extra filters
  if (config.filters) {
    for (const [key, value] of Object.entries(config.filters)) {
      if (!value) continue;
      if (key === 'status' && ENTITY_STATUS_FILTER[config.entity]) {
        whereClauses.push(`${ENTITY_STATUS_FILTER[config.entity]} = '${value}'`);
      } else {
        whereClauses.push(`${key} = '${value.replace(/'/g, "''")}'`);
      }
    }
  }

  // Dimensions → GROUP BY
  for (const dim of dimensions) {
    if (dim.type === 'date' && dim.field && dim.dateGroupBy) {
      const expr = dateTruncExpr(dim.field, dim.dateGroupBy);
      selectClauses.push(`${expr} as "${dim.key}"`);
      groupByClauses.push(expr);
    } else if (dim.type === 'field' && dim.field) {
      selectClauses.push(`${dim.field} as "${dim.key}"`);
      groupByClauses.push(dim.field);
    }
  }

  // Metrics → SELECT aggregates
  for (const m of metrics) {
    switch (m.type) {
      case 'count':
        if (m.key === 'wonCount') selectClauses.push(`SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END) as "wonCount"`);
        else if (m.key === 'lostCount') selectClauses.push(`SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) as "lostCount"`);
        else if (m.key === 'completedCount') selectClauses.push(`SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as "completedCount"`);
        else if (m.key === 'missedCount') selectClauses.push(`SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) as "missedCount"`);
        else selectClauses.push(`COUNT(*) as "${m.key}"`);
        break;
      case 'sum':
        selectClauses.push(`SUM(COALESCE(${m.field}, 0)) as "${m.key}"`);
        break;
      case 'avg':
        selectClauses.push(`ROUND(AVG(COALESCE(${m.field}, 0)), 2) as "${m.key}"`);
        break;
      case 'min':
        selectClauses.push(`MIN(${m.field}) as "${m.key}"`);
        break;
      case 'max':
        selectClauses.push(`MAX(${m.field}) as "${m.key}"`);
        break;
    }
  }

  if (selectClauses.length === 0) {
    selectClauses.push('COUNT(*) as "count"');
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const groupStr = groupByClauses.length > 0 ? `GROUP BY ${groupByClauses.join(', ')}` : '';
  const limitStr = `LIMIT ${Math.min(config.limit || 100, 500)}`;

  const sql = `SELECT ${selectClauses.join(', ')} FROM ${table} ${whereStr} ${groupStr} ${limitStr}`;

  let groups: Array<Record<string, unknown>> = [];
  try {
    groups = await prisma.$queryRawUnsafe(sql) as Array<Record<string, unknown>>;
  } catch {
    // If query fails, return empty
    groups = [];
  }

  // Compute totals
  const totals: Record<string, number> = {};
  for (const m of metrics) {
    let sum = 0;
    for (const g of groups) {
      sum += Number(g[m.key]) || 0;
    }
    totals[m.key] = sum;
  }

  return {
    config,
    groups: groups.map((g) => {
      // Convert BigInt to number for JSON serialization
      const row: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(g)) {
        row[k] = typeof v === 'bigint' ? Number(v) : v;
      }
      return row;
    }),
    totals,
    generatedAt: new Date().toISOString(),
  };
}

/* ── Report definitions (saved reports) ───────────────────────── */

export interface SavedReportInput {
  name: string;
  description?: string;
  entityType: string;
  metrics: string[];
  dimensions: string[];
  filters?: Record<string, string>;
  chartType?: string;
  dateRange?: string;
  dateField?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function createSavedReport(orgId: string, userId: string, input: SavedReportInput) {
  return prisma.savedReport.create({
    data: {
      orgId,
      name: input.name,
      description: input.description || null,
      entityType: input.entityType,
      metrics: input.metrics as any,
      dimensions: input.dimensions as any,
      filters: (input.filters || {}) as any,
      chartType: input.chartType || 'TABLE',
      dateRange: input.dateRange || null,
      dateField: input.dateField || null,
      createdBy: userId,
    },
  });
}

export async function getSavedReports(orgId: string) {
  return prisma.savedReport.findMany({
    where: { orgId },
    orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function updateSavedReport(orgId: string, id: string, data: Partial<SavedReportInput>) {
  return prisma.savedReport.update({
    where: { id },
    data: {
      name: data.name || undefined,
      description: data.description ?? undefined,
      entityType: data.entityType || undefined,
      metrics: data.metrics as any || undefined,
      dimensions: data.dimensions as any || undefined,
      filters: (data.filters || undefined) as any,
      chartType: data.chartType || undefined,
      dateRange: data.dateRange ?? undefined,
      dateField: data.dateField ?? undefined,
    },
  });
}

export async function deleteSavedReport(orgId: string, id: string) {
  return prisma.savedReport.delete({ where: { id } });
}
