import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { contactSchema } from '../validators/schemas';
import { LEAD_SOURCES, BUSINESS_TYPES } from '../constants';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'leadflow-api', time: new Date().toISOString() });
});

router.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const input = validate(contactSchema, req.body);
    // In production this writes to a support inbox; in dev we log it.
    // eslint-disable-next-line no-console
    console.log('[contact]', JSON.stringify(input));
    return ok(res, { received: true, message: 'Thanks! We will get back to you within one business day.' });
  })
);

router.get(
  '/lead-sources',
  requireAuth,
  asyncHandler(async (_req, res) => {
    return ok(res, { sources: LEAD_SOURCES, businessTypes: BUSINESS_TYPES });
  })
);

export default router;
