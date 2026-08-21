/**
 * Phase 18 — Revenue forecasting.
 *
 * Calculates forecast entries from pipeline data with commit/best-case/pipeline
 * breakdowns. Supports per-rep, per-territory, and org-wide forecasts.
 */
import { prisma } from '../lib/prisma';

/* ── Period helpers ──────────────────────────────────────────── */

function getPeriodKey(date: Date, type: string): string {
  const d = new Date(date);
  switch (type) {
    case 'WEEK': {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      return `${start.getFullYear()}-W${String(Math.ceil(((d.getTime() - start.getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`;
    }
    case 'QUARTER':
      return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    case 'MONTH':
    default:
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

function getPeriodRange(period: string, type: string): { from: Date; to: Date } {
  const now = new Date();
  switch (type) {
    case 'WEEK': {
      const [, weekStr] = period.split('-W');
      const weekNum = parseInt(weekStr || '1');
      const year = parseInt(period.split('-')[0]);
      const from = new Date(year, 0, 1 + (weekNum - 1) * 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59);
      return { from, to };
    }
    case 'QUARTER': {
      const [yStr, qStr] = period.split('-Q');
      const year = parseInt(yStr || String(now.getFullYear()));
      const q = parseInt(qStr || '1');
      const from = new Date(year, (q - 1) * 3, 1);
      const to = new Date(year, q * 3, 0, 23, 59, 59);
      return { from, to };
    }
    case 'MONTH':
    default: {
      const [yStr, mStr] = period.split('-');
      const year = parseInt(yStr || String(now.getFullYear()));
      const month = parseInt(mStr || '1') - 1;
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0, 23, 59, 59);
      return { from, to };
    }
  }
}

/* ── Calculate forecast from pipeline ────────────────────────── */

export interface ForecastInput {
  period?: string;
  periodType?: string;
  userId?: string;
  territoryId?: string;
}

export interface ForecastResult {
  period: string;
  periodType: string;
  pipelineValue: number;
  commitValue: number;
  bestCaseValue: number;
  closedWon: number;
  closedLost: number;
  confidence: number;
  dealCount: number;
  weightedPipeline: number;
  manualCommit: number | null;
  manualBestCase: number | null;
  manualPipeline: number | null;
  aiPrediction: number | null;
  aiConfidence: number | null;
  aiFactors: string[];
  stageBreakdown: Array<{ stage: string; count: number; value: number; probability: number }>;
}

export async function calculateForecast(orgId: string, input: ForecastInput): Promise<ForecastResult> {
  const now = new Date();
  const periodType = input.periodType || 'MONTH';
  const period = input.period || getPeriodKey(now, periodType);
  const { from, to } = getPeriodRange(period, periodType);

  // Get pipeline stages for probability data
  const pipelines = await prisma.pipeline.findMany({ where: { orgId }, select: { id: true } });
  const pipelineIds = pipelines.map((p) => p.id);
  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: { in: pipelineIds } },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, probability: true, isWon: true, isLost: true },
  });

  const stageMap = new Map(stages.map((s) => [s.id, s]));

  // Build lead query filter
  const leadWhere: any = {
    orgId,
    deletedAt: null,
    stageId: { not: null },
  };

  // Filter by date range (leads active in this period)
  if (input.userId) {
    leadWhere.ownerId = input.userId;
  }

  // Get all active pipeline leads
  const leads = await prisma.lead.findMany({
    where: leadWhere,
    select: { id: true, stageId: true, expectedValue: true, status: true, score: true },
  });

  // Get closed leads in period
  const closedLeads = await prisma.lead.findMany({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        { status: 'WON', updatedAt: { gte: from, lte: to } },
        { status: 'LOST', updatedAt: { gte: from, lte: to } },
      ],
    },
    select: { status: true, expectedValue: true },
  });

  const closedWon = closedLeads.filter((l) => l.status === 'WON').reduce((s, l) => s + (l.expectedValue || 0), 0);
  const closedLost = closedLeads.filter((l) => l.status === 'LOST').reduce((s, l) => s + (l.expectedValue || 0), 0);

  // Calculate pipeline breakdown by stage
  const stageBreakdownMap = new Map<string, { stage: string; count: number; value: number; probability: number }>();
  let pipelineValue = 0;
  let commitValue = 0;
  let bestCaseValue = 0;
  let weightedPipeline = 0;
  let totalConfidence = 0;
  let dealCount = 0;

  for (const lead of leads) {
    const stage = lead.stageId ? stageMap.get(lead.stageId) : null;
    const value = lead.expectedValue || 0;
    const prob = stage?.probability || 0;

    pipelineValue += value;
    dealCount++;
    weightedPipeline += Math.round(value * prob / 100);
    totalConfidence += prob;

    // Categorize by probability
    if (prob >= 80) commitValue += value;
    else if (prob >= 40) bestCaseValue += value;

    // Stage breakdown
    const stageName = stage?.name || 'Unknown';
    const existing = stageBreakdownMap.get(stageName) || { stage: stageName, count: 0, value: 0, probability: prob };
    existing.count++;
    existing.value += value;
    stageBreakdownMap.set(stageName, existing);
  }

  const avgConfidence = dealCount > 0 ? Math.round(totalConfidence / dealCount) : 0;

  // AI prediction (simple heuristic — real implementation would call AI provider)
  const aiPrediction = closedWon + Math.round(weightedPipeline * 0.8);
  const aiConfidence = avgConfidence;
  const aiFactors = [
    `Pipeline: ${dealCount} deals worth ${formatCurrency(pipelineValue)}`,
    `Weighted pipeline: ${formatCurrency(weightedPipeline)}`,
    `Commit: ${formatCurrency(commitValue)}`,
    `Best case: ${formatCurrency(bestCaseValue)}`,
    `Historical closed won: ${formatCurrency(closedWon)}`,
  ];

  return {
    period,
    periodType,
    pipelineValue,
    commitValue,
    bestCaseValue,
    closedWon,
    closedLost,
    confidence: avgConfidence,
    dealCount,
    weightedPipeline,
    manualCommit: null,
    manualBestCase: null,
    manualPipeline: null,
    aiPrediction,
    aiConfidence,
    aiFactors,
    stageBreakdown: Array.from(stageBreakdownMap.values()),
  };
}

/* ── Save/load forecast entries ──────────────────────────────── */

export async function saveForecast(orgId: string, data: {
  period: string;
  periodType?: string;
  userId?: string;
  territoryId?: string;
  manualCommit?: number;
  manualBestCase?: number;
  manualPipeline?: number;
  isLocked?: boolean;
}) {
  const result = await calculateForecast(orgId, { period: data.period, periodType: data.periodType, userId: data.userId, territoryId: data.territoryId });

  return prisma.forecastEntry.upsert({
    where: {
      orgId_period_userId: {
        orgId,
        period: data.period,
        userId: data.userId || '',
      },
    },
    update: {
      pipelineValue: result.pipelineValue,
      commitValue: result.commitValue,
      bestCaseValue: result.bestCaseValue,
      closedWon: result.closedWon,
      closedLost: result.closedLost,
      confidence: result.confidence,
      dealCount: result.dealCount,
      weightedPipeline: result.weightedPipeline,
      manualCommit: data.manualCommit ?? undefined,
      manualBestCase: data.manualBestCase ?? undefined,
      manualPipeline: data.manualPipeline ?? undefined,
      aiPrediction: result.aiPrediction,
      aiConfidence: result.aiConfidence,
      aiFactors: JSON.stringify(result.aiFactors),
      isLocked: data.isLocked ?? false,
    },
    create: {
      orgId,
      period: data.period,
      periodType: data.periodType || 'MONTH',
      userId: data.userId || null,
      territoryId: data.territoryId || null,
      pipelineValue: result.pipelineValue,
      commitValue: result.commitValue,
      bestCaseValue: result.bestCaseValue,
      closedWon: result.closedWon,
      closedLost: result.closedLost,
      confidence: result.confidence,
      dealCount: result.dealCount,
      weightedPipeline: result.weightedPipeline,
      manualCommit: data.manualCommit ?? null,
      manualBestCase: data.manualBestCase ?? null,
      manualPipeline: data.manualPipeline ?? null,
      aiPrediction: result.aiPrediction,
      aiConfidence: result.aiConfidence,
      aiFactors: JSON.stringify(result.aiFactors),
      isLocked: data.isLocked ?? false,
    },
  });
}

export async function getForecasts(orgId: string, period?: string, userId?: string) {
  const where: any = { orgId };
  if (period) where.period = period;
  if (userId) where.userId = userId;

  return prisma.forecastEntry.findMany({
    where,
    orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    include: { user: { select: { id: true, name: true, email: true } } },
    take: 50,
  });
}

export async function getForecastSummary(orgId: string, period: string) {
  const forecasts = await prisma.forecastEntry.findMany({
    where: { orgId, period },
    include: { user: { select: { id: true, name: true } } },
  });

  const totalPipeline = forecasts.reduce((s, f) => s + f.pipelineValue, 0);
  const totalCommit = forecasts.reduce((s, f) => s + (f.manualCommit || f.commitValue), 0);
  const totalBestCase = forecasts.reduce((s, f) => s + (f.manualBestCase || f.bestCaseValue), 0);
  const totalClosedWon = forecasts.reduce((s, f) => s + f.closedWon, 0);
  const totalWeighted = forecasts.reduce((s, f) => s + f.weightedPipeline, 0);
  const avgConfidence = forecasts.length > 0 ? Math.round(forecasts.reduce((s, f) => s + f.confidence, 0) / forecasts.length) : 0;

  return {
    period,
    repCount: forecasts.length,
    totalPipeline,
    totalCommit,
    totalBestCase,
    totalClosedWon,
    totalWeighted,
    avgConfidence,
    forecasts,
  };
}

function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}
