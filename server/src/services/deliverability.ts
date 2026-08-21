import { prisma } from '../lib/prisma';

export interface DeliverabilityReport {
  period: { from: string; to: string };
  totals: {
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    replied: number;
    unsubscribed: number;
    spamComplaints: number;
  };
  rates: {
    deliveryRate: number;
    bounceRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    unsubscribeRate: number;
    spamRate: number;
  };
  healthScore: number;
  reputationScore: number;
  domainBreakdown: {
    domain: string;
    sent: number;
    delivered: number;
    bounced: number;
    healthScore: number;
  }[];
  recommendations: string[];
}

/**
 * Generate a deliverability report for the given date range.
 */
export async function generateDeliverabilityReport(orgId: string, from: Date, to: Date): Promise<DeliverabilityReport> {
  const metrics = await (prisma as any).deliverabilityMetric.findMany({
    where: {
      orgId,
      date: { gte: from, lte: to },
    },
    orderBy: { date: 'asc' },
  });

  // Aggregate totals
  let sent = 0, delivered = 0, bounced = 0, opened = 0, clicked = 0, replied = 0, unsubscribed = 0, spamComplaints = 0;
  const domainMap = new Map<string, { sent: number; delivered: number; bounced: number; scores: number[] }>();

  for (const m of metrics) {
    sent += m.sent;
    delivered += m.delivered;
    bounced += m.bounced;
    opened += m.opened;
    clicked += m.clicked;
    replied += m.replied;
    unsubscribed += m.unsubscribed;
    spamComplaints += m.spamComplaints;

    if (m.domain) {
      const existing = domainMap.get(m.domain) || { sent: 0, delivered: 0, bounced: 0, scores: [] };
      existing.sent += m.sent;
      existing.delivered += m.delivered;
      existing.bounced += m.bounced;
      existing.scores.push(m.deliverabilityScore);
      domainMap.set(m.domain, existing);
    }
  }

  const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 100;
  const bounceRate = sent > 0 ? Math.round((bounced / sent) * 100) : 0;
  const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
  const clickRate = delivered > 0 ? Math.round((clicked / delivered) * 100) : 0;
  const replyRate = delivered > 0 ? Math.round((replied / delivered) * 100) : 0;
  const unsubscribeRate = delivered > 0 ? Math.round((unsubscribed / delivered) * 100) : 0;
  const spamRate = sent > 0 ? Math.round((spamComplaints / sent) * 10000) / 100 : 0; // percentage with 2 decimals

  // Health score (0-100)
  let healthScore = 100;
  if (bounceRate > 5) healthScore -= (bounceRate - 5) * 5;
  if (spamRate > 0.1) healthScore -= (spamRate - 0.1) * 100;
  if (openRate < 20) healthScore -= (20 - openRate);
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  // Reputation score
  let reputationScore = 100;
  if (bounceRate > 3) reputationScore -= (bounceRate - 3) * 10;
  if (spamRate > 0.05) reputationScore -= (spamRate - 0.05) * 200;
  reputationScore = Math.max(0, Math.min(100, Math.round(reputationScore)));

  // Domain breakdown
  const domainBreakdown = Array.from(domainMap.entries()).map(([domain, d]) => ({
    domain,
    sent: d.sent,
    delivered: d.delivered,
    bounced: d.bounced,
    healthScore: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 100,
  }));

  // Recommendations
  const recommendations: string[] = [];
  if (bounceRate > 3) recommendations.push('Bounce rate is above 3%. Clean your email list and remove invalid addresses.');
  if (spamRate > 0.1) recommendations.push('Spam complaint rate is high. Review your email content and sending practices.');
  if (openRate < 20) recommendations.push('Open rate is below 20%. Test different subject lines and send times.');
  if (unsubscribeRate > 1) recommendations.push('Unsubscribe rate is above 1%. Review email relevance and frequency.');
  if (sent === 0) recommendations.push('No emails sent in this period. Start a sequence to build engagement data.');
  if (recommendations.length === 0) recommendations.push('Your email health looks good! Keep up the good work.');

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    totals: { sent, delivered, bounced, opened, clicked, replied, unsubscribed, spamComplaints },
    rates: { deliveryRate, bounceRate, openRate, clickRate, replyRate, unsubscribeRate, spamRate },
    healthScore,
    reputationScore,
    domainBreakdown,
    recommendations,
  };
}

/**
 * Record daily deliverability metrics (called by background jobs).
 */
export async function recordDailyMetrics(orgId: string, domain: string, metrics: {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  spamComplaints: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate scores
  const deliveryRate = metrics.sent > 0 ? (metrics.delivered / metrics.sent) * 100 : 100;
  const bounceRate = metrics.sent > 0 ? (metrics.bounced / metrics.sent) * 100 : 0;
  const deliverabilityScore = Math.max(0, Math.min(100, Math.round(deliveryRate - bounceRate)));
  const reputationScore = Math.max(0, Math.min(100, Math.round(100 - bounceRate * 10)));

  return (prisma as any).deliverabilityMetric.upsert({
    where: { orgId_date_domain: { orgId, date: today, domain } },
    update: {
      sent: { increment: metrics.sent },
      delivered: { increment: metrics.delivered },
      bounced: { increment: metrics.bounced },
      opened: { increment: metrics.opened },
      clicked: { increment: metrics.clicked },
      replied: { increment: metrics.replied },
      unsubscribed: { increment: metrics.unsubscribed },
      spamComplaints: { increment: metrics.spamComplaints },
      deliverabilityScore,
      reputationScore,
    },
    create: {
      orgId,
      date: today,
      domain,
      ...metrics,
      deliverabilityScore,
      reputationScore,
    },
  });
}
