// ═══════════════════════════════════════════════════════════════════════
// PRIMELEAD AI — Prometheus Metrics Collector
// Exposes /metrics endpoint for Prometheus scraping
// ═══════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from 'express';

// ── Metric Storage (in-memory, no external deps) ────────────────────

interface MetricPoint {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels?: Record<string, string>;
  buckets?: Record<string, number>;
}

class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private labels = new Map<string, Record<string, string>>();

  incrementCounter(name: string, labels?: Record<string, string>, value = 1) {
    const key = this.keyWithLabels(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
    if (labels) this.labels.set(key, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const key = this.keyWithLabels(name, labels);
    this.gauges.set(key, value);
    if (labels) this.labels.set(key, labels);
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>) {
    const key = this.keyWithLabels(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    if (labels) this.labels.set(key, labels);
  }

  private keyWithLabels(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return `${name}{${sorted.map(([k, v]) => `${k}="${v}"`).join(',')}}`;
  }

  toPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      const meta = this.parseKey(key);
      lines.push(`# HELP ${meta.name} Counter`);
      lines.push(`# TYPE ${meta.name} counter`);
      lines.push(`${key} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const meta = this.parseKey(key);
      lines.push(`# HELP ${meta.name} Gauge`);
      lines.push(`# TYPE ${meta.name} gauge`);
      lines.push(`${key} ${value}`);
    }

    // Histograms
    const histogramBuckets = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    for (const [key, values] of this.histograms) {
      const meta = this.parseKey(key);
      lines.push(`# HELP ${meta.name} Histogram`);
      lines.push(`# TYPE ${meta.name} histogram`);

      const sorted = values.sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const count = sorted.length;

      for (const bucket of histogramBuckets) {
        const le = sorted.filter(v => v <= bucket).length;
        const bucketKey = meta.labels
          ? `${meta.name}_bucket{${meta.labels},le="${bucket}"}`
          : `${meta.name}_bucket{le="${bucket}"}`;
        lines.push(`${bucketKey} ${le}`);
      }

      const infKey = meta.labels
        ? `${meta.name}_bucket{${meta.labels},le="+Inf"}`
        : `${meta.name}_bucket{le="+Inf"}`;
      lines.push(`${infKey} ${count}`);
      lines.push(`${key}_sum ${sum}`);
      lines.push(`${key}_count ${count}`);
    }

    return lines.join('\n') + '\n';
  }

  private parseKey(key: string): { name: string; labels?: string } {
    const braceIdx = key.indexOf('{');
    if (braceIdx === -1) return { name: key };
    return {
      name: key.slice(0, braceIdx),
      labels: key.slice(braceIdx + 1, -1),
    };
  }

  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labels.clear();
  }
}

// ── Singleton ────────────────────────────────────────────────────────

export const metrics = new MetricsCollector();

// ── Middleware ───────────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method;
    const path = req.route?.path || req.path;
    const status = res.statusCode;
    const statusClass = `${Math.floor(status / 100)}xx`;

    // Request counter
    metrics.incrementCounter('primelead_http_requests_total', {
      method,
      path: normalizePath(path),
      status: statusClass,
    });

    // Response time histogram
    metrics.observeHistogram('primelead_http_request_duration_ms', duration, {
      method,
      path: normalizePath(path),
    });

    // Error counter
    if (status >= 400) {
      metrics.incrementCounter('primelead_http_errors_total', {
        method,
        path: normalizePath(path),
        status: statusClass,
      });
    }
  });

  next();
}

// Normalize dynamic path segments to avoid high cardinality
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{24}/g, '/:id')      // MongoDB-style IDs
    .replace(/\/\d+/g, '/:id')                 // Numeric IDs
    .replace(/\/[a-f0-9-]{36}/g, '/:id')       // UUIDs
    .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:slug'); // Long slugs
}

// ── Business Metrics (periodic updater) ─────────────────────────────

let prismaClient: any = null;

export function setPrismaForMetrics(client: any) {
  prismaClient = client;
}

export async function collectBusinessMetrics() {
  if (!prismaClient) return;

  try {
    const [leadCount, userCount, orgCount, invoiceCount, pendingFollowUps] =
      await Promise.all([
        prismaClient.lead.count().catch(() => 0),
        prismaClient.user.count().catch(() => 0),
        prismaClient.organization.count().catch(() => 0),
        prismaClient.invoice.count().catch(() => 0),
        prismaClient.task.count({ where: { status: 'PENDING' } }).catch(() => 0),
      ]);

    metrics.setGauge('primelead_leads_total', leadCount);
    metrics.setGauge('primelead_users_total', userCount);
    metrics.setGauge('primelead_organizations_total', orgCount);
    metrics.setGauge('primelead_invoices_total', invoiceCount);
    metrics.setGauge('primelead_pending_followups', pendingFollowUps);
  } catch {
    // Metrics collection should never crash the server
  }
}

// ── Router ───────────────────────────────────────────────────────────

export const metricsRouter = Router();

metricsRouter.get('/metrics', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics.toPrometheus());
});

// Start periodic business metrics collection (every 30s)
let metricsInterval: ReturnType<typeof setInterval> | null = null;

export function startMetricsCollection() {
  if (metricsInterval) return;
  metricsInterval = setInterval(collectBusinessMetrics, 30_000);
  // Run immediately
  collectBusinessMetrics();
}

export function stopMetricsCollection() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}
