# PRIMELEAD AI

> **New here?** Run the whole product with one command — see **[QUICKSTART.md](QUICKSTART.md)** (or `npm run quickstart`).

**AI-powered CRM & lead management for Indian businesses.**

> Every lead captured. Every lead assigned. Every follow-up remembered.

PRIMELEAD AI is a production-style SaaS: a premium marketing site plus a fully working multi-tenant CRM — lead capture, automatic assignment, follow-up engine, sales pipeline, AI follow-up writer, WhatsApp integration flow, notifications, team management and analytics.

This is an **original product** (demo brand "PRIMELEAD AI") inspired by the *category* of sales CRMs. No third-party branding, text or assets are used.

## 📖 Guides

| Guide | Audience | What's inside |
|---|---|---|
| **[docs/USER_GUIDE.md](./docs/USER_GUIDE.md)** | Business owners, managers, salespeople | Step-by-step: login, dashboard, leads, pipeline, follow-ups, QR capture, AI writer, team, settings |
| **[docs/DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)** | Developers & the website handler | Architecture, admin panel, database, security model, testing, deployment, runbook, troubleshooting |
| **[API.md](./API.md)** | Developers | Full REST endpoint reference |

---

## ✨ What's built (Phases 1–19)

| Area | Status |
|---|---|
| Marketing site (Home, Features, Lead Sources, Pricing, FAQ, Contact, Login, Signup, Forgot/Reset) | ✅ |
| Auth — email/password, bcrypt hashing, **revocable DB-backed sessions** (httpOnly cookies), CSRF double-submit, rate limiting, email verification + password reset (console mailer in dev) | ✅ |
| Auth hardening — account lockout, login history, **device/session management**, **MFA/TOTP + recovery codes**, change-password revokes other sessions | ✅ |
| Multi-tenant org isolation (orgId on every entity, org resolved from session, never from client) | ✅ |
| RBAC — **7 system roles** (Owner/Admin/Manager/Sales/Accountant/Support/Viewer) + **config-driven custom roles**, granular permissions, server-side enforcement | ✅ |
| **Teams** — Org → Team → User grouping, member assignment, team CRUD | ✅ |
| Leads — table (search/filter/sort/pagination), bulk assign/status/tag/delete, CSV import/export, duplicate detection, lead scoring | ✅ |
| Lead detail — timeline, call/WhatsApp/email actions, notes, stage & owner change, follow-up scheduling | ✅ |
| Automatic assignment — least-open-leads + round-robin + per-source rules | ✅ |
| Sales pipeline — Kanban with drag & drop, **multiple pipelines per org**, stage CRUD with **win probability + weighted forecast**, stage changes logged with from→to history | ✅ |
| Win/lost tracking — status derived from won/lost stages, optional won/lost reasons, reopen on move back, expected close date | ✅ |
| Follow-up engine — overdue/today/upcoming/missed views, overdue sync + notifications, **priority**, **recurring follow-ups** (auto-spawn next on completion), snooze/reschedule, **Calendar view** | ✅ |
| Dashboard — stat cards, funnel, source/owner charts, 14-day trend, today's & overdue follow-ups, top salespeople | ✅ |
| AI follow-up writer — provider abstraction (OpenAI-compatible), tones + English/Hindi/Hinglish | ✅ |
| **AI CRM assistant** — conversational chat that answers from *your* org's live data (leads, sources, follow-ups, revenue), org-scoped, SALES sees own leads only | ✅ |
| Team management, Settings (profile/org/assignment rules/AI key), audit log | ✅ |
| QR lead capture — campaign generator, server-rendered QR PNG, mobile-first public form, scan/lead/conversion tracking, pause/delete, copy/download | ✅ |
| **Quotations** — GST (CGST/SGST/IGST) auto-calc, auto-numbering, draft→sent→accepted workflow, one-click convert to invoice, PDF download | ✅ |
| **Invoices** — GST + HSN/SAC, payment tracking (partial → paid/overdue), PDF + **payment receipt** downloads | ✅ |
| **Credit & debit notes** — GST-ready corrections (CN-/DN- numbering, PDF, draft→issued→cancelled), credit notes reference the original invoice | ✅ |
| **Configurable GST** — per-org rate set + default (Settings → Tax), 15-char GSTIN validation on every document | ✅ |
| **E-invoice / e-way bill** — **demo providers** with simulated IRN generation, QR codes, EWB numbers, verification & cancellation (drop-in ready); real GSP adapters (NIC, ClearTax) require credentials | ✅ |
| **Integrations & webhooks** — connect WhatsApp/Facebook/IndiaMART/Shopify/Zapier/API, unique webhook secret + URL, secret-verified inbound lead pipeline routed through a **lead-source adapter system** (IndiaMART buyer-enquiry + Meta Lead Ads normalizers with dedupe, attribution and per-org integration logs + connection health) | ✅ |
| **WhatsApp shared inbox** — provider abstraction (demo + Meta Graph API), two-pane team inbox, inbound dedupe by provider message id, phone-based lead linking, outbound text/template sends with `{{1}}` params, delivery/read/status webhooks, assign/close/labels, unread counts, template catalog, demo inbound simulator, write-only provider keys, signed webhook handshake (`X-Hub-Signature-256`) | ✅ |
| **Reports** — date-range analytics: source/owner/status, daily trend, conversion & win rates, revenue, CSV export | ✅ |
| **Billing & subscriptions** — config-driven plans with usage limits, monthly/yearly, trial → active → past-due lifecycle, cancel-at-period-end, provider-agnostic (Razorpay/Stripe/Cashfree adapters + demo) | ✅ |
| **Payments** — hosted checkout creation, HMAC webhook signature verification (Razorpay/Stripe/Cashfree schemes), idempotent event processing, refunds, amount-mismatch rejection; a payment is only ever settled by a verified server-side webhook | ✅ |
| **Usage limits** — Plan-table-driven caps (users/leads, 0 = unlimited) enforced at the service layer across manual, QR, webhook and invite entry points | ✅ |
| **Contacts** — customer directory with search, tags, lead links | ✅ |
| **AI engine (Phase 9)** — provider abstraction now returns token usage; every AI call logged to an immutable `AiUsage` ledger (org/user/provider/model/tokens/cost) with **org-level monthly AI budgets** enforced server-side; new lead intelligence: **lead summary, lead scoring, next-best-action** (demo fallbacks when no key, honest `503` otherwise) | ✅ |
| **Automation engine (Phase 10)** — rules as data: triggers `LEAD_CREATED / LEAD_ASSIGNED / STAGE_CHANGED / FOLLOW_UP_OVERDUE / INVOICE_CREATED / PAYMENT_RECEIVED / QUOTATION_CREATED`, actions `CREATE_TASK / ADD_TAG / CHANGE_STAGE / ASSIGN_USER / NOTIFY_TEAM`, source/stage/value conditions, manual run (test-before-enable), full run log, Automations page, startup sync of system-role permissions to existing orgs | ✅ |
| **Super-admin console** (`/admin`) — platform overview, all organizations, user management, suspend/activate + plan changes, system diagnostics + live error feed (gated by `SUPER_ADMIN_EMAILS`) | ✅ |
| **Data protection (Phase 13)** — GDPR-style **JSON data export** of the whole workspace, **workspace deletion** with `DELETE` confirmation + retention-safe purge + session revocation, **CSV upload hardening** (extension/MIME/magic-byte validation, OWASP spreadsheet formula-injection neutralisation in free-text cells, phone `+91` preserved) | ✅ |
| **Security testing (Phase 14)** — dedicated isolated suites: **global API rate limiter** (429 `RATE_LIMITED` once exceeded, with requestId) and **login throttle** (friendly 429 after repeated failed attempts), hardening headers (`nosniff`, frame-options, referrer-policy), CORS preflight/credentials, the `{code,message,requestId}` error contract (no stack traces, JSON 404s), and **mass-assignment** coverage (forged `orgId`/`id`/timestamps ignored — lead lands in the caller's org; forged cross-org `ownerId` rejected with 400) | ✅ |
| **Performance (Phase 15)** — **gzip/deflate compression** on all API responses (mount-tested: 11 KB dashboard served as gzip), **dashboard queries batched into one parallel `Promise.all`** (14-day trend, funnel, top salespeople, recent lists, follow-ups — no more serial round-trips), and **route-level code splitting** on the client: the initial bundle dropped from ~568 KB to a ~202 KB shell (gzip 140 KB → 62 KB) with each page its own lazy chunk | ✅ |
| **Production deployment (Phase 16)** — single-container Docker image (build + `migrate deploy` + boot verified: 46 tables, health + SPA deep links 200), `start:prod` (`node dist/index.js`) + `db:deploy` scripts, guarded static serving of the built client with SPA fallback, `docker-compose.yml` with persistent SQLite volume + healthcheck, and **`docs/DEPLOYMENT.md`** (env vars, TLS/proxy, backups/restore, upgrades, Postgres migration path) | ✅ |
| **Final audit (spec §91)** — **`FINAL_AUDIT.md`** rates every major area PASS / WARNING / NOT_IMPLEMENTED against the real codebase (203 tests, builds, Docker verified); PWA installable-ready with a web manifest + **offline-shell service worker** | ✅ |
| **Social lead connectors** — turn enquiries from **Instagram, Facebook, WhatsApp, X/Twitter, LinkedIn, Telegram, Hike and Snapchat** into tracked leads: a per-platform adapter (X DMs, Meta Lead Ads, generic social JSON) runs the validate → normalize → dedupe → create pipeline with replay guards, source attribution and integration logs; the Integrations page groups them in a dedicated **Social & messaging** section with per-platform connect/webhook/secret cards | ✅ |
| **Ops follow-ups** — **`npm run backup`** (online SQLite `VACUUM INTO` snapshot, zero-downtime), **Playwright browser E2E** (signup → create lead → schedule follow-up against the production build; `npm run test:e2e`), honest **Meta-outbound errors** naming the exact missing env vars, and a **tall-dialog scroll fix** (dialogs no longer clip their submit buttons on short viewports) | ✅ |
| Automated tests (**203 passing**) — auth, org isolation, assignment engine, GST, QR capture, quotations/invoices, webhooks, AI chat, reports, billing, admin access control, MFA, sessions, account lock, RBAC, teams, request-ids, paise money, multi-pipeline, win/lost lifecycle, recurring follow-ups, credit/debit notes, receipts, GST config, refunds, renewal, reconciliation, **Phase 6 WhatsApp inbox** (hub handshake, lead linking, webhook dedupe, outbound + templates, status webhooks), **Phase 7 lead-source adapters** (IndiaMART/Meta normalization, dedupe, logs, isolation), **Phase 9 AI usage ledger + budget + lead intelligence**, **Phase 10 automation engine** (triggers, actions, conditions, manual run, run log, org isolation), **Phase 13** (CSV formula injection, binary-payload rejection, data export, deletion purge + session revocation + isolation), **Phase 14** (API + login rate limits, security headers, CORS, error contract, mass assignment), **Phase 16 social connectors** (X DM → lead + replay guard, LinkedIn/Telegram/Hike/Snapchat generic payloads, Meta-outbound error honesty) | ✅ |
| **Money in paise** — integer paise everywhere (leads, quotations, invoices, notes, billing), exact GST arithmetic, converted to rupees only at the API/UI boundary | ✅ |
| **Payments & subscriptions** — provider-agnostic (Razorpay/Stripe/Cashfree/demo), idempotent signed webhooks, app-triggered **refunds**, **renewal** with period roll-forward, **reconciliation** + CSV export | ✅ |
| **Free tools** — QR Code Generator, GST Invoice Generator (lead magnets, no signup required) | ✅ |
| **Companies & contacts (Phase 1)** — B2B company database with rich profiles (industry, employee count, funding, technologies, social profiles), company contacts with seniority/department, data provenance tracking | ✅ |
| **Saved searches & lists (Phase 2)** — saved filter combinations, static + dynamic entity lists for segmentation and outreach | ✅ |
| **ICP & persona builder (Phase 3)** — define Ideal Customer Profiles (industry, size, revenue, tech stack) and buyer personas (titles, pain points, messaging tips) | ✅ |
| **Configurable lead scoring (Phase 5)** — rule-based scoring engine with field/operator/value conditions, weighted by priority | ✅ |
| **Buying intent signals (Phase 5)** — track intent signals (company/job change, website visits, content engagement) with confidence scores | ✅ |
| **Email sequences (Phase 6)** — multi-step drip campaigns with enrollment, A/B conditions, AI-powered content, reply/bounce tracking | ✅ |
| **Deliverability center (Phase 6)** — email deliverability metrics (open/click/bounce/spam rates), domain reputation, suppression list integration | ✅ |
| **Calling / dialer (Phase 7)** — outbound/inbound call logging with dispositions, AI-generated transcripts, summaries, and sentiment analysis | ✅ |
| **Meeting scheduler (Phase 7)** — 1:1 / round-robin / team meetings with calendar integration, pre-meeting prep, and post-meeting follow-ups | ✅ |
| **Conversation intelligence (Phase 8)** — analyze calls & meetings for topics, objections, competitors, buying signals, sentiment, and risk | ✅ |
| **Visual workflow builder (Phase 9)** — drag-and-drop workflow editor with trigger/condition/action/delay/branch/AI nodes, workflow templates | ✅ |
| **AI research & recommendations (Phase 10)** — AI-powered company/contact/deal research reports, next-best-action and deal risk recommendations | ✅ |
| **Forms builder (Phase 11)** — dynamic lead capture forms with configurable fields, UTM tracking, honeypot spam protection, embed codes | ✅ |
| **Inbound lead routing (Phase 11)** — configurable routing rules: country/industry/score conditions → assign/notify/task/tag/stage actions, round-robin | ✅ |
| **Website visitor tracking (Phase 11)** — first-party cookie-based visitor identification, page visit scoring, anonymous-to-identified matching | ✅ |
| **Analytics service (Phase 12)** — comprehensive dashboard metrics: leads, revenue, email/call/meeting stats, rep performance, pipeline analytics, daily snapshots | ✅ |
| **Meeting intelligence (Phase 12)** — AI-powered pre-meeting prep (company overview, talking points, suggested questions) and post-meeting summaries with deal risk | ✅ |
| **Consent & suppression (Phase 13)** — GDPR/CCPA consent tracking per contact, suppression lists for email/SMS/campaigns, bulk campaign filtering | ✅ |
| **API keys & webhook platform (Phase 14)** — scoped API keys with HMAC auth, outbound webhook endpoints with HMAC signatures, retry policies, delivery logs | ✅ |
| **Enhanced data import (Phase 15)** — field mapping UI, preview before import, dry-run mode, CSV/Excel support with formula-injection protection | ✅ |
| **Custom report builder (Phase 16)** — configurable reports: pick entity → metrics → dimensions → filters → date range, save/share/schedule, CSV export | ✅ |
| **Territory management (Phase 17)** — geographic/industry territories with ownership rules, account assignment/transfer, unowned entity discovery | ✅ |
| **Sales coaching (Phase 18)** — per-rep performance insights: activity score, call/email/meeting/pipeline metrics, AI-generated strengths & recommendations | ✅ |
| **Revenue forecasting (Phase 18)** — pipeline-based forecasts: commit/best-case/weighted, per-rep and org-wide, manual overrides, AI predictions | ✅ |
| **Scheduled messaging queue (Phase 19)** — DB-backed message queue for WhatsApp & email sends with scheduling, batch operations, exponential back-off retry, priority ordering, per-message logging, manual tick trigger, and interval-based processor that starts at app boot | ✅ |
| **Data quality & deduplication (Phase 1)** — company/contact data quality scoring, duplicate detection with merge workflows | ✅ |
| **Security center (Phase 14)** — login history, active sessions, MFA management, audit log viewer, suspicious activity monitoring | ✅ |

---

## 🎯 Go-To-Market Strategy

PRIMELEAD AI is built specifically for **Indian marketing & web development agencies**. Our GTM strategy focuses on:

### Target Customer (ICP)
- **Solo freelancers** — Web devs/marketers with 5-15 active clients
- **Small agencies (2-10 people)** — Web dev/digital marketing shops in tier-1 & tier-2 cities
- **Growing agencies (10-30 people)** — Multiple salespeople needing accountability & reporting

### Positioning & Messaging
- **"Built for Indian agencies, not adapted for them"** — GST-compliant quotations & invoices out of the box
- **"Your leads already live in WhatsApp — so should your CRM"** — WhatsApp/IndiaMART/Facebook webhook integrations
- **"Never write another follow-up from scratch"** — AI follow-up writer as a time-saving hook
- **"Capture leads from your office, storefront, or event"** — QR code lead capture for offline touchpoints

### Lead Generation Channels
1. **Community & Founder-Led Outreach** — Start here (fastest signal, zero cost)
2. **SEO + Free Tools** — Build in parallel (best long-term CPA)
3. **Partnerships & Referral** — Build in parallel (piggyback on existing trust)
4. **Paid Acquisition** — Hold until trial-to-paid conversion and LTV are known

### Free Tools (Lead Magnets)
- **[QR Code Generator](/tools/qr-generator)** — Free, no signup required
- **[GST Invoice Generator](/tools/gst-invoice-generator)** — Free, no signup required

These tools demonstrate PRIMELEAD AI's value and capture leads for nurturing.

---

## 🧰 Tech stack

- **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · Radix UI · TanStack Query · React Router · Recharts · Lucide
- **Backend:** Node.js · TypeScript · Express · Prisma
- **Database:** SQLite (dev, zero-setup) — **PostgreSQL-ready** (change `provider` + `DATABASE_URL` in `server/prisma/schema.prisma`)
- **Auth:** bcrypt · revocable DB sessions (hashed tokens in httpOnly cookies) · TOTP MFA (otplib) · double-submit CSRF · express-rate-limit · helmet
- **AI:** pluggable provider (OpenAI-compatible) — no vendor code outside `server/src/ai/provider.ts`; per-org provider config from org settings (no cross-tenant key leakage)
- **Email:** nodemailer with console fallback (dev)

---

## 🚀 Quick start

Requires **Node 18+** (tested on Node 24).

### SQLite (default — zero setup)

```bash
cd Compute

# 1. install dependencies (npm workspaces)
npm install

# 2. configure environment
cp server/.env.example server/.env
#   - edit server/.env, set a strong JWT_SECRET
#   - (optional) AI_API_KEY / AI_MODEL for AI features

# 3. create the database + seed demo data
npm run db:migrate    # creates schema (SQLite file: server/prisma/dev.db)
npm run db:seed       # demo org + realistic sample data + pricing plans

# 4. run everything (API on :4000, web on :5173)
npm run dev
```

### PostgreSQL (production-ready)

```bash
# 1. Create PostgreSQL database
createdb primelead

# 2. Configure .env with Postgres URL
cp server/.env.postgres.example server/.env
#   - Update DATABASE_URL="postgresql://user:pass@localhost:5432/primelead"

# 3. Run migration script
npm run db:postgres

# 4. Seed demo data (optional)
npm run db:seed

# 5. Start dev server
npm run dev
```

### Database utilities

```bash
npm run db:status    # Show current database provider (SQLite/PostgreSQL)
npm run db:sqlite    # Switch back to SQLite
npm run db:postgres  # Switch to PostgreSQL
```

Open **http://localhost:5173**.

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Owner | `owner@primelead.demo` | `Demo@1234` |
| Manager | `manager@primelead.demo` | `Demo@1234` |
| Salesperson | `karan@primelead.demo` | `Demo@1234` |
| Salesperson | `pooja@primelead.demo` | `Demo@1234` |

Or click **Start Free** and run the onboarding wizard — it can seed realistic sample data for you.

### Useful commands

```bash
npm run dev           # API + web together
npm run dev:server    # API only
npm run dev:client    # web only
npm test              # server unit + API tests (113)
npm run typecheck     # server + client TypeScript checks
npm run build         # production builds
npm run db:seed       # reset/seed demo data
```

---

## 🗂 Project structure

```
Compute/
├─ server/                    # Express + Prisma API
│  ├─ prisma/
│  │  ├─ schema.prisma        # full multi-tenant schema (SQLite, Postgres-ready)
│  │  └─ seed.ts              # demo org, users, sample leads, plans, roles
│  └─ src/
│     ├─ ai/provider.ts       # AI provider abstraction (per-org config, no key leakage)
│     ├─ constants/           # statuses, sources, permission catalog (rbac.ts), scoring
│     ├─ lib/                 # prisma, sessions (revocable), jwt, passwords, money (paise), mailer, audit, http, csrf
│     ├─ middleware/          # auth (sessions + RBAC + org isolation), request-id, error, rate-limit, csrf
│     ├─ services/            # assignment, followups, leads, gst (paise), rbac, ai-followup, onboarding
│     ├─ routes/              # auth (+MFA/sessions), roles, teams, leads, pipeline, tasks, dashboard, settings, ai, misc
│     ├─ validators/          # zod schemas
│     └─ tests/               # API tests (supertest)
└─ client/                    # Vite React app
   ├─ public/                 # favicon, robots.txt, sitemap.xml
   └─ src/
      ├─ components/ui/       # design system (buttons, dialogs, tables…)
      ├─ components/layout/   # marketing + app shells, mobile bottom nav
      ├─ hooks/               # auth, toast, react-query hooks
      ├─ pages/public/        # marketing + auth pages
      └─ pages/app/           # dashboard, leads, lead detail, pipeline, tasks, team, settings, onboarding
```

---

## 🔐 Security checklist (implemented)

- [x] Passwords hashed with bcrypt (10 rounds)
- [x] Revocable DB-backed sessions — token hash stored server-side, httpOnly SameSite=Lax cookie, per-device revocation, touch-based expiry
- [x] MFA/TOTP (optional) with 10 single-use recovery codes; login challenged before a session is issued
- [x] Account lockout after N failed attempts; login history (success/failure/IP/device) recorded
- [x] Double-submit CSRF token on all state-changing requests
- [x] Rate limiting: global API + login throttling (5 attempts / 10 min)
- [x] HTTP security headers (helmet), CORS restricted in production
- [x] Zod validation on every input (422 with readable messages)
- [x] Multi-tenant isolation: `orgId` from session only; org-scoped queries everywhere
- [x] Config-driven server-side RBAC — 7 system roles + custom roles with a granular permission catalog; frontend checks are cosmetic
- [x] Salespeople scoped to their own leads
- [x] Password reset + email verification tokens (hashed, 1h/24h expiry, single use); changing your password revokes every other session
- [x] Audit log for sensitive actions (login, MFA changes, session revokes, lead create/delete, user add/remove, exports…)
- [x] Request IDs on every response + in every error envelope (`requestId`), logged server-side
- [x] Friendly error mapping — raw errors never leak (see `server/src/middleware/error.ts`)
- [x] Money stored as integer paise (never float); soft-delete for leads, API keys stored server-side only

> Production notes: set `COOKIE_SECURE=true` + `NODE_ENV=production` behind HTTPS, set a long random `JWT_SECRET` (used for the short-lived MFA challenge token), restrict `CLIENT_ORIGIN`, and add real SMTP credentials. For Postgres, change the datasource provider and `DATABASE_URL`.

---

## 📚 API documentation

See **[API.md](./API.md)** for the full endpoint reference.

### Quick API tour

```
POST   /api/auth/signup              create org + owner, sets session
POST   /api/auth/login               sign in (rate limited; MFA challenge if enabled)
POST   /api/auth/mfa/verify          complete login with TOTP code
POST   /api/auth/mfa/recovery        complete login with a recovery code
POST   /api/auth/mfa/setup           start MFA setup (returns secret + QR)
POST   /api/auth/mfa/confirm         enable MFA + receive recovery codes
POST   /api/auth/mfa/disable         disable MFA (password + code)
GET    /api/auth/sessions            my active devices
POST   /api/auth/sessions/:id/revoke sign out one device
POST   /api/auth/sessions/revoke-others   sign out every other device
GET    /api/auth/login-history       my recent sign-ins (success/failure/IP/device)
POST   /api/auth/change-password     change password (revokes other sessions)
POST   /api/auth/logout
GET    /api/auth/me                  current user + org + permissions + mfaEnabled (+ issues CSRF cookie)
POST   /api/auth/onboarding          business type, sample data, invites

GET    /api/roles                    org roles + permission catalog
POST   /api/roles                    create a custom role (roles.manage)
PATCH  /api/roles/:id                edit a custom role
DELETE /api/roles/:id                delete a custom role (must be unused)

GET    /api/teams                    list teams + members
POST   /api/teams                    create a team (teams.manage)
PATCH  /api/teams/:id                rename a team
DELETE /api/teams/:id                delete a team (members unassigned, kept)

GET    /api/leads?search=&status=&source=&ownerId=&page=&sort=
POST   /api/leads                    create lead (dedupe + auto-assign)
GET    /api/leads/:id                full detail + timeline
PATCH  /api/leads/:id                update / move stage / reassign
DELETE /api/leads/:id                soft delete
POST   /api/leads/bulk               assign / status / tag / delete
POST   /api/leads/import             CSV upload (multipart)
GET    /api/leads/export             CSV download
POST   /api/leads/:id/activity       log call/WhatsApp/email/note/meeting
POST   /api/leads/:id/tasks          schedule follow-up

GET    /api/pipeline                 Kanban board (stages + leads)
POST   /api/pipeline/stages          add stage
GET    /api/tasks?view=overdue|today|upcoming|done|missed
PATCH  /api/tasks/:id                complete / reschedule
POST   /api/tasks/sync               force overdue detection

GET    /api/qr-codes                 list QR codes + campaigns (rendered QR images)
POST   /api/qr-codes                 create QR (slug + PNG + campaign)
GET    /api/qr-codes/:id             one QR + recent captured leads
PATCH  /api/qr-codes/:id             manager+ — edit / pause / resume
DELETE /api/qr-codes/:id             manager+ — remove
GET    /api/public/qr/:slug          public form meta (records a scan)
POST   /api/public/qr/:slug/lead     public form submit → creates lead (source QR)

GET    /api/dashboard                stats + charts + lists
GET    /api/notifications            inbox (+ unread count)

# Quotations & Invoices (GST)
GET    /api/quotations               list + status counts
POST   /api/quotations               create (GST auto-calc, auto-number)
GET    /api/quotations/:id           one quotation
PATCH  /api/quotations/:id           update / change status
DELETE /api/quotations/:id           manager+ — remove
POST   /api/quotations/:id/convert   → creates an invoice
GET    /api/quotations/:id/pdf       professional PDF download
GET    /api/invoices                 list + counts + total value
POST   /api/invoices                 create (GST, HSN/SAC)
GET    /api/invoices/:id             one invoice
PATCH  /api/invoices/:id             update / change status
DELETE /api/invoices/:id             manager+ — remove
POST   /api/invoices/:id/payment     record payment (auto status)
GET    /api/invoices/:id/pdf         professional PDF download

# AI assistant (conversational, org-scoped)
GET    /api/ai/status                is AI configured?
GET    /api/ai/conversations         my conversations
GET    /api/ai/conversations/:id     full message history
POST   /api/ai/chat                  ask a question (persists conversation)

# Integrations & webhooks
GET    /api/integrations             catalog + my connections
POST   /api/integrations/:source/connect   manager+ — create webhook secret + URL
PATCH  /api/integrations/:source     enable / pause / config
DELETE /api/integrations/:source     manager+ — disconnect
POST   /api/webhooks/:source         public — inbound lead (x-webhook-secret header, rate limited)

# Reports & analytics
GET    /api/reports?from=&to=        aggregated analytics
GET    /api/reports/export           CSV download

# Billing & payments
GET    /api/billing                  plan, subscription, payments, limits, gateway status
POST   /api/billing/upgrade          admin+ — switch plan (demo apply or provider checkout)
GET    /api/billing/payments/:id     poll a checkout payment's status
POST   /api/billing/demo/complete    admin+ — demo: fire a SIGNED simulated webhook
POST   /api/billing/cancel           admin+ — cancel (immediate or { atPeriodEnd: true })
POST   /api/webhooks/payments/:provider  provider webhook (raw body, HMAC signature, idempotent)

# Contacts
GET    /api/contacts?search=         directory
POST   /api/contacts                 create
PATCH  /api/contacts/:id             update
DELETE /api/contacts/:id             remove

# Super-admin (SUPER_ADMIN_EMAILS only)
GET    /api/admin/overview           platform totals + orgs + recent errors
GET    /api/admin/orgs               all organizations with stats
GET    /api/admin/orgs/:id           org detail (team, leads, activity)
PATCH  /api/admin/orgs/:id           suspend / activate / change plan
GET    /api/admin/users              all users across orgs
PATCH  /api/admin/users/:id          deactivate / activate / change role
GET    /api/admin/system             server health, memory, env (redacted)
POST   /api/admin/system/clear-errors
GET    /api/team  POST /api/team     team management (RBAC)
GET    /api/settings                 org settings, assignment rules
POST   /api/settings/ai              save AI key (server-side only)
POST   /api/ai/follow-up             AI follow-up writer

# E-invoice & E-way bill (GST)
GET    /api/gst/einvoice/status      e-invoice provider status
POST   /api/gst/einvoice/irn         generate IRN for an invoice
POST   /api/gst/einvoice/verify      verify an IRN
POST   /api/gst/einvoice/cancel      cancel an IRN
GET    /api/gst/ewaybill/status      e-way bill provider status
POST   /api/gst/ewaybill/generate    generate E-way bill for an invoice
POST   /api/gst/ewaybill/cancel      cancel an E-way bill

# Scheduled messaging
GET    /api/scheduled-messages/stats    queue statistics
GET    /api/scheduled-messages          list scheduled messages
POST   /api/scheduled-messages          schedule a message
POST   /api/scheduled-messages/batch    schedule a batch
POST   /api/scheduled-messages/:id/cancel  cancel
POST   /api/scheduled-messages/:id/retry   retry failed
```

**SALES scoping in quotations/invoices:** salespeople only see documents linked to leads they own (manager+ see everything). **Lead webhooks** authenticate with the per-source secret header and are rate-limited (120 / 10 min). **Payment webhooks** are mounted raw-body and verify the provider's HMAC signature; every event is recorded with a unique `(provider, eventId)` idempotency key so replays are acknowledged and never double-processed. A payment becomes SUCCEEDED **only** through a verified webhook — never from the frontend.

**Admin panel:** add emails to `SUPER_ADMIN_EMAILS` in `server/.env`, log in with one of them, then open **Avatar → Admin panel** (or `/admin`). See `docs/DEVELOPER_GUIDE.md` §3.

**Auth model:** every state-changing request must send the double-submit token from the `pl_csrf` cookie in the `x-csrf-token` header (the client does this automatically). Session cookie: `pl_session`.

**Response envelope:** success → `{ "data": ... }`; error → `{ "error": { "code", "message", "requestId", "details? } }`. Every response carries an `X-Request-Id` header; the same id appears in the error body and the server log for correlation.

**Money:** the API accepts and returns **rupees** (the UI/JSON boundary), but the database stores **integer paise** — never floating-point money. GST, discounts and totals are computed in paise server-side (`server/src/services/gst.ts`, `server/src/lib/money.ts`).

---

## 💳 Payments setup

Without gateway keys the app runs in **demo mode**: upgrades apply instantly and a clearly-labeled **Simulate payment** button fires a *signed* webhook through the exact same verification + idempotency path the real providers use — so the full state machine is exercised without a gateway.

```env
# Pick ONE provider (auto-detected from its keys):
RAZORPAY_KEY_ID=rzp_...          RAZORPAY_KEY_SECRET=...
STRIPE_SECRET_KEY=sk_...          STRIPE_WEBHOOK_SECRET=whsec_...
CASHFREE_APP_ID=...               CASHFREE_SECRET_KEY=...  CASHFREE_WEBHOOK_SECRET=...
# Shared secret for the demo provider's simulated webhooks:
PAYMENT_WEBHOOK_SECRET=change-me
```

Point the provider's webhook dashboard at `POST https://your-host/api/webhooks/payments/{provider}` (raw body). Live provider calls (checkout creation) are **IMPLEMENTATION REQUIRED** until exercised against the real APIs with keys — the adapters implement the documented REST APIs and HMAC schemes, and signature verification is fully covered by tests.

## 🧠 AI setup

AI features (follow-up writer) work with **any OpenAI-compatible endpoint**:

```env
AI_PROVIDER=openai          # openai | anthropic | gemini | custom (metadata only — code is endpoint-agnostic)
AI_API_KEY=sk-...           # required
AI_MODEL=gpt-4o-mini        # default
AI_BASE_URL=                # optional, for custom/self-hosted endpoints
```

Per-org keys can also be saved in **Settings → AI** (stored server-side, never exposed back to the client). Without a key, the UI shows a friendly "connect your AI key" state — it never pretends to work.

---

## 🧪 Testing

```bash
npm test
```

Covers **203 tests** across: GST calculations, lead scoring, signup/login, duplicate detection, auto-assignment, pipeline stage moves, follow-ups, CSV export, QR lead capture, super-admin access control, CSRF enforcement, cross-org data isolation, sessions/MFA/lockout/RBAC/teams, multi-pipeline/win-lost, recurring follow-ups, credit/debit notes, receipts, refunds, renewal, reconciliation, WhatsApp inbox, lead-source adapters, AI usage ledger + budget + lead intelligence, automation engine, CSV formula injection, data export + deletion purge, API + login rate limits, security headers, CORS, error contract, mass assignment, social lead connectors, and Meta outbound honesty.

---

## 🚢 Deployment (production)

1. **Database:** point `DATABASE_URL` at PostgreSQL; run `npx prisma migrate deploy` in `server/`.
2. **Server:** `npm run build -w server` → `node server/dist/index.js` (or a process manager). Set `NODE_ENV=production`, `COOKIE_SECURE=true`, strong `JWT_SECRET`, real `CLIENT_ORIGIN`, SMTP credentials.
3. **Web:** `npm run build -w client` → serve `client/dist` from Nginx/Caddy/Cloudflare Pages with a `/api` reverse proxy to the Node server.
4. Run `npm run db:seed` once (or a fresh empty DB and let users sign up).

---

## 🗺 Roadmap (next)

1. **Native mobile apps** — iOS/Android clients (backend is API-first with OpenAPI spec ready)
2. **Real GSP adapters** — NIC/ClearTax e-invoice & e-way bill with government API credentials
3. **Advanced reporting** — Custom report builder with scheduled exports
4. **Email template builder** — Visual drag-and-drop email templates
5. **Workflow automation** — More triggers and actions for the automation engine

### Completed in this release

- ✅ PostgreSQL migration infrastructure (scripts, env templates, db switcher)
- ✅ OpenAPI specification for mobile app development
- ✅ NIC & ClearTax GSP adapter interfaces (ready for credentials)
- ✅ Scheduled messaging queue with DB-backed scheduling, batch ops, retry, and interval processor
- ✅ Report scheduler with CSV/JSON export, webhook delivery, and due-report processor
- ✅ Email template builder with variable placeholders, preview, duplication, and usage tracking
- ✅ Workflow automation expanded to 23 triggers and 15 actions (email, WhatsApp, score, sequence, activity, webhook, wait, condition)
- ✅ Meta WhatsApp outbound with real Graph API send calls
- ✅ Payment refund APIs for Razorpay, Stripe, and Cashfree
- ✅ PWA push notifications with VAPID + service worker
- ✅ E-invoice & E-way bill demo providers with IRN/EWB generation
- ✅ 203 automated tests passing
- ✅ All 18 phases fully documented and accessible

---

*Demo product. All data in seeds is fictional. Not affiliated with any real company or CRM.*
