# LeadFlow AI — API Reference

Base URL: `http://localhost:4000/api` (dev). The web dev server proxies `/api` to it.

- **Auth:** session cookie `lf_session` (httpOnly, SameSite=Lax). All authenticated routes require it.
- **CSRF:** every **state-changing** request must include the token from the readable `lf_csrf` cookie in the `x-csrf-token` header. The client SPA does this automatically. (Without it you get `403 CSRF`.)
- **Response envelope:** success → `200/201 { "data": ... }` · error → `{ "error": { "code", "message", "details? } }`

Error codes: `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `VALIDATION_ERROR` (422) · `RATE_LIMITED` (429) · `INTERNAL` (500) · `PAYLOAD_TOO_LARGE` (413) · `CSRF` (403).

---

## Auth

### `POST /auth/signup`
Create an organisation + owner account. Sets the session cookie. Sends a verification email (console in dev).

```json
{ "name": "Rohit Sharma", "email": "r@co.com", "password": "StrongPass123", "orgName": "Sharma Co", "businessType": "SERVICES", "phone": "" }
```
→ `201 { data: { user, org } }`

### `POST /auth/login` (rate limited: 5/10min per IP)
`{ "email", "password" }` → `200 { data: { user, org } }`

### `POST /auth/logout` → `200 { data: { loggedOut: true } }`

### `GET /auth/me`
Current user + org + refreshes the CSRF cookie. → `200 { data: { user, org, csrf } }`

### `POST /auth/verify-email`
`{ "token" }` → `200 { data: { verified: true } }`

### `POST /auth/forgot-password`
`{ "email" }` → always `200 { data: { sent: true } }` (no user enumeration).

### `POST /auth/reset-password`
`{ "token", "password" }` (token valid 1 hour, single use) → `200`.

### `POST /auth/onboarding` (authenticated)
`{ "businessType"?, "addSampleData"?: bool, "inviteEmails"?: string[] }` → `200 { data: { onboardingComplete, sampleCount } }`

---

## Leads

### `GET /leads`
Query params: `search` · `status` (or `ALL`) · `source` · `ownerId` · `stageId` · `priority` · `minValue` · `from`/`to` (ISO dates) · `page` (1-based) · `pageSize` (≤100) · `sort` (`createdAt|name|expectedValue|score|nextFollowUpAt|lastContactedAt`) · `dir` (`asc|desc`).

→ `200 { data: { rows, pagination: { page, pageSize, total, pages }, counts: { new, open, won, overdue } } }`

Salesperson role sees only own leads; managers see all.

### `POST /leads`
```json
{ "name": "Ramesh Kumar", "phone": "9811111111", "email": "", "company": "", "source": "WEBSITE",
  "priority": "HIGH", "expectedValue": 100000, "notes": "", "tags": ["hot"], "customFields": {}, "status": "NEW", "stageId": null, "nextFollowUpAt": null }
```
Deduplicates by normalized phone/email (`409 CONFLICT` on duplicates), computes a score, auto-assigns the owner (source rule → least-open → round-robin), logs activity + audit + notification. → `201 { data: { lead } }`

### `GET /leads/:id`
Full detail incl. `activities` (50), `tasks`, `quotations`, `invoices`, `owner`, `stage`. → `200 { data: { lead } }`

### `PATCH /leads/:id`
Any subset of the create fields, plus `ownerId` and `stageId`. Stage/status changes log a `STATUS_CHANGE` activity; owner changes log `ASSIGNMENT` + notify. Score recomputed. → `200 { data: { lead } }`

### `DELETE /leads/:id` (manager+) — soft delete → `200 { data: { deleted: true } }`

### `POST /leads/bulk`
```json
{ "ids": ["..."], "action": "assign|status|tag|delete", "ownerId"?, "status"?, "tag"? }
```
→ `200 { data: { updated } }`

### `POST /leads/import` (multipart, field `file`, CSV ≤5MB)
Header row: `Name,Phone,Email,Company,Expected Value,Notes`. Skips duplicates. → `200 { data: { created, skipped, errors } }`

### `GET /leads/export` → CSV attachment (respects current filters)

### `POST /leads/:id/activity`
```json
{ "type": "CALL|WHATSAPP|EMAIL|NOTE|MEETING", "body": "...", "at": "ISO date (optional)" }
```
Call/WhatsApp/Email/Meeting also update `lastContactedAt`. → `201 { data: { activity } }`

### `POST /leads/:id/tasks`
```json
{ "title": "Call about quotation", "kind": "CALL|WHATSAPP|EMAIL|MEETING|FOLLOW_UP|TASK", "dueAt": "ISO datetime", "notes"?, "userId"? }
```
Creates a follow-up + activity + sets the lead's `nextFollowUpAt`. → `201`

### `POST /leads/tasks/:taskId/complete` → `200`

---

## Pipeline

### `GET /pipeline` → `200 { data: { stages: [{ id, name, order, color, isWon, isLost, leads: [...] }], pipeline } }`
### `POST /pipeline/stages` (manager+) `{ "name", "color"? }` → `201`
### `POST /pipeline/stages/reorder` (manager+) `{ "ids": [...] }` → `200`

---

## Tasks / Follow-ups

### `GET /tasks?view=today|overdue|upcoming|done|missed`
Also syncs overdue tasks (PENDING→MISSED) and raises notifications. → `200 { data: { tasks, counts } }`

### `POST /tasks` `{ "leadId"?, "userId"?, "title", "kind"?, "dueAt", "notes"? }` → `201`
### `PATCH /tasks/:id` `{ "status": "PENDING|DONE|CANCELLED", "title"?, "dueAt"?, "notes"? }` → `200`
### `DELETE /tasks/:id` → `200`
### `POST /tasks/sync` → `200 { data: { missed, notified } }`

---

## Dashboard

### `GET /dashboard`
→ `200 { data: { cards: { totalLeads, newLeads, qualifiedLeads, wonLeads, openLeads, weekLeads, monthLeads, pipelineValue, revenue, conversionRate, overdue, today, upcoming }, charts: { leadsBySource, leadsByOwner, trend (14d), funnel, topSalespeople }, lists: { todaysTasks, overdueTasks, recentLeads, recentActivity } } }`

---

## Quotations (GST)

### `GET /quotations?status=&search=` → `200 { data: { quotations, counts } }`

List quotations. SALES users see only documents linked to leads they own.

### `POST /quotations` → `201 { data: { quotation } }`

```jsonc
{
  "customerName": "Aakash Traders",
  "company": "Aakash Trading Co",       // optional
  "address": "…",                        // optional
  "gstin": "27ABCDE1234F1Z5",            // optional
  "email": "billing@example.com",        // optional
  "phone": "98111 11111",                // optional
  "leadId": "…",                         // optional, org-scoped
  "items": [
    { "description": "Website design", "quantity": 1, "rate": 50000,
      "discountPct": 0, "taxPct": 18, "gstType": "CGST_SGST" | "IGST" }
  ],
  "discount": 0,                          // document-level, clamped to subtotal
  "terms": "Valid 15 days.",
  "validityDays": 15,
  "status": "DRAFT"                       // DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED
}
```

Numbers are auto-generated (`QT-YYYY-0001`). GST (CGST+SGST or IGST) is computed server-side on per-item taxable amounts; document discount is applied after tax and clamped to the subtotal.

### `GET /quotations/:id` → `200 { data: { quotation } }`
### `PATCH /quotations/:id` — update fields / `status`
### `DELETE /quotations/:id` (manager+) → `200 { data: { deleted } }`
### `POST /quotations/:id/convert` → `200 { data: { invoice: { id, number, total } } }`

Creates an invoice copying customer + items; marks the quotation `CONVERTED`. Fails with 400 if already converted.

### `GET /quotations/:id/pdf` → PDF attachment (PDFKit, A4, GST table, totals)

## Invoices

### `GET /invoices?status=&search=` → `200 { data: { invoices, counts: { total, paid, pending, overdue, totalValue } } }`
### `POST /invoices` → `201 { data: { invoice } }`

Same item shape as quotations plus optional `hsnSac` per item, `billingAddress`, `dueDate`, `paidAmount`, and `status` (`DRAFT | SENT | PARTIALLY_PAID | PAID | OVERDUE | CANCELLED`).

### `GET /invoices/:id` → `200 { data: { invoice } }`
### `PATCH /invoices/:id` — update fields / `status`
### `DELETE /invoices/:id` (manager+) → `200 { data: { deleted } }`
### `POST /invoices/:id/payment` `{ "paidAmount": 10000 }` → `200 { data: { invoice } }`

Adds to `paidAmount` (clamped to total) and advances status: → `PARTIALLY_PAID` or `PAID`. Records a `Payment` row + audit. Rejects payments on cancelled invoices.

### `GET /invoices/:id/pdf` → PDF attachment

## AI assistant (conversational)

### `GET /ai/status` → `200 { data: { configured } }`
### `GET /ai/conversations` → `200 { data: { conversations: [{ id, topic, updatedAt, preview }] } }`
### `GET /ai/conversations/:id` → `200 { data: { conversation } }`
### `POST /ai/chat` `{ "message": "…", "conversationId"? }` → `200 { data: { conversationId, reply, notConfigured } }`

The assistant reads live, org-scoped data only (SALES users see their own leads). When no AI key is configured it returns `notConfigured: true` and stores a friendly fallback — it never pretends to work.

## Integrations & webhooks

### `GET /integrations` → `200 { data: { catalog, connections } }`

Catalog: WhatsApp, Facebook, Instagram, Google Ads, IndiaMART, JustDial, TradeIndia, Shopify, Zapier, REST API. `connections` show enabled/status/webhook URL (never the secret).

### `POST /integrations/:source/connect` (manager+) → `200 { data: { integration: { source, webhookUrl, webhookSecret } } }`

Creates/refreshes a unique secret. **The secret is returned exactly once** — store it in the external system.

### `PATCH /integrations/:source` — `{ "enabled"?, "status"?, "name"?, "config"? }` (manager+)
### `DELETE /integrations/:source` (manager+) — disconnect

### `POST /webhooks/:source` (public, rate limited 120/10min per IP)

Headers: `x-webhook-secret: <secret>`. Body: name + optional phone/email/company/campaign/expectedValue/notes/priority/ownerId/customFields.

Pipeline: verify secret (constant-time) → resolve tenant from the secret → validate → dedupe (409 on duplicate) → create lead (auto-assign; a client-supplied `ownerId` is only honoured when it belongs to this org) → activity + notification.

```bash
curl -X POST https://your-app/api/webhooks/whatsapp \
  -H "x-webhook-secret: <secret>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Rahul","phone":"9811111111","email":"rahul@example.com"}'
```

## Reports & analytics

### `GET /reports?from=&to=` → `200 { data: { range, cards, charts } }`

`cards`: leadsCreated, leadsWon/Lost, conversionRate, winRate, openLeads, tasksDone/Missed, quotationsCount/Value, invoicesCount/Value, revenue, activityCount. `charts`: bySource, byOwner, byStatus, byStage, trend (per day). Date range is clamped to 366 days.

### `GET /reports/export?from=&to=` → CSV attachment

## Billing

### `GET /billing` → `200 { data: { org, plans, subscription, currentPlan, payments, gateway } }`
### `POST /billing/upgrade` (admin+) `{ "planSlug": "growth|business|starter", "period": "MONTHLY|YEARLY" }`

Demo mode (no gateway keys): applies instantly, records a `PENDING` Payment. With `RAZORPAY_KEY_ID`/`STRIPE_SECRET_KEY`: prepares the subscription and returns `applied: false, mode: 'provider'`.

### `POST /billing/cancel` (admin+) → `200 { data: { cancelled } }`

## Contacts

### `GET /contacts?search=` → `200 { data: { contacts, total } }`
### `POST /contacts` → `201 { data: { contact } }` — `{ name, phone?, email?, company?, notes?, tags?, leadId? }` (lead must belong to the org)
### `PATCH /contacts/:id` → `200 { data: { contact } }`
### `DELETE /contacts/:id` → `200 { data: { deleted } }`

## Notifications

### `GET /notifications` → `200 { data: { items, unread } }`
### `PATCH /notifications/:id/read` → `200`
### `POST /notifications/read-all` → `200`

---

## Team (RBAC)

### `GET /team` → `200 { data: { users } }`
### `POST /team` (manager+; cannot create a role above your own)
```json
{ "name": "Karan Mehta", "email": "karan@co.com", "role": "OWNER|ADMIN|MANAGER|SALES", "password"? }
```
→ `201`
### `PATCH /team/:id` (admin+) `{ "role"?, "active"?, "title"? }` — can't change yourself or the owner
### `DELETE /team/:id` (admin+) — reassigns leads to unassigned, then removes

---

## Settings

### `GET /settings` → org, `leadSources`, `sourceAssignments`, `ai` (never the key itself)
### `PATCH /settings/org` `{ "name"?, "businessType"?, "logoUrl"? }`
### `PATCH /settings/profile` `{ "name"?, "phone"?, "title"? }`
### `POST /settings/source-assignments` `{ "rules": { "WEBSITE": "userId", "WHATSAPP": null } }`
### `POST /settings/ai` `{ "apiKey"?, "model"?, "provider"? }` — key stored server-side only

---

## AI

### `GET /ai/status` → `200 { data: { configured } }`
### `POST /ai/follow-up`
```json
{ "leadId": "...", "channel": "whatsapp|email|call", "tone": "professional|friendly|short|persuasive",
  "language": "english|hindi|hinglish", "objective"?: "...", "productService"? }
```
Reads the lead's real history and returns `200 { data: { message, subject? } }`. Returns `503 AI_NOT_CONFIGURED` without a key.

---

## QR lead capture

### `GET /qr-codes` (authenticated)
Lists the org's QR codes (newest first, max 50) with a rendered QR PNG (`image` data URL), `url`, `scanCount`, `leadCount`, `conversionRate` and the linked campaign. Also returns the org's `campaigns`. → `200 { data: { qrCodes, campaigns } }`

### `POST /qr-codes` (authenticated)
```json
{ "title": "Shop Counter", "description"?, "campaignId"?, "campaignName"?, "fields": ["name","phone","email","message"] }
```
`fields` must include at least one of `name|phone|email|message`. Creates (or reuses by name) the campaign, generates a unique slug and QR PNG. → `201 { data: { qrCode } }`

### `GET /qr-codes/:id` (authenticated)
QR detail + up to 12 recent leads captured through it. → `200 { data: { qrCode, recentLeads } }`

### `PATCH /qr-codes/:id` (manager+)
Edit `title`, `description`, `fields`, `enabled`, `campaignId`/`campaignName`. → `200 { data: { qrCode } }`

### `DELETE /qr-codes/:id` (manager+)
Removes the QR code and its scan history. → `200 { data: { deleted: true } }`

### `GET /public/qr/:slug` (public)
Returns the customer-facing form data (`title`, `description`, `fields`, `orgName`, `campaignName`) and **records a scan** (deduped per IP within 30 minutes to avoid inflation). Responds `400 BAD_REQUEST` for unknown or paused codes. → `200 { data: {...} }`

### `POST /public/qr/:slug/lead` (public, rate limited 15/hour/IP)
```json
{ "name": "Ramesh Kumar", "phone"?, "email"?, "message"? }
```
Creates a lead with `source: QR` (dedupe + auto-assignment apply). A duplicate phone/email returns `200` with `duplicate: true` instead of failing. → `201 { data: { received, message } }`

---

## Super-admin (website handler / developer)

All `/admin/*` routes require an authenticated session **and** an email listed in `SUPER_ADMIN_EMAILS` (env). Unlisted users get `403 FORBIDDEN`.

### `GET /admin/overview`
Platform-wide totals (`organizations`, `activeOrganizations`, `users`, `leads`, `wonLeads`, `wonValue`, `qrCodes`, `quotations`, `invoices`), every organization with per-org stats, recent signups, and the recent error feed.

### `GET /admin/orgs`
All organizations with `users`, `leads`, `openLeads`, `pipelineValue`, `overdueTasks`, `qrCodes`. → `200 { data: { organizations } }`

### `GET /admin/orgs/:id`
Org detail: `org`, `users`, `recentLeads` (15), `recentActivity` (15), `subscription`, `stats`. → `200`

### `PATCH /admin/orgs/:id`
```json
{ "status": "ACTIVE|SUSPENDED", "plan": "STARTER|GROWTH|BUSINESS" }
```
Suspended orgs can no longer log in. Audited. → `200 { data: { org } }`

### `GET /admin/users`
Every account across all orgs (max 500) with org info. → `200 { data: { users } }`

### `PATCH /admin/users/:id`
`{ "active"?: bool, "role"?: "OWNER|ADMIN|MANAGER|SALES" }` → `200 { data: { user } }`

### `GET /admin/system`
Uptime, Node version, platform, memory, load, CPU count, DB connectivity, redacted env. → `200`

### `POST /admin/system/clear-errors`
Clears the in-memory error feed. → `200 { data: { cleared: true } }`

---

## Misc

### `GET /health` — public
### `POST /contact` — public `{ "name", "email", "company"?, "message" }`
### `GET /lead-sources` (authenticated) — source + business-type constants
