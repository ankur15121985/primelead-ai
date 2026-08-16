# PRIMELEAD AI — API Reference

Base URL: `http://localhost:4000/api` (dev). The web dev server proxies `/api` to it.

- **Auth:** session cookie `pl_session` (httpOnly, SameSite=Lax). All authenticated routes require it. Sessions are **DB-backed and revocable** — the server stores only a SHA-256 hash of the opaque token.
- **CSRF:** every **state-changing** request must include the token from the readable `pl_csrf` cookie in the `x-csrf-token` header. The client SPA does this automatically. (Without it you get `403 CSRF`.)
- **Request IDs:** every response carries an `X-Request-Id` header; the same id appears in the error body (`requestId`) and the server log.
- **Money:** the JSON boundary uses **rupees**; the database stores **integer paise**. Never send or read floats for money beyond the API boundary.
- **Response envelope:** success → `200/201 { "data": ... }` · error → `{ "error": { "code", "message", "requestId", "details? } }`

Error codes: `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `VALIDATION_ERROR` (422) · `RATE_LIMITED` (429) · `INTERNAL` (500) · `PAYLOAD_TOO_LARGE` (413) · `CSRF` (403).

---

## Auth

### `POST /auth/signup`
Create an organisation + owner account. Sets the session cookie. Sends a verification email (console in dev).

```json
{ "name": "Rohit Sharma", "email": "r@co.com", "password": "StrongPass123", "orgName": "Sharma Co", "businessType": "SERVICES", "phone": "" }
```
→ `201 { data: { user, org } }`

### `POST /auth/login` (rate limited: 5/10min per IP; account locks after `LOGIN_MAX_ATTEMPTS` failures)
`{ "email", "password" }` → `200 { data: { user, org } }`

If the account has **MFA enabled**, the login returns a challenge instead:

```json
200 { "data": { "mfaRequired": true, "mfaToken": "<short-lived JWT, 10 min>" } }
```

### `POST /auth/mfa/verify` (rate limited)
Complete a challenged login with a TOTP code. `{ "mfaToken", "code" }` → `200 { data: { user, org } }` (sets the session cookie).

### `POST /auth/mfa/recovery` (rate limited)
Complete a challenged login with a single-use recovery code (dashes optional). `{ "mfaToken", "code" }` → `200 { data: { user, org } }`

### `POST /auth/mfa/setup` (authenticated)
Begin MFA setup. `{ "password" }` (current password) → `200 { data: { secret, otpauthUrl, qrDataUrl } }`

### `POST /auth/mfa/confirm` (authenticated)
Enable MFA + issue 10 single-use recovery codes (shown once, in plaintext). `{ "secret", "code" }` → `200 { data: { enabled, recoveryCodes[] } }`

### `POST /auth/mfa/disable` (authenticated)
`{ "password", "code" }` (current password + a valid TOTP **or** recovery code) → `200 { data: { disabled } }`

### `GET /auth/sessions` (authenticated)
My active devices → `200 { data: { sessions: [{ id, deviceName, ip, lastUsedAt, current }] } }`

### `POST /auth/sessions/:id/revoke` (authenticated)
Sign out one device → `200 { data: { revoked } }`

### `POST /auth/sessions/revoke-others` (authenticated)
Sign out every device except the current one → `200 { data: { revoked: count } }`

### `GET /auth/login-history` (authenticated)
My recent sign-ins → `200 { data: { history: [{ success, reason, ip, userAgent, newDevice, createdAt }] } }`

### `POST /auth/change-password` (authenticated)
`{ "currentPassword", "newPassword" }` — revokes **every other** session → `200 { data: { changed } }`

### `POST /auth/logout` → `200 { data: { loggedOut: true } }`

### `GET /auth/me`
Current user + org + permissions + `mfaEnabled`. → `200 { data: { user, org, csrf } }`

### `POST /auth/verify-email`
`{ "token" }` → `200 { data: { verified: true } }`

### `POST /auth/forgot-password`
`{ "email" }` → always `200 { data: { sent: true } }` (no user enumeration).

### `POST /auth/reset-password`
`{ "token", "password" }` (token valid 1 hour, single use; revokes all sessions) → `200`.

### `POST /auth/onboarding` (authenticated)
`{ "businessType"?, "addSampleData"?: bool, "inviteEmails"?: string[] }` → `200 { data: { onboardingComplete, sampleCount } }`

---

## Roles & teams

### `GET /roles` (authenticated)
The org's roles + the full permission catalog → `200 { data: { roles: [{ id, key, name, description, isSystem, permissions[] }], catalog: string[] } }`

### `POST /roles` (`roles.manage`)
Create a custom role. `{ "name", "description"?, "permissions": string[] }` → `201 { data: { role } }`

### `PATCH /roles/:id` (`roles.manage`)
Rename / re-permission a custom role (the Owner role cannot be edited). `{ "name"?, "description"?, "permissions"? }`

### `DELETE /roles/:id` (`roles.manage`)
Delete a custom role (must not be assigned to anyone). → `200 { data: { deleted } }`

### `GET /teams` (authenticated)
`200 { data: { teams: [{ id, name, description, memberCount, members[] }] } }`

### `POST /teams` (`teams.manage`)
`{ "name", "description"? }` → `201 { data: { team } }`

### `PATCH /teams/:id` (`teams.manage`)
Rename / re-describe. `{ "name"?, "description"? }`

### `DELETE /teams/:id` (`teams.manage`)
Delete a team — members are unassigned (`teamId` → null), never removed. → `200 { data: { deleted } }`

---

## Billing & payments

### `GET /billing` (authenticated)
Subscription, plans (with `userLimit`/`leadLimit`, 0 = unlimited), payments, gateway state.
→ `200 { data: { org, plans[], subscription, currentPlan, payments[], gateway: { configured, provider, mode: 'demo'|'provider' } } }`

### `POST /billing/upgrade` (`billing.manage`)
`{ "planSlug", "period": "MONTHLY"|"YEARLY" }`

- **Demo mode** (no gateway keys): applies immediately, returns `{ applied: true, mode: 'demo', plan, amount, paymentId }`. Paid plans start a trial; settle the demo payment with `POST /billing/demo/complete`.
- **Provider mode**: creates a hosted checkout, returns `{ applied: false, mode: 'provider', provider, plan, amount, checkoutUrl, paymentId }`. The plan **only** activates when a verified webhook arrives.

### `GET /billing/payments/:id` (authenticated)
Poll a checkout payment → `{ payment: { id, status, amount, provider, paidAt, refundedAmount } }`. Status is `PENDING | SUCCEEDED | FAILED | PARTIALLY_REFUNDED | REFUNDED`.

### `POST /billing/demo/complete` (`billing.manage`)
Demo-only. `{ "paymentId", "kind"?: "PAYMENT_CAPTURED"|"PAYMENT_FAILED"|"REFUND_PROCESSED" }` — fires a **signed** simulated webhook through the same pipeline real providers use.

### `POST /billing/cancel` (`billing.manage`)
`{ "atPeriodEnd"?: boolean }` — `true` keeps service until `endsAt` (sets `cancelAtPeriodEnd`); `false`/omitted cancels immediately. → `200 { data: { cancelled, atPeriodEnd } }`

### `POST /webhooks/payments/:provider` (public, raw body)
Provider → `razorpay | stripe | cashfree | demo`. Requires the provider's signature header (`x-razorpay-signature`, `stripe-signature`, `x-webhook-signature`, or `x-webhook-secret` for demo). Verifies the HMAC against the raw body, then processes the event **idempotently** (unique `(provider, eventId)` — replays are acknowledged with `{ duplicate: true }`).

Events handled: payment captured (only way a payment becomes `SUCCEEDED`), payment failed (→ `PAST_DUE`), refund processed (→ `PARTIALLY_REFUNDED`/`REFUNDED`), subscription cancelled. An amount mismatch between the webhook and the recorded Payment causes a non-2xx so the provider retries — the payment is never settled.

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
Any subset of the create fields, plus `ownerId`, `stageId`, `expectedCloseAt`, `wonReason`, `lostReason`. **Moving to a stage derives the status from the stage's won/lost flags** — no client-side status mapping needed for custom pipelines. Moving a won/lost deal back to an open stage reopens it (status `NEW`) and clears the reason. Stage changes log a `STATUS_CHANGE` activity with `fromStage → toStage` + probability + reason metadata; owner changes log `ASSIGNMENT` + notify. Score recomputed. → `200 { data: { lead } }`

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
{ "title": "Call about quotation", "kind": "CALL|WHATSAPP|EMAIL|MEETING|FOLLOW_UP|TASK", "priority"?, "repeatEveryDays"?, "dueAt": "ISO datetime", "notes"?, "userId"? }
```
Creates a follow-up + activity + sets the lead's `nextFollowUpAt`. → `201`

### `POST /leads/tasks/:taskId/complete` → `200`

---

## Pipeline

### `GET /pipeline?pipelineId=` → `200 { data: { stages, pipeline, pipelines, forecast } }`
Board for the org's default pipeline (or the selected one). Each stage carries `probability` (0–100), `value` and `weightedValue` (₹); `forecast` is the sum of open stages' weighted value; `pipelines` lists every org pipeline for the switcher.
### `POST /pipeline` (manager+) `{ "name", "stages"?: [{ name, color?, isWon?, isLost?, probability? }] }` → `201`
Creates a pipeline (first one becomes the default) with optional initial stages.
### `PATCH /pipeline/:pipelineId` (manager+) `{ "name"?, "isDefault"? }` → `200`
Rename or promote to default (only one default per org).
### `DELETE /pipeline/:pipelineId` (manager+) → `200`
Deletes a non-default pipeline; its leads are unassigned from its stages, never deleted.
### `POST /pipeline/stages` (manager+) `{ "name", "color"?, "probability"?, "isWon"?, "isLost"?, "pipelineId"? }` → `201`
### `PATCH /pipeline/stages/:id` (manager+) `{ "name"?, "color"?, "probability"?, "isWon"?, "isLost"? }` → `200`
### `DELETE /pipeline/stages/:id` (manager+) → `200`
Deletes a stage; its leads keep their data and become unassigned from that stage.
### `POST /pipeline/stages/reorder` (manager+) `{ "ids": [...] }` → `200`

---

## Tasks / Follow-ups### `GET /tasks?view=today|overdue|upcoming|done|missed|all`
Also syncs overdue tasks (PENDING→MISSED) and raises notifications. → `200 { data: { tasks, counts } }`
### `POST /tasks` `{ "leadId"?, "userId"?, "title", "kind"?, "priority"?, "repeatEveryDays"?, "dueAt", "notes"? }` → `201`
`repeatEveryDays` (1–365) makes the follow-up recurring: completing it auto-schedules the next occurrence.
### `PATCH /tasks/:id` `{ "status": "PENDING|DONE|CANCELLED", "title"?, "priority"?, "repeatEveryDays"?, "dueAt"?, "notes"? }` → `200`
`status: DONE` routes through the follow-up engine (recurring spawn + lead `nextFollowUpAt` pointer advance). Rescheduling `dueAt` is how clients snooze.
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
### `GET /invoices/:id/receipt` → PDF attachment (only when a payment is recorded; 400 otherwise)

A payment **receipt** — distinct from the tax invoice — summarising the amount received, invoice reference and balance due.

## Credit & debit notes

### `GET /credit-notes?status=&search=` → `200 { data: { notes, counts: { issued, cancelled, totalValue } } }`
### `POST /credit-notes` → `201 { data: { note } }`

`{ customerName, items[], invoiceId?, leadId?, company?, gstin?, reason?, discount? }`. Auto-numbered `CN-YYYY-xxxx`; GST computed server-side. `invoiceId` must belong to the org and appears on the note/PDF as the reference.

### `GET /credit-notes/:id` → `200 { data: { note } }`
### `PATCH /credit-notes/:id` `{ "status": "DRAFT|ISSUED|CANCELLED", "reason"? }` — a cancelled note can't be reissued
### `DELETE /credit-notes/:id` (manager+) → `200`
### `GET /credit-notes/:id/pdf` → PDF attachment

### `GET /debit-notes` / `POST /debit-notes` / `GET /debit-notes/:id` / `PATCH /debit-notes/:id` / `DELETE /debit-notes/:id` / `GET /debit-notes/:id/pdf`

Same shape as credit notes, numbered `DN-YYYY-xxxx`, no invoice reference.

## Tax configuration & e-invoicing

### `GET /settings/gst` → `200 { data: { gst: { rates, defaultRate } } }`
### `PATCH /settings/gst` (`settings.manage`) `{ "rates": [0,5,12,18,28], "defaultRate": 18 }` → `200`

GST rates are **config data**, not code — each org picks its own set and default. Validators also enforce a 15-character GSTIN format on quotations, invoices and notes (`422 VALIDATION_ERROR` on bad input).

E-invoicing / e-way bill: adapter interfaces live in `server/src/integrations/gst/` (`einvoice.ts`, `ewaybill.ts`) with org-config hooks. **IMPLEMENTATION REQUIRED** — no government API is called; every method throws `EINVOICE_NOT_IMPLEMENTED`/`EWAYBILL_NOT_IMPLEMENTED` until a verified adapter is connected.

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

## WhatsApp / shared inbox

A provider-agnostic team inbox. Business logic never talks to the WhatsApp Business Platform directly — it goes through a `WhatsAppProvider` adapter:

- **demo** (default) — fully functional locally: outbound sends succeed instantly and the authenticated demo simulator drives the exact same inbound pipeline a real webhook would.
- **meta** — official Graph API. Webhook parsing + `X-Hub-Signature-256` verification are implemented; outbound sends are **IMPLEMENTATION REQUIRED** until exercised with a real business number.

Provider config lives in org settings (never returned to the client): `{ enabled, provider, token, phoneNumberId, verifyToken }`. The token is **write-only** — an empty value keeps the existing one.

### `GET /whatsapp/conversations?status=OPEN|CLOSED|ALL&q=&mine=1` (`inbox.view`)

→ `200 { data: { conversations, unreadTotal } }`. Conversation: id, lead (linked by phone), waId, customerName, status, assignee, labels, lastMessagePreview, unreadCount.

### `GET /whatsapp/conversations/:id` (`inbox.view`) → `200 { data: { conversation, messages } }`

### `POST /whatsapp/conversations/:id/messages` (`inbox.send`)

`{ "body": "text", … }` **or** `{ "templateName": "quote_ready", "templateParams": ["Ravi"], "templateLanguage": "en" }`. → `201 { data: { sent, messageId, status } }` (502 with `status: FAILED` when the provider rejects).

### `PATCH /whatsapp/conversations/:id` (`inbox.assign`)

`{ "assigneeId": <userId|null> }` (must belong to this org) or `{ "status": "OPEN|CLOSED", "labels": […] }`.

### `POST /whatsapp/conversations/:id/read` (`inbox.view`) — clears the unread counter

### `GET|POST /whatsapp/templates` (`inbox.view` / `inbox.manage`)

Templates use `{{1}}`-style placeholders and are unique per org (`name`). `PATCH /templates/:id` toggles `ACTIVE|PAUSED`; `DELETE /templates/:id` removes.

### `GET|PATCH /whatsapp/settings` (`inbox.manage`)

`PATCH` body: `{ enabled?, provider: "demo|meta", phoneNumberId?, verifyToken?, token? }`. `GET` returns `{ enabled, provider, phoneNumberId, hasToken, verifyToken }` — never the token itself.

### `POST /whatsapp/demo/inbound` (`inbox.send`)

Demo-only inbound simulator. `{ "from": "919876543210", "body": "…", "type"?: "TEXT|MEDIA", "mediaUrl"?, "mediaType"? }` → `201 { data: { received, conversationId, normalizedFrom } }`.

### Meta webhook (public, raw body, signed)

- `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…` — verify handshake (matches the org's configured verify token, constant-time).
- `POST /api/webhooks/whatsapp` — signed events (`X-Hub-Signature-256`, HMAC-SHA256 over the raw body). Resolves the org from the payload's `phone_number_id`; messages and statuses (`SENT/DELIVERED/READ/FAILED`) are applied idempotently by provider message id. Always answers 200 so the provider stops retrying; replays are acknowledged, never duplicated.

The same path also serves the generic lead-capture webhook: requests **without** `X-Hub-Signature-256` fall through to `POST /webhooks/:source` with `x-webhook-secret`.

## Reports & analytics

### `GET /reports?from=&to=` → `200 { data: { range, cards, charts } }`

`cards`: leadsCreated, leadsWon/Lost, conversionRate, winRate, openLeads, tasksDone/Missed, quotationsCount/Value, invoicesCount/Value, revenue, activityCount. `charts`: bySource, byOwner, byStatus, byStage, trend (per day). Date range is clamped to 366 days.

### `GET /reports/export?from=&to=` → CSV attachment

## Billing

### `GET /billing` → `200 { data: { org, plans, subscription, currentPlan, payments, gateway } }`
### `POST /billing/upgrade` (admin+) `{ "planSlug": "growth|business|starter", "period": "MONTHLY|YEARLY" }`

Demo mode (no gateway keys): applies instantly, records a `PENDING` Payment. With `RAZORPAY_KEY_ID`/`STRIPE_SECRET_KEY`: prepares the subscription and returns `applied: false, mode: 'provider'`.

### `POST /billing/payments/:id/refund` (admin+) `{ "amount"? (₹), "reason"? }`

Full or partial refunds. Amount is clamped to what's refundable (settled − already refunded). The demo provider fires a **signed** `REFUND_PROCESSED` webhook through the real pipeline; live gateways are IMPLEMENTATION REQUIRED until their Refund APIs are exercised with keys.

### `POST /billing/demo/renew` (admin+, demo only)

Simulates the next billing period: records a `PENDING` payment for the current plan and settles it via the signed webhook path — the subscription's `endsAt` **rolls forward** from the current period end. Returns `{ renewed, endsAt, amount }`.

### `GET /billing/reconciliation?from=&to=` (`billing.manage`) → `200 { data: { range, totals, payments } }`

Totals: payments, succeeded (settled incl. refunded), failed, refunded, collected, refundedAmount, net. Money counts as collected the moment it settles; refunds reduce net, not collected.

### `GET /billing/payments/export` (`billing.manage`) → CSV attachment (≤5000 latest payments)
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

### `POST /ai/lead/summary` — summarize a lead's history
```json
{ "leadId": "..." }
```
Returns `200 { data: { summary } }`.

### `POST /ai/lead/score` — score a lead (0–100) with reasoning
```json
{ "leadId": "..." }
```
Returns `200 { data: { score, confidence, factors } }`.

### `POST /ai/lead/next-action` — suggest the next best action for a lead
```json
{ "leadId": "..." }
```
Returns `200 { data: { action, reason, dueInDays, priority } }`.

### `GET /ai/usage` → `200 { data: { usage, limits, remaining } }`
### `PATCH /ai/settings` (`ai.use`) — set `mode` and/or `monthlyLimitRupees`

All AI calls are logged to an immutable `AiUsage` ledger (org, user, provider, model, tokens, cost estimate, category) and are gated by the org's monthly AI budget (`monthlyLimitRupees` in org settings). Over-budget requests fail with `429 AI_BUDGET_EXCEEDED`.

---

## Automations

Rules are stored as data, evaluated on events, and every execution is logged to `AutomationRun`.

### `GET /automations` (`automation.view`) → `200 { data: { rules, runs, triggers } }`
### `POST /automations` (`automation.manage`) — create a rule
```json
{
  "name": "Website lead triage",
  "trigger": "LEAD_CREATED",
  "triggerConfig": { "source": "WEBSITE" },
  "actions": [
    { "type": "ADD_TAG", "tag": "hot" },
    { "type": "CREATE_TASK", "title": "Call this lead", "dueInDays": 1, "priority": "HIGH" },
    { "type": "NOTIFY_TEAM", "message": "New website lead captured" }
  ]
}
```
Triggers: `LEAD_CREATED`, `LEAD_ASSIGNED`, `STAGE_CHANGED`, `FOLLOW_UP_OVERDUE`, `INVOICE_CREATED`, `PAYMENT_RECEIVED`, `QUOTATION_CREATED`.
Actions: `CREATE_TASK`, `ADD_TAG`, `CHANGE_STAGE`, `ASSIGN_USER`, `NOTIFY_TEAM`.
`triggerConfig` accepts optional `source`, `stageId`, `stageName`, `minValue` filters.

### `PATCH /automations/:id` (`automation.manage`) — rename / retrigger / re-actions / enable
### `DELETE /automations/:id` (`automation.manage`)
### `POST /automations/:id/run` (`automation.manage`) — manual run against `{ leadId }` (works while paused, for test-before-enable)
### `GET /automations/runs` (`automation.view`) — recent run log (rule name, trigger, entity, status, result)

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

## Account lifecycle (data protection)

### `GET /account/export` (authenticated) — GDPR-style JSON export
Returns the full workspace dataset (organization, users, roles, teams, pipelines, leads, contacts, activities, tasks, documents, messages, AI usage, automation runs, audit log, payments, …) as an attached `primelead-export-*.json` file. Logs a `DATA_EXPORTED` audit event.

### `POST /account/delete` (authenticated, `{ "confirm": "DELETE" }`)
Permanently deletes the workspace and all its data (hard delete across every model, sessions/tokens revoked, cookies cleared, an `ORGANIZATION_DELETED` audit event written first). Requires the literal `DELETE` confirmation; anything else → `400`. After deletion the account can no longer log in.

### CSV import hardening
- Uploads are validated before parsing: `.csv`/`.txt` extension whitelist, MIME allowlist, and a magic-byte binary sniff (NUL-byte detection) — an executable spoofed as `.csv` is rejected.
- OWASP **spreadsheet formula injection** is neutralised: free-text cells (`Name`, `Company`, `Notes`, …) beginning with `=`, `+`, `-`, `@` get a `'` prefix so Excel/Sheets treat them as text. Phone/email cells are untouched — a legitimate `+91…` number is preserved.

---

## Misc

### `GET /health` — public
### `POST /contact` — public `{ "name", "email", "company"?, "message" }`
### `GET /lead-sources` (authenticated) — source + business-type constants
