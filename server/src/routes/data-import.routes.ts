/**
 * Phase 15 — Data import routes.
 *
 * Flow: upload CSV → get headers + auto-detect mapping → user adjusts → preview → dry-run → execute.
 */
import { Router } from 'express';
import multer from 'multer';
import {
  ENTITY_FIELDS,
  autoDetectMapping,
  parseCsvBuffer,
  validateRows,
  executeImport,
} from '../services/data-import';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.tsv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV/TSV files are supported'));
    }
  },
});

/**
 * GET /api/import/fields/:entity
 * Returns available fields for an entity type.
 */
router.get('/fields/:entity', (req, res) => {
  const entity = req.params.entity.toUpperCase();
  const fields = ENTITY_FIELDS[entity];
  if (!fields) {
    return res.status(400).json({ error: `Unknown entity: ${entity}. Use LEAD, CONTACT, or COMPANY.` });
  }
  res.json({ entity, fields });
});

/**
 * POST /api/import/parse
 * Upload CSV and get headers + auto-detected mapping.
 * Body: multipart/form-data with file
 * Query: entity=LEAD|CONTACT|COMPANY
 */
router.post('/parse', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const entity = (req.query.entity as string)?.toUpperCase() || 'LEAD';
    if (!ENTITY_FIELDS[entity]) {
      return res.status(400).json({ error: `Unknown entity: ${entity}` });
    }

    const { headers, rows, totalRows } = parseCsvBuffer(req.file.buffer);
    const autoMapping = autoDetectMapping(entity, headers);

    res.json({
      fileName: req.file.originalname,
      totalRows,
      headers,
      autoMapping,
      entity,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to parse CSV' });
  }
});

/**
 * POST /api/import/validate
 * Validate rows against a mapping.
 */
router.post('/validate', (req, res) => {
  try {
    const { entity, csvData, mapping } = req.body;
    if (!entity || !csvData || !mapping) {
      return res.status(400).json({ error: 'entity, csvData, and mapping are required' });
    }
    const validEntity = entity.toUpperCase();
    if (!ENTITY_FIELDS[validEntity]) {
      return res.status(400).json({ error: `Unknown entity: ${validEntity}` });
    }

    const validation = validateRows(validEntity, csvData, mapping);
    res.json(validation);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Validation failed' });
  }
});

/**
 * POST /api/import/execute
 * Execute the import (or dry-run).
 * Body: { entity, csvData, mapping, dryRun }
 */
router.post('/execute', async (req, res) => {
  try {
    const { entity, csvData, mapping, dryRun } = req.body;
    const orgId = (req as any).orgId;
    const userId = (req as any).userId;

    if (!entity || !csvData || !mapping) {
      return res.status(400).json({ error: 'entity, csvData, and mapping are required' });
    }
    const validEntity = entity.toUpperCase();
    if (!ENTITY_FIELDS[validEntity]) {
      return res.status(400).json({ error: `Unknown entity: ${validEntity}` });
    }

    const result = await executeImport(orgId, userId, validEntity, csvData, mapping, !!dryRun);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Import failed' });
  }
});

export default router;
