/**
 * Search — advanced search with 50+ filters and natural language support.
 *  - POST   /              execute a structured search
 *  - POST   /natural-language   convert natural language to filters
 *  - GET    /filters/:entityType   get available filters for an entity type
 *  - GET    /filter-options/:entityType/:fieldName   get unique values for a field
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { executeSearch, ALL_FILTERS, type SearchFilter } from '../services/search';
import { config } from '../config';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

// ── Structured search ────────────────────────────────────────
router.post(
  '/',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(searchQuerySchema, req.body);

    const result = await executeSearch(
      {
        entityType: input.entityType,
        filters: input.filters || [],
        search: input.search,
        sort: input.sort,
        page: input.page || 1,
        pageSize: Math.min(input.pageSize || 25, 100),
      },
      user.orgId,
    );

    return ok(res, result);
  })
);

// ── Natural language search ──────────────────────────────────
router.post(
  '/natural-language',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(nlSearchSchema, req.body);

    // If no AI key configured, return a helpful message
    if (!config.ai.apiKey) {
      return ok(res, {
        filters: [],
        explanation: 'AI search is not configured. Please add an AI API key in Settings → AI.',
        search: input.query,
      });
    }

    // Use AI to convert natural language to structured filters
    const entityType = input.entityType || 'companies';
    const filterDefs = ALL_FILTERS[entityType];
    const filterNames = Object.keys(filterDefs);

    const prompt = `You are a search filter generator. Convert the user's natural language query into structured search filters.

Available entity type: ${entityType}
Available filters: ${filterNames.join(', ')}

User query: "${input.query}"

Return a JSON object with:
{
  "filters": [{ "field": "...", "operator": "eq|in|contains|gt|gte|lt|lte|between|exists", "value": ... }],
  "search": "optional free text search term",
  "explanation": "brief explanation of what you interpreted"
}

Rules:
- Only use filters from the available list
- For "between" operator, value must be [min, max]
- For "in" operator, value must be an array
- For string fields, prefer "contains" or "eq"
- For number fields, prefer "gt", "gte", "lt", "lte", or "between"
- Never fabricate data or make assumptions not supported by the query
- If the query is ambiguous, return empty filters and explain why
- Return ONLY the JSON object, no markdown`;

    try {
      const aiResponse = await callAI(prompt, config.ai);
      const parsed = parseAIResponse(aiResponse);

      return ok(res, {
        filters: parsed.filters || [],
        search: parsed.search || input.query,
        explanation: parsed.explanation || 'Filters generated from natural language query.',
        entityType,
      });
    } catch (err) {
      return ok(res, {
        filters: [],
        search: input.query,
        explanation: 'Could not parse the query into filters. Please try a more specific query or use the filter panel directly.',
        entityType,
      });
    }
  })
);

// ── Available filters for an entity type ─────────────────────
router.get(
  '/filters/:entityType',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const { entityType } = req.params;
    if (!['companies', 'contacts', 'leads'].includes(entityType)) {
      throw badRequest('Invalid entity type. Use companies, contacts, or leads.');
    }

    const filters = ALL_FILTERS[entityType];
    const schema = Object.entries(filters).map(([name, def]) => ({
      name,
      dbField: def.dbField,
      type: def.type,
    }));

    return ok(res, { entityType, filters: schema });
  })
);

// ── Filter options (unique values) ───────────────────────────
router.get(
  '/filter-options/:entityType/:fieldName',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { entityType, fieldName } = req.params;

    if (!['companies', 'contacts', 'leads'].includes(entityType)) {
      throw badRequest('Invalid entity type.');
    }

    const filters = ALL_FILTERS[entityType];
    if (!filters[fieldName]) {
      throw badRequest(`Unknown filter field: ${fieldName}`);
    }

    const modelMap = {
      companies: prisma.company,
      contacts: prisma.companyContact,
      leads: prisma.lead,
    } as const;

    const model = modelMap[entityType as keyof typeof modelMap];
    const dbField = filters[fieldName].dbField;

    // For cross-table fields, skip for now
    if (dbField.includes('.')) {
      return ok(res, { options: [] });
    }

    const results = await (model as any).groupBy({
      by: [dbField] as any,
      where: { orgId: user.orgId, deletedAt: null, [dbField]: { not: null } } as any,
      _count: true,
      orderBy: { _count: { [dbField]: 'desc' } as any },
      take: 50,
    });

    const options = results
      .map((r: any) => r[dbField])
      .filter((v: unknown) => v !== null && v !== undefined)
      .map(String);

    return ok(res, { options });
  })
);

// ── AI helper functions ──────────────────────────────────────

async function callAI(prompt: string, aiConfig: { apiKey: string; baseUrl: string; model: string; provider: string }): Promise<string> {
  const baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1';
  const model = aiConfig.model || 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

function parseAIResponse(response: string): { filters?: SearchFilter[]; search?: string; explanation?: string } {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { explanation: 'Could not parse AI response.' };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      search: parsed.search || undefined,
      explanation: parsed.explanation || undefined,
    };
  } catch {
    return { explanation: 'Could not parse AI response as JSON.' };
  }
}

// ── Schemas ──────────────────────────────────────────────────

const searchQuerySchema = z.object({
  entityType: z.enum(['companies', 'contacts', 'leads']),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'neq', 'in', 'nin', 'contains', 'gt', 'gte', 'lt', 'lte', 'between', 'exists', 'not_exists']),
    value: z.unknown(),
  })).optional(),
  search: z.string().max(200).optional(),
  sort: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const nlSearchSchema = z.object({
  query: z.string().trim().min(3, 'Query must be at least 3 characters').max(500),
  entityType: z.enum(['companies', 'contacts', 'leads']).optional(),
});

export default router;
