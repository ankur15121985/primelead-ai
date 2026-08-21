/**
 * Report Scheduler — scheduled report generation and export.
 * 
 * Reports can be scheduled to run daily/weekly/monthly and
 * exported as CSV or JSON, then delivered via email or webhook.
 */
import { prisma } from '../lib/prisma';
import { executeReport, type ReportConfig } from './reports-v2';
import { badRequest, notFound } from '../lib/http';

export interface ScheduleReportInput {
  name: string;
  description?: string;
  reportConfig: ReportConfig;
  schedule: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    hour?: number; // 0-23
    timezone?: string;
  };
  recipients?: string[]; // email addresses
  webhookUrl?: string;
  format: 'CSV' | 'JSON';
  enabled?: boolean;
}

export interface ScheduledReport {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  reportConfig: ReportConfig;
  schedule: ScheduleReportInput['schedule'];
  recipients: string[];
  webhookUrl: string | null;
  format: 'CSV' | 'JSON';
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
}

/**
 * Calculate next run time based on schedule
 */
export function calculateNextRun(schedule: ScheduledReport['schedule'], from?: Date): Date {
  const now = from || new Date();
  const next = new Date(now);
  const hour = schedule.hour ?? 9; // default 9 AM
  
  next.setHours(hour, 0, 0, 0);
  
  if (next <= now) {
    // Move to next occurrence
    switch (schedule.frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY': {
        const targetDay = schedule.dayOfWeek ?? 1; // Monday
        const currentDay = next.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
        break;
      }
      case 'MONTHLY': {
        const targetDate = schedule.dayOfMonth ?? 1;
        next.setDate(targetDate);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
      }
    }
  }
  
  return next;
}

/**
 * Create a scheduled report
 */
export async function createScheduledReport(orgId: string, userId: string, input: ScheduleReportInput) {
  const nextRunAt = calculateNextRun(input.schedule);
  
  const report = await (prisma as any).scheduledReport.create({
    data: {
      orgId,
      createdBy: userId,
      name: input.name,
      description: input.description || null,
      reportConfig: input.reportConfig as any,
      schedule: input.schedule as any,
      recipients: (input.recipients || []) as any,
      webhookUrl: input.webhookUrl || null,
      format: input.format || 'CSV',
      enabled: input.enabled ?? true,
      nextRunAt,
    },
  });
  
  return report;
}

/**
 * List scheduled reports for an org
 */
export async function listScheduledReports(orgId: string) {
  return (prisma as any).scheduledReport.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single scheduled report
 */
export async function getScheduledReport(orgId: string, id: string) {
  const report = await (prisma as any).scheduledReport.findFirst({
    where: { id, orgId },
  });
  if (!report) throw notFound('Scheduled report not found');
  return report;
}

/**
 * Update a scheduled report
 */
export async function updateScheduledReport(orgId: string, id: string, data: Partial<ScheduleReportInput>) {
  const existing = await getScheduledReport(orgId, id);
  
  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.reportConfig) updateData.reportConfig = data.reportConfig;
  if (data.schedule) {
    updateData.schedule = data.schedule;
    updateData.nextRunAt = calculateNextRun(data.schedule);
  }
  if (data.recipients) updateData.recipients = data.recipients;
  if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;
  if (data.format) updateData.format = data.format;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  
  return (prisma as any).scheduledReport.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(orgId: string, id: string) {
  await getScheduledReport(orgId, id);
  await (prisma as any).scheduledReport.delete({ where: { id } });
  return { deleted: true };
}

/**
 * Run a scheduled report and generate the export
 */
export async function runScheduledReport(orgId: string, id: string) {
  const report = await getScheduledReport(orgId, id);
  
  // Execute the report
  const result = await executeReport(orgId, report.reportConfig);
  
  // Generate export
  let exportData: string;
  let mimeType: string;
  let filename: string;
  
  if (report.format === 'CSV') {
    exportData = convertToCSV(result.groups);
    mimeType = 'text/csv';
    filename = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  } else {
    exportData = JSON.stringify(result, null, 2);
    mimeType = 'application/json';
    filename = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  }
  
  // Log the run
  await (prisma as any).scheduledReportLog.create({
    data: {
      orgId,
      reportId: id,
      status: 'SUCCESS',
      format: report.format,
      rowCount: result.groups.length,
      filename,
    },
  });
  
  // Update last run time and next run
  const nextRunAt = calculateNextRun(report.schedule);
  await (prisma as any).scheduledReport.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      nextRunAt,
    },
  });
  
  // Send to webhook if configured
  if (report.webhookUrl) {
    try {
      await fetch(report.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'X-Report-Name': report.name,
          'X-Report-Date': new Date().toISOString(),
        },
        body: exportData,
      });
    } catch (err) {
      console.error(`[ReportScheduler] Webhook delivery failed for report ${id}:`, err);
    }
  }
  
  return {
    reportId: id,
    name: report.name,
    format: report.format,
    filename,
    mimeType,
    rowCount: result.groups.length,
    data: exportData,
    recipients: report.recipients,
    webhookDelivered: Boolean(report.webhookUrl),
  };
}

/**
 * Process all due scheduled reports
 */
export async function processDueReports(): Promise<number> {
  const now = new Date();
  
  const dueReports = await (prisma as any).scheduledReport.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: 'asc' },
    take: 10,
  });
  
  let processed = 0;
  for (const report of dueReports) {
    try {
      await runScheduledReport(report.orgId, report.id);
      processed++;
    } catch (err) {
      console.error(`[ReportScheduler] Failed to run report ${report.id}:`, err);
      
      // Log the failure
      await (prisma as any).scheduledReportLog.create({
        data: {
          orgId: report.orgId,
          reportId: report.id,
          status: 'FAILED',
          error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
        },
      });
      
      // Still advance nextRunAt to avoid retry loops
      const nextRunAt = calculateNextRun(report.schedule);
      await (prisma as any).scheduledReport.update({
        where: { id: report.id },
        data: { nextRunAt },
      });
    }
  }
  
  return processed;
}

/**
 * Get run history for a scheduled report
 */
export async function getReportRunHistory(orgId: string, reportId: string, limit = 50) {
  await getScheduledReport(orgId, reportId);
  
  return (prisma as any).scheduledReportLog.findMany({
    where: { reportId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Convert report groups to CSV string
 */
function convertToCSV(groups: Array<Record<string, unknown>>): string {
  if (groups.length === 0) return '';
  
  const headers = Object.keys(groups[0]);
  const rows = groups.map(row => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}
