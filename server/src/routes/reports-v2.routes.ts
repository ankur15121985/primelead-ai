/**
 * Phase 16 — Custom report builder routes.
 *
 * Users can build reports by selecting entity, metrics, dimensions, filters.
 * Reports can be saved, shared, and exported.
 */
import { Router } from 'express';
import {
  ENTITY_METRICS,
  ENTITY_DIMENSIONS,
  executeReport,
  createSavedReport,
  getSavedReports,
  updateSavedReport,
  deleteSavedReport,
} from '../services/reports-v2';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/reports/metadata
 * Returns available metrics and dimensions per entity.
 */
router.get('/metadata', (_req, res) => {
  const entities = Object.keys(ENTITY_METRICS);
  const metadata: Record<string, { metrics: typeof ENTITY_METRICS[string]; dimensions: typeof ENTITY_DIMENSIONS[string] }> = {};
  for (const entity of entities) {
    metadata[entity] = {
      metrics: ENTITY_METRICS[entity] || [],
      dimensions: ENTITY_DIMENSIONS[entity] || [],
    };
  }
  res.json({ entities, metadata });
});

/**
 * POST /api/reports/execute
 * Execute a custom report.
 */
router.post('/execute', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const config = req.body;
    if (!config.entity) {
      return res.status(400).json({ error: 'entity is required' });
    }
    const result = await executeReport(orgId, config);
    res.json(result);
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Report execution failed' });
  }
});

/**
 * GET /api/reports/saved
 * List all saved reports for the organization.
 */
router.get('/saved', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const reports = await getSavedReports(orgId);
    res.json({ reports });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list reports' });
  }
});

/**
 * POST /api/reports/saved
 * Create a saved report.
 */
router.post('/saved', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const userId = (req as any).userId;
    const input = req.body;
    if (!input.name || !input.entityType) {
      return res.status(400).json({ error: 'name and entityType are required' });
    }
    const report = await createSavedReport(orgId, userId, input);
    res.status(201).json(report);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'A report with this name already exists' });
    }
    res.status(500).json({ error: err?.message || 'Failed to create report' });
  }
});

/**
 * PATCH /api/reports/saved/:id
 * Update a saved report.
 */
router.patch('/saved/:id', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const report = await updateSavedReport(orgId, req.params.id, req.body);
    res.json(report);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.status(500).json({ error: err?.message || 'Failed to update report' });
  }
});

/**
 * DELETE /api/reports/saved/:id
 * Delete a saved report.
 */
router.delete('/saved/:id', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    await deleteSavedReport(orgId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.status(500).json({ error: err?.message || 'Failed to delete report' });
  }
});

/**
 * GET /api/reports/saved/:id/run
 * Run a saved report.
 */
router.get('/saved/:id/run', async (req, res) => {
  try {
    const orgId = (req as any).orgId;
    const report = await prisma.savedReport.findFirst({ where: { id: req.params.id, orgId } });
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    // Increment view count
    await prisma.savedReport.update({
      where: { id: report.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });

    const config = {
      entity: report.entityType,
      metrics: (report.metrics as string[]) || [],
      dimensions: (report.dimensions as string[]) || [],
      filters: (report.filters as Record<string, string>) || {},
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const result = await executeReport(orgId, config);
    res.json(result);
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to run report' });
  }
});

export default router;
