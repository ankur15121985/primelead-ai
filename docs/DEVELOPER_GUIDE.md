# PRIMELEAD AI — Developer & Maintenance Guide

> **For developers and the website handler who maintain this platform.** Covers architecture, running locally, the super-admin panel, operational tasks, deployment and troubleshooting.

Companion docs: **[USER_GUIDE.md](./USER_GUIDE.md)** (end users) · **[../README.md](../README.md)** (quick start) · **[../API.md](../API.md)** (full API reference).

---

## 1. Architecture at a glance

```
┌────────────────────┐         ┌─────────────────────────────┐
│  React SPA (Vite)  │  /api   │  Express + TypeScript (API) │
│  client/ :5173     │ ──────► │  server/ :4000              │
│  TanStack Query    │         │  Prisma ORM                 │
│  Tailwind + Radix  │         │  └── SQLite (dev) / Postgres │
└────────────────────┘         └─────────────────────────────┘
```

- **npm workspaces**: root `Compute/` → `server/` + `client/`
- **Multi-tenant**: every business entity carries `orgId`. The org is always resolved from the **session**, never from client input. Salespeople are scoped to their own leads (`scopedWhere`).
- **Auth**: bcrypt password hashes · **DB-backed revocable sessions** (opaque token in the httpOnly `SameSite=Lax` cookie `pl_session`, SHA-256 hash stored server-side) · double-submit CSRF (`pl_csrf` cookie + `x-csrf-token` header) · rate limiting · helmet · **optional TOTP MFA** (otplib) with single-use recovery codes · account lock-out · login history.
- **RBAC**: config-driven — 7 system roles + custom roles per org, with a granular permission catalog (`server/src/constants/rbac.ts`, `server/src/services/rbac.ts`). `requirePermission(...)` gates routes; `requireAuth` attaches the resolved permission set to the request.
- **Money**: stored as **integer paise** everywhere (`server/src/lib/money.ts`), converted to rupees only at the API boundary (`server/src/lib/serializers.ts`). The GST engine (`server/src/services/gst.ts`) computes in paise — never floats.
- **Request IDs**: `middleware/request-id.ts` stamps every request; the id is echoed in the `X-Request-Id` header, the error envelope and the server log.
- **AI**: a single provider abstraction in `server/src/ai/provider.ts` (OpenAI-compatible). Provider + key resolve **per-org from org settings** — org A's key can never answer org B's requests. No vendor code anywhere else.

### Key folders (server)

| Path | Purpose |
|---|---|
| `server/src/routes/` | Express routers (auth + MFA/sessions, roles, teams, leads, pipeline, tasks, dashboard, notifications, team, settings, ai, qr, public, **admin**, misc) |
| `server/src/services/` | Business logic (assignment engine, follow-up engine, leads w/ dedupe, GST in paise, RBAC, AI writer, onboarding) |
| `server/src/middleware/` | `auth` (sessions + RBAC + org isolation), `admin` (super-admin gate), `csrf`, `rate-limit`, `request-id`, `error` |
| `server/src/lib/` | prisma, sessions (revocable), jwt, passwords, crypto, money (paise), http, mailer, audit, serializers, **server-log** (admin error feed) |
| `server/src/validators/` | zod schemas (every route validates input → friendly 422s) |
| `server/prisma/` | schema + migrations + seed |
| `server/src/tests/` | vitest + supertest API tests |

### Key folders (client)

| Path | Purpose |
|---|---|
| `client/src/pages/app/` | CRM pages (dashboard, leads, lead detail, pipeline, tasks, qr-codes, team, settings, onboarding) |
| `client/src/pages/admin/` | **Super-admin console** (overview, organizations, org detail, users, system) |
| `client/src/pages/public/` | Marketing site + auth pages + public QR form |
| `client/src/components/ui/` | Design-system components (Button, Dialog, Table…) |
| `client/src/components/layout/` | Marketing shell, app shell (sidebar + mobile bottom nav), **AdminLayout**, ProtectedRoute |
| `client/src/hooks/` | use-auth, use-toast, react-query hooks, `queries.ts` (all API calls) |

---

## 2. Local development

Requirements: **Node 18+** (tested on Node 24). No Docker needed — SQLite by default.

```bash
cd Compute
npm install
cp server/.env.example server/.env     # then edit server/.env
npm run db:migrate                     # create schema (SQLite file: server/prisma/dev.db)
npm run db:seed                        # demo org + realistic sample data
npm run dev                            # API :4000 + web :5173 together
```

Open http://localhost:5173 — demo login `owner@primelead.demo` / `Demo@1234`.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + web (concurrently) |
| `npm run dev:server` / `dev:client` | One side only |
| `npm test` | Server tests (vitest + supertest) |
| `npm run typecheck` | Server + client TypeScript |
| `npm run build` | Production builds for both |
| `npm run db:migrate` / `db:seed` | Schema / demo data |
| `node scripts/verify-funnel.js` | E2E: signup → onboarding → leads → follow-ups |
| `node scripts/verify-qr.js` | E2E: QR create → scan → lead capture |
| `node scripts/verify-admin.js` | E2E: admin overview → orgs → suspend/activate → access control |

---

## 3. The super-admin panel (`/admin`)

The website handler (that's you) gets a **server-side operations console** — completely separate from the CRM.

### How access works

1. Add emails to **`SUPER_ADMIN_EMAILS`** in `server/.env` (comma-separated):

   ```env
   SUPER_ADMIN_EMAILS=you@yourcompany.com,handler@yourcompany.com
   ```

2. That user logs in to the CRM as normal, then opens **Avatar → Admin panel** (or `/admin`).
3. Every `/api/admin/*` route is gated by `requireAuth + requireSuperAdmin` — a user **not** on the list gets `403 FORBIDDEN`. If the env list is empty, the whole admin area is effectively disabled (safe default).

> **Never put a non-admin email in this list.** A super-admin keeps access even if their own org is suspended (so you can't lock yourself out).

### What the admin console does

| Page | Features |
|---|---|
| **Overview** | Platform totals (orgs, users, leads, won value, QR codes, quotations, invoices), top orgs, recent signups, recent error feed |
| **Organizations** | Every tenant: users/leads/pipeline stats · **Suspend / Re-activate** · **Change plan** (Starter/Growth/Business) |
| **Org detail** | Per-org team, recent leads, recent activity, subscription, one-click suspend |
| **Users** | Every account across all orgs · **Deactivate / Re-activate** |
| **System** | Uptime, Node version, memory, DB connectivity, environment (redacted), and the **recent error feed** (in-memory, last 50, clearable) |

### Admin API (all under `/api/admin`, super-admin only)

```
GET    /admin/overview          totals + orgs + recent signups + errors
GET    /admin/orgs              all organizations with stats
GET    /admin/orgs/:id          org detail (team, recent leads, activity, subscription)
PATCH  /admin/orgs/:id          { status?: ACTIVE|SUSPENDED, plan?: STARTER|GROWTH|BUSINESS }
GET    /admin/users             all users across orgs
PATCH  /admin/users/:id         { active?: bool, role?: ... }
GET    /admin/system            health + env (redacted) + memory
POST   /admin/system/clear-errors
```

Admin actions are written to the **audit log** of the affected org (action, actor email, timestamp).

### The error feed

`server/src/lib/server-log.ts` keeps an **in-memory ring buffer** (last 50) of non-routine errors (skips 401/404 noise) captured in `middleware/error.ts`. It is *not* persisted — restart clears it. For durable logs, add PM2/`pino` file logging or ship console output to a log aggregator.

---

## 4. Database

**Schema:** `server/prisma/schema.prisma` (SQLite in dev, Postgres-ready — swap the `provider` + `DATABASE_URL`).

Conventions:
- Every business entity has `orgId` → hard tenant isolation.
- **Money is stored as integer paise** (`Int`) — never floats. Convert at the API boundary (`serializers.ts` / `money.ts`).
- Sessions, login history, MFA secrets, recovery codes, roles and teams are all org/user-scoped rows in the DB.
- Leads have **soft delete** (`deletedAt`).
- `@@unique([orgId, phone])` and `@@unique([orgId, email])` back the duplicate detection.

### Migrations workflow

```bash
# change schema.prisma, then:
npm run db:migrate          # prisma migrate dev (local)
npx prisma migrate deploy   # production
npm run db:seed             # reset demo data (idempotent)
```

### Seed data

`server/prisma/seed.ts` creates: 3 pricing plans (paise prices), the 7 system roles for the demo org, a demo org (Sharma Enterprises, `owner@primelead.demo` / `Demo@1234`), owner/manager/2 salespeople, 12 sample leads with varied sources/stages, follow-ups, and a demo **Shop Counter QR campaign**.

---

## 5. Security model (what you must never break)

1. **Org isolation** — `orgId` comes from `requireAuth` (session), never from the request body. All queries filter by it.
2. **RBAC is enforced server-side** — `requirePermission('x.y')` + hierarchy guards (`assertManagerOrAbove`, `assertAdminOrAbove`) + the permission catalog in `constants/rbac.ts`. Client checks are cosmetic only. Custom roles are validated against the org's `Role` table.
3. **Salesperson scoping** — `scopedWhere()` limits SALES users to their own leads. Keep using it in new routes.
4. **Sessions** — revoke-able DB rows; a revoked session stops authenticating immediately. Password reset / change revokes sessions; MFA challenges never issue a session until the code verifies.
5. **CSRF** — every state-changing request needs the `pl_csrf` cookie token echoed in `x-csrf-token`. The token is stable for the session (not rotated on `/me`) — but keep sending it on every state-changing call.
6. **Never leak** — the error handler maps everything to friendly messages and attaches a `requestId`; raw errors go only to the console + admin feed.
7. **Secrets** — API keys live server-side only (Settings → AI stores them, never returns them), AI provider resolution is per-org, and MFA secrets/TOTP recovery hashes never leave the server. Never log env vars.

### Security checklist when adding a route

- [ ] Validate input with a zod schema (→ `validate()`)
- [ ] Gate with `requireAuth` (+ `requirePermission('...')` if the action maps to a catalog permission)
- [ ] Scope every query by `user.orgId` (and `scopedWhere` for SALES)
- [ ] Audit sensitive actions with `audit({...})`
- [ ] Rate-limit anything public (see `publicLeadLimiter`)
- [ ] Money in, money out — convert rupees ↔ paise at the boundary; never store floats

---

## 6. Phase 5–10 modules (quotations, invoices, AI, integrations, reports, billing, contacts)

### Quotations & Invoices
- **Routes:** `server/src/routes/quotations.routes.ts`, `invoices.routes.ts`; shared logic in `services/documents.ts` (numbering, serialization, GST totals, PDF via **PDFKit**).
- **GST engine:** `services/gst.ts` — per-item taxable → CGST/SGST or IGST; document discount applied after tax and clamped to subtotal. Client previews totals live but the **server is authoritative**.
- **Numbering:** `QT-YYYY-0001` / `INV-YYYY-0001` via `nextDocumentNumber`; `withNextNumber` retries once on a unique-constraint race.
- **SALES scoping:** quotations/invoices have no `ownerId` — SALES users are scoped through `lead: { ownerId }`. Never reintroduce `scopedWhere` (which adds `ownerId`) on these models — it 500s.
- **Convert:** `POST /quotations/:id/convert` copies customer + items to an invoice and marks the quote `CONVERTED` (one-time, 400 on repeat).
- **PDFs:** `GET /quotations/:id/pdf` and `/invoices/:id/pdf` stream a buffered PDFKit document.

### AI CRM assistant
- `services/ai-chat.ts` builds an org-scoped snapshot (counts, sources, owners, top deals, pending follow-ups). SALES sees only their own leads/tasks.
- Conversations persist in `AiConversation`/`AiMessage`. `POST /api/ai/chat` stores both turns and answers via the provider abstraction; `AI_NOT_CONFIGURED` (503) is converted to a friendly stored fallback — the UI never fakes an answer.
- The model has **no write tools** — answer-only, so it can never mutate the DB.

### Integrations & webhooks
- Catalog + connect in `routes/integrations.routes.ts`; connect (manager+) generates a unique `webhookSecret` and returns it **exactly once**.
- `routes/webhooks.routes.ts` is mounted **before** `csrfProtection` in `app.ts` (external systems have no cookies) but after the global limiter, plus a dedicated `webhookLimiter` (120/10 min).
- Tenant resolution: the webhook URL is shared per source, so the org is resolved by **matching the secret** across that source's integrations (constant-time compare).
- Client-supplied `ownerId` is only honoured if the user is an active member of the resolved org — otherwise auto-assign. Never pass it through unvalidated.

### Reports
- `routes/reports.routes.ts` — org-scoped aggregations, `fillDays` zero-fills the trend, date range clamped to **366 days**.

### Payments & subscriptions (Phase 2)
- **Abstraction:** `server/src/payments/provider.ts` defines `PaymentProvider` (`createCheckout`, `verifyAndParse`) + the factory. Adapters: `razorpay.ts`, `stripe.ts`, `cashfree.ts`, `demo.ts`. Business code never talks to a gateway directly.
- **Webhooks:** `routes/payment-webhooks.routes.ts` is mounted with `express.raw()` **before** `express.json()` so the raw body is available for HMAC verification. Signature schemes: Razorpay `x-razorpay-signature` (HMAC-SHA256 of raw body), Stripe `stripe-signature` (`t=<ts>,v1=<sig>` with 5-min tolerance), Cashfree `x-webhook-signature`, demo `x-webhook-secret`.
- **Idempotency:** every event is recorded in `WebhookEvent` with a unique `(provider, eventId)`; replays are acknowledged (`{ duplicate: true }`) and never reprocessed.
- **State machine** (`services/billing.ts`): only a verified `PAYMENT_CAPTURED` webhook settles a payment and activates the subscription (`TRIAL → ACTIVE`; failed payments → `FAILED` + `PAST_DUE`; refunds → `PARTIALLY_REFUNDED`/`REFUNDED`; cancel at period end → `cancelAtPeriodEnd`). An **amount mismatch** throws → provider retries, nothing is settled.
- **Demo mode:** with no gateway keys the demo adapter simulates the whole flow — `POST /billing/demo/complete` fires a signed webhook through the exact same pipeline, so dev/tests exercise the real path without pretending a gateway exists. Live checkout creation is **IMPLEMENTATION REQUIRED** until exercised with keys.
- **Usage limits** (`services/limits.ts`): caps live in the `Plan` table (`userLimit`/`leadLimit`, 0 = unlimited); enforced in `createLead` (all entry points) and team invites; a stale trial/cancelled period lazily drops the org back to STARTER.

### Credit & debit notes, GST config (Phase 4)
- **Shared factory:** `routes/note-documents.routes.ts` builds both routers from one `createNoteRouter(config)` (prefix `CN|DN`, model, serializer, `allowInvoiceRef`) — the two document types can't drift apart. Numbering reuses `withNextNumber` (`services/documents.ts`) with prefixes `CN`/`DN`.
- **State machine:** `DRAFT → ISSUED → CANCELLED`. A cancelled note is immutable (400 on reissue); issuing stamps `issuedAt`. Deleting a note is manager-only (`invoices.delete`).
- **Serializers + PDF:** `serializeCreditNote`/`serializeDebitNote` and the shared `renderDocumentPdf` now handle `CREDIT_NOTE`/`DEBIT_NOTE` kinds (orange/red accents, reference line when created against an invoice). `renderReceiptPdf` produces the invoice **payment receipt** — a distinct document, only for invoices with `paidAmount > 0`.
- **GST config:** rates live in org settings under `gstRates` (`GET/PATCH /settings/gst`, `settings.manage`); defaults are `[0,5,12,18,28]` @ 18. `gstinField` in `validators/schemas.ts` enforces the 15-char GSTIN format on quotations, invoices and notes (422 on bad input).
- **E-invoicing / e-way bill:** `integrations/gst/einvoice.ts` + `ewaybill.ts` define provider interfaces (IRN generate/verify/cancel, EWB generate/cancel) resolved from org settings. **IMPLEMENTATION REQUIRED** — every method throws `EINVOICE_NOT_IMPLEMENTED`/`EWAYBILL_NOT_IMPLEMENTED`; nothing is faked. The invoice engine is decoupled so a verified GSP adapter can slot in later.

### Refunds, renewal, reconciliation (Phase 5)
- **Refunds:** `PaymentProvider.refund()` was added to the abstraction. The demo adapter fires a signed `REFUND_PROCESSED` webhook through the exact same idempotent pipeline (per-refund `refundRef` keeps partial refunds off the same payment from colliding on the `(provider, eventId)` key). Razorpay/Stripe/Cashfree throw **IMPLEMENTATION REQUIRED**. `POST /billing/payments/:id/refund` clamps to the refundable balance and only allows settled payments.
- **Renewal:** `nextPeriodAnchor` (in `services/billing.ts`) anchors the next period at `max(now, current endsAt)` — renewals roll the period forward instead of resetting it. Both `activateSubscriptionForPayment` and the webhook `PAYMENT_CAPTURED` branch use it. `POST /billing/demo/renew` exercises the path (active subscription + demo mode only).
- **Reconciliation:** `GET /billing/reconciliation` counts a payment as **collected** the moment it settles (`SUCCEEDED`/`PARTIALLY_REFUNDED`/`REFUNDED`); refunds reduce `net`, not `collected`. Route ordering matters: `GET /billing/payments/export` is defined **before** `GET /billing/payments/:id` or Express would match `export` as an id.

### Roles & teams (Phase 1)
- `services/rbac.ts` + `constants/rbac.ts` — `seedOrgRoles` creates the 7 system roles on signup; `rolePermissions(orgId, key)` resolves a user's effective permission set (custom roles read from the `Role` table). `requirePermission` blocks without the right permission.
- `routes/roles.routes.ts` — list/create/edit/delete custom roles (`roles.manage`); system roles are read-only; the Owner role can't be edited.
- `routes/teams.routes.ts` — team CRUD (`teams.manage`). Deleting a team unassigns members (keeps them).
- `User.teamId` is org-validated in `routes/team.routes.ts` — you can never attach a member to another org's team.

### Pipeline & follow-ups (Phase 3)
- **Multi-pipeline:** `routes/pipeline.routes.ts` — orgs can hold many pipelines (one default). `GET /pipeline?pipelineId=` resolves an explicit id, else the default (or first). Pipeline create/rename/delete + set-default are manager-only (`pipeline.edit` + `assertManagerOrAbove`); the default pipeline can't be deleted; deleting a pipeline/stage **unassigns** its leads (never deletes them).
- **Stage probability & forecast:** `PipelineStage.probability` (0–100). The board returns per-stage `value` + `weightedValue` (₹) and an overall `forecast` (sum of weighted open-stage value).
- **Win/lost lifecycle:** stage flags (`isWon`/`isLost`) **derive the lead status server-side** — the client only sends `stageId`. Moving to a terminal stage stores `wonReason`/`lostReason`; moving back to an open stage reopens the deal (status `NEW`) and clears the reason. `Lead.expectedCloseAt` is a plain date field. Stage changes log `STATUS_CHANGE` activities with `fromStage → toStage`, probability and reason metadata.
- **Follow-up engine** (`services/followups.ts`): `Task.priority` (LOW…URGENT) and `Task.repeatEveryDays` (recurring). Completing a recurring task **auto-spawns the next occurrence** (same title/kind/priority, due + N days) and advances the lead's `nextFollowUpAt` pointer to the earliest remaining pending task. `PATCH /tasks/:id` with `status: DONE` routes through `completeFollowUp` so the spawn always happens — never bypass it with a raw update.
- **Snooze/reschedule:** clients reschedule by PATCHing `dueAt` (the Tasks UI snoozes +1 day). Reopening sets `status: PENDING`.

### WhatsApp / shared inbox (Phase 6)
- **Abstraction:** `server/src/whatsapp/provider.ts` defines `WhatsAppProvider` (`sendText`, `sendTemplate`, `parseWebhook`, `verifyWebhook`). Adapters: `demo.ts` (outbound succeeds instantly, no fake Meta calls) and `meta.ts` (Graph API; webhook parsing + `X-Hub-Signature-256` verification implemented, outbound throws **IMPLEMENTATION REQUIRED**). `resolveWhatsAppProvider(orgId)` reads org settings (`whatsapp` key) and returns demo unless a real `meta` config exists — business code never touches a provider directly.
- **Service layer** (`services/whatsapp.ts`) is the single inbox engine: inbound → dedupe by `waMessageId` → find-or-create conversation (linked to a lead by phone, `91` prefix dropped) → bump `unreadCount`/`lastMessageAt` → WHATSAPP activity + notification. Outbound creates a `QUEUED` message, calls the provider, then records `SENT`/`FAILED`. Status updates rank (`READ > DELIVERED > SENT`) so a webhook can never downgrade a stronger state.
- **Routes:** `routes/whatsapp.routes.ts` (conversations/messages/templates/settings/demo simulator) sits behind `requirePermission` (`inbox.view|send|assign|manage`). `routes/whatsapp-webhook.routes.ts` is mounted with `express.raw()` **before** `express.json()` — same pattern as payment webhooks.
- **Shared path:** `POST /api/webhooks/whatsapp` serves both the Meta webhook and the generic lead-capture webhook. The Meta router checks for `X-Hub-Signature-256`; when absent it **re-parses the raw buffer back to JSON and calls `next()`** so the generic router (mounted after `express.json()`) handles `x-webhook-secret` requests. Never remove that pass-through — it breaks the integration catalog.
- **Tenant resolution:** Meta webhooks are unauthenticated, so the org is resolved from the payload's `phone_number_id` (scanned across org settings). GET hub verification matches the org's configured `verifyToken` with `safeEqual`. Provider tokens are **write-only** — `getWhatsAppConfig` returns `hasToken`, never the token; an empty `token` on PATCH keeps the existing one.
- **Inbox UI:** `client/src/pages/app/Inbox.tsx` — two-pane list/thread, status tabs, mine-only filter, search by name/number, template sends with `{{n}}` param inputs, assign/close, demo simulator dialog, provider settings dialog.

### Lead-source adapters (Phase 7)
- **Interface:** `integrations/leadsource.ts` defines `LeadSourceAdapter` (`receiveLead`, `validateLead`, `normalizeLead`, `deduplicateLead`, `createLead`) plus a registry (`getAdapter(source)`). Adapters: `indiamart.ts` (buyer-enquiry payload → normalized lead) and `meta-leads.ts` (Lead Ads payload with campaign/adset attribution).
- **Webhook routing:** `routes/webhooks.routes.ts` resolves the adapter from the integration's `source` and runs payloads through the full pipeline; every attempt (success or failure, with reason) is recorded to `IntegrationLog` (immutable, org-scoped). Generic webhooks for sources without an adapter keep the old secret-verified path.
- **Health:** `GET /api/integrations/:source/logs` (recent attempts) and the connections list includes `lastSyncAt`/`error` per integration. Client: Integrations page shows a per-connection activity log + health badge.

### AI usage ledger, budgets & lead intelligence (Phase 9)
- **Ledger:** `services/ai-usage.ts` — every AI call records an immutable `AiUsage` row (org, user, provider, model, tokens, cost estimate, category). Provider interface now returns `{ text, usage }` (tokens) from `ai/provider.ts`.
- **Budgets:** org setting `monthlyLimitRupees` is enforced server-side in `checkAiBudget` — over budget → `429 AI_BUDGET_EXCEEDED`. `GET /ai/usage` shows spend/limits; `PATCH /ai/settings` adjusts them.
- **Lead intelligence:** `services/ai-features.ts` — `leadSummary`, `leadScore`, `nextBestAction` built from real lead history. Demo fallbacks (deterministic scoring from activity/value/source) when no AI key; honest `503 AI_NOT_CONFIGURED` when AI mode is OFF.

### Automation engine (Phase 10)
- **Models:** `AutomationRule` (org, name, trigger, `triggerConfig` JSON, `actions` JSON, enabled) + `AutomationRun` (immutable execution log: trigger, entity, status, result).
- **Engine:** `services/automation.ts` — `runAutomationTrigger(orgId, trigger, ctx)` evaluates enabled rules (conditions: source/stage/minValue), executes each action (`CREATE_TASK`, `ADD_TAG`, `CHANGE_STAGE`, `ASSIGN_USER`, `NOTIFY_TEAM`) with per-action error isolation, and writes one `AutomationRun` per rule. `runRuleForLead` powers manual runs (works while paused).
- **Event hooks:** `createLead` (LEAD_CREATED), lead PATCH (STAGE_CHANGED, LEAD_ASSIGNED), `syncOverdue` (FOLLOW_UP_OVERDUE), invoice create (INVOICE_CREATED, QUOTATION_CREATED for converted quotes), billing payment settle (PAYMENT_RECEIVED). Hooks await so tests are deterministic.
- **Routes/UI:** `routes/automation.routes.ts` (CRUD + `/:id/run` + `/runs`, `automation.view|manage`) and `client/src/pages/app/Automations.tsx` (rule builder with trigger/condition/action pickers, enable toggle, run log).
- **System-role sync:** `syncSystemRoles` (called at startup and org creation) refreshes built-in role permission rows to the code definitions, so new modules' permissions reach existing orgs without a migration. Custom roles are untouched.

### Performance (Phase 15)
- **Compression:** `app.use(compression())` in `app.ts` (after `requestId`) gzips all JSON API responses over the 1 KB threshold — verify with `curl -H 'Accept-Encoding: gzip'`. The dependency (`compression` + `@types/compression`) is hoisted to the workspace root.
- **Dashboard:** `routes/dashboard.routes.ts` issues the trend (14 days × 2 counts), funnel, top-salespeople, recent lists and follow-ups as **one parallel `Promise.all`** — never add a serial `await` to that handler; add the query to the batch instead.
- **Client code splitting:** `App.tsx` lazy-loads every page via the `lazyPage()` helper (`Suspense` + skeleton fallback wraps `<Routes>`). Layouts stay eager (the app shell). When adding a page: add a `lazyPage` import, keep the named export, and the build will emit its own chunk.

### Production build & deployment (Phase 16)
- **Build layout:** `server/tsconfig.json` uses `rootDir: src` → compiled output is `server/dist/index.js` (entry: `npm run start:prod -w server`). `prisma/seed.ts` and `vitest.config.ts` run via tsx/vitest and are deliberately excluded from the production bundle.
- **Static serving:** `app.ts` mounts `express.static(client/dist)` + an SPA fallback **only when `client/dist/index.html` exists** — inert in dev (Vite serves the client) and in tests (they only hit `/api`). The fallback regex excludes `/api` so API 404s stay JSON with a requestId.
- **Docker:** `Dockerfile` (deps → build → runtime; runtime keeps `node_modules` so `prisma migrate deploy` works) + `docker-compose.yml` (persistent SQLite volume, healthcheck). `CMD` runs `npx prisma migrate deploy && node dist/index.js` — migrations are idempotent, so every container start is safe. Full guide: `docs/DEPLOYMENT.md`.

### Data protection & upload hardening (Phase 13)
- **File security:** `lib/file-security.ts` — CSV imports validate extension, MIME (header + sniffing) and magic bytes, and **neutralize OWASP spreadsheet formula injection** in free-text cells (a leading `=`, `+`, `-`, `@` is prefixed with `'`). Phone fields are deliberately exempt so `+91` numbers import untouched.
- **Data export:** `GET /api/account/export` returns a GDPR-style JSON bundle of the entire org (leads, contacts, companies, deals, invoices, quotes, notes, tasks, activities, integrations, settings, usage) as an attachment.
- **Workspace deletion:** `DELETE /api/account` requires a `DELETE` confirmation body; purges all org data (children cascade), revokes every session in the org, and records an audit entry. Cross-org isolation: deleting org A must not touch org B (covered by tests).
- **UI:** Settings → Data & privacy card (export button + confirm-to-delete dialog).

### Contacts & Calendar
- Contacts: simple org-scoped CRUD (`routes/contacts.routes.ts`), lead links validated org-side.
- Calendar is a client month-grid over `GET /api/tasks?view=all` (added to `tasks.routes.ts`).

## 7. Testing

```bash
npm test
```

Current coverage (**142 tests**): GST math (in paise), lead scoring, signup/login, duplicate detection, auto-assignment (least-loaded + round-robin), pipeline moves + activity logging, follow-ups, CSV export, QR capture, **super-admin access control** (listed users allowed, others 403, org suspend/reactivate), CSRF enforcement, cross-org isolation, **Phase 1**: request-ids, sessions/MFA/lockout/login-history, RBAC + custom roles, teams, paise boundaries; **Phase 2**: webhook signature rejection, demo upgrade → signed-webhook activation, webhook idempotency (double-delivery ack), failed-payment → PAST_DUE, refunds, amount-mismatch rejection, payment tenant isolation, and Plan-table usage-limit enforcement (leads + users). **Phase 4/5**: credit/debit notes, receipts, GST config, GSTIN validation, refunds, renewal roll-forward, reconciliation. **Phase 6**: WhatsApp settings token secrecy, hub handshake, inbound lead linking, Meta webhook idempotency + bad-signature rejection, outbound + templates, status webhooks, assign/close/read, RBAC, org isolation. **Phase 7**: IndiaMART + Meta normalization, dedupe, invalid-payload logs, logs/health endpoints, org isolation. **Phase 9**: AI usage ledger, budget enforcement, lead summary/score/next-action. **Phase 10**: LEAD_CREATED + STAGE_CHANGED triggers with conditions, actions (tag/task/notify/assign/stage), manual run, run log, RBAC, org isolation. **Phase 13**: CSV formula-injection neutralisation (free-text cells) with phone preserved, binary/non-CSV payload rejection, data export (shape + isolation), workspace deletion (purge + session revocation + isolation). **Phase 14**: API + login rate limiting (429 `RATE_LIMITED`), hardening headers, CORS preflight/credentials, error contract (code/message/requestId, no stack traces, JSON 404), mass assignment (forged orgId/id/timestamps ignored, forged cross-org ownerId rejected).

**Dedicated suites** — `src/tests/security.test.ts` (headers, CORS, error contract, login throttle with `LOGIN_RATE_LIMIT=3`) and `src/tests/rate-limit.test.ts` (global API limiter with `API_RATE_LIMIT=6`) live in their own files on purpose: rate-limit thresholds are read from the environment at module import, and `apiLimiter` is a module-level constant whose store is shared by every `createApp()` — so the limit is proven in a worker that has nothing else consuming the shared budget.

**How tests isolate the DB:** `api.test.ts` points `DATABASE_URL` at a throwaway SQLite file, `prisma db push`es the schema, and imports the app dynamically. It also sets `SUPER_ADMIN_EMAILS` so the test owner is the admin.

**E2E scripts** (`scripts/verify-*.js`) hit the running server exactly like a browser (cookie jar + CSRF) — run them after any change to auth/leads/QR/admin.

---

## 7. Deployment (production)

### Server

```bash
npm run build -w server
node server/dist/index.js        # or PM2 / systemd / Docker
```

Env for production:
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@host:5432/primelead
JWT_SECRET=<64+ random hex>      # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
COOKIE_SECURE=true               # behind HTTPS
CLIENT_ORIGIN=https://yourdomain.com
APP_URL=https://yourdomain.com
SUPER_ADMIN_EMAILS=you@yourcompany.com
SMTP_HOST=... SMTP_USER=... SMTP_PASS=...   # real mail for verification/reset/invites
```

Then `npx prisma migrate deploy` in `server/`.

### Web

```bash
npm run build -w client
```
Serve `client/dist` from Nginx / Caddy / Cloudflare Pages with a `/api` reverse proxy to the Node server. The SPA needs rewrites so `/r/:slug`, `/admin`, `/app/*` all fall back to `index.html`.

---

## 8. Operational runbook (website handler)

### "An organisation isn't working"

1. Open `/admin` → **Organizations** → find them.
2. Check their status — if **Suspended**, that's deliberate (terms violation). Re-activate or contact the owner.
3. Open their **org detail** — look at recent activity. If stale, the owner may not be logging in.
4. Check **System** → error feed for API errors mentioning their org.

### "Users can't log in"

- Check **Users** page → is the account **deactivated**?
- Check the org is **ACTIVE** (suspended orgs are blocked at login — `403`).
- Forgot passwords are self-service (email link). If email isn't configured, reset links print to the server console in dev.

### "AI features say 'connect your key'"

- Set `AI_API_KEY` / `AI_MODEL` in `server/.env` (global) **or** the org sets its own key in Settings → AI. Keys are per-org settings stored server-side.

### "Suspicious activity / abuse"

- The **error feed** + **audit logs** are your first stop.
- You can **suspend** any org instantly — their users can no longer log in or capture leads.
- Rate limits are global (600 req/15 min per IP) and per-form (15 submissions/hour/IP for public QR forms).

### Backup & restore

- **SQLite:** copy `server/prisma/dev.db` (stop the server first for a consistent snapshot).
- **Postgres:** use `pg_dump`.
- Migrations live in `server/prisma/migrations/` — keep them in git.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `403 CSRF` on POST | Token rotated by a recent `/auth/me` | Re-fetch `pl_csrf` after `/me`; client does this automatically |
| `401` after login on one page | Session expired (7 days default) | `SESSION_MAX_AGE_DAYS` in env |
| Tests fail with `test.db` locked | A vitest run crashed mid-write | Delete `server/prisma/test.db` and re-run |
| Ports busy on `npm run dev` | Stale node processes | `taskkill //F //PID <pid>` on :4000/:5173 listeners |
| QR image doesn't render | `qrcode` package missing | `npm install` in `server/` |
| New route → 404 | Forgot to mount in `app.ts` | Add `app.use('/api/x', xRoutes)` |
| Prisma model change ignored | Client not regenerated | `npx prisma generate` |

---

## 10. Go-To-Market Implementation

### Free Tools (Lead Magnets)

PRIMELEAD AI includes free tools that demonstrate value and capture leads:

1. **QR Code Generator** (`/tools/qr-generator`)
   - Frontend-only tool using free QR API
   - No signup required
   - Generates downloadable PNG QR codes
   - CTA to sign up for full CRM

2. **GST Invoice Generator** (`/tools/gst-invoice-generator`)
   - Frontend-only tool with GST calculations
   - No login required
   - Generates downloadable invoices
   - CTA to sign up for full invoicing system

### GTM Strategy Implementation

The positioning and messaging from the GTM strategy are implemented in:

1. **Marketing Site** (`client/src/pages/public/Home.tsx`)
   - Hero section emphasizes "Built for Indian agencies"
   - Trust strip highlights WhatsApp-native workflows, AI follow-up writer, QR capture
   - Features section emphasizes GST compliance and agency-specific features
   - New "Why agencies" section explains target market focus

2. **Documentation**
   - README.md includes GTM strategy section
   - USER_GUIDE.md explains agency-specific value proposition
   - This DEVELOPER_GUIDE.md documents implementation

### Future: Referral/Affiliate System

The GTM strategy mentions partnerships and referral commissions. To implement:

1. Add `Referral` model to Prisma schema
2. Create referral tracking API endpoints
3. Add affiliate dashboard for partners
4. Implement commission tracking and payouts

---

## 11. Extending — quick recipes

**Add a new role restriction on a route:**
```ts
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  assertManagerOrAbove(user);
  ...
}));
```

**Add a new notification type:** use `notify({ orgId, userId, type, title, body, link })` from `lib/serializers` — it's fire-and-forget and never throws.

**Add a background job (like overdue sync):** mirror `setInterval` in `server/src/index.ts` with try/catch so it can never crash the server.

**Add an admin page:** route + query hook in `client/src/hooks/queries.ts` + page in `client/src/pages/admin/` + nav item in `AdminLayout`.

---

*Demo product. All seed data is fictional. Not affiliated with any real company.*
