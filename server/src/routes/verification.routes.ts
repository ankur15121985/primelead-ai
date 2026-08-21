/**
 * Email Verification — single and bulk verification.
 *  - POST   /single     verify a single email
 *  - POST   /bulk       bulk verify emails from contacts or direct list
 *  - POST   /company/:id  verify a company's email domains
 */
import { Router } from 'express';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { verifySingleEmail, bulkVerifyEmails } from '../services/verification';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.post('/single', requirePermission('contacts.enrich'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({ email: z.string().email('Enter a valid email') }), req.body);
  const result = await verifySingleEmail(user.orgId, input.email);
  return ok(res, { result });
}));

router.post('/bulk', requirePermission('contacts.enrich'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({
    entityType: z.enum(['company', 'contact']),
    entityIds: z.array(z.string()).max(500).optional(),
    emails: z.array(z.string().email()).max(500).optional(),
  }), req.body);
  const summary = await bulkVerifyEmails({ orgId: user.orgId, ...input });
  return ok(res, { summary });
}));

export default router;
