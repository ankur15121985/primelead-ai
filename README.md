# LeadFlow AI

**AI-powered CRM & lead management for Indian businesses.**

> Every lead captured. Every lead assigned. Every follow-up remembered.

LeadFlow AI is a production-style SaaS: a premium marketing site plus a fully working multi-tenant CRM — lead capture, automatic assignment, follow-up engine, sales pipeline, AI follow-up writer, WhatsApp integration flow, notifications, team management and analytics.

This is an **original product** (demo brand "LeadFlow AI") inspired by the *category* of sales CRMs. No third-party branding, text or assets are used.

## 📖 Guides

| Guide | Audience | What's inside |
|---|---|---|
| **[docs/USER_GUIDE.md](./docs/USER_GUIDE.md)** | Business owners, managers, salespeople | Step-by-step: login, dashboard, leads, pipeline, follow-ups, QR capture, AI writer, team, settings |
| **[docs/DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)** | Developers & the website handler | Architecture, admin panel, database, security model, testing, deployment, runbook, troubleshooting |
| **[API.md](./API.md)** | Developers | Full REST endpoint reference |

---

## ✨ What's built (Phases 1–10)

| Area | Status |
|---|---|
| Marketing site (Home, Features, Lead Sources, Pricing, FAQ, Contact, Login, Signup, Forgot/Reset) | ✅ |
| Auth — email/password, bcrypt hashing, JWT httpOnly cookies, CSRF double-submit, rate limiting, email verification + password reset (console mailer in dev) | ✅ |
| Multi-tenant org isolation (orgId on every entity, org resolved from session, never from client) | ✅ |
| RBAC — Owner / Admin / Manager / Salesperson, server-side enforcement | ✅ |
| Leads — table (search/filter/sort/pagination), bulk assign/status/tag/delete, CSV import/export, duplicate detection, lead scoring | ✅ |
| Lead detail — timeline, call/WhatsApp/email actions, notes, stage & owner change, follow-up scheduling | ✅ |
| Automatic assignment — least-open-leads + round-robin + per-source rules | ✅ |
| Sales pipeline — Kanban with drag & drop, stage changes logged | ✅ |
| Follow-up engine — overdue/today/upcoming/missed views, overdue sync + notifications, **Calendar view** | ✅ |
| Dashboard — stat cards, funnel, source/owner charts, 14-day trend, today's & overdue follow-ups, top salespeople | ✅ |
| AI follow-up writer — provider abstraction (OpenAI-compatible), tones + English/Hindi/Hinglish | ✅ |
| **AI CRM assistant** — conversational chat that answers from *your* org's live data (leads, sources, follow-ups, revenue), org-scoped, SALES sees own leads only | ✅ |
| Team management, Settings (profile/org/assignment rules/AI key), audit log | ✅ |
| QR lead capture — campaign generator, server-rendered QR PNG, mobile-first public form, scan/lead/conversion tracking, pause/delete, copy/download | ✅ |
| **Quotations** — GST (CGST/SGST/IGST) auto-calc, auto-numbering, draft→sent→accepted workflow, one-click convert to invoice, PDF download | ✅ |
| **Invoices** — GST + HSN/SAC, payment tracking (partial → paid/overdue), PDF download, payment history | ✅ |
| **Integrations & webhooks** — connect WhatsApp/Facebook/IndiaMART/Shopify/Zapier/API, unique webhook secret + URL, secret-verified inbound lead pipeline | ✅ |
| **Reports** — date-range analytics: source/owner/status, daily trend, conversion & win rates, revenue, CSV export | ✅ |
| **Billing** — plans + monthly/yearly toggle, subscription, payment history, provider-agnostic (Razorpay/Stripe ready) | ✅ |
| **Contacts** — customer directory with search, tags, lead links | ✅ |
| **Super-admin console** (`/admin`) — platform overview, all organizations, user management, suspend/activate + plan changes, system diagnostics + live error feed (gated by `SUPER_ADMIN_EMAILS`) | ✅ |
| Automated tests (55 passing) — auth, org isolation, assignment engine, GST, QR capture, quotations/invoices, webhooks, AI chat, reports, billing, admin access control | ✅ |
| **Free tools** — QR Code Generator, GST Invoice Generator (lead magnets, no signup required) | ✅ |

---

## 🎯 Go-To-Market Strategy

LeadFlow AI is built specifically for **Indian marketing & web development agencies**. Our GTM strategy focuses on:

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

These tools demonstrate LeadFlow AI's value and capture leads for nurturing.

---

## 🧰 Tech stack

- **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · Radix UI · TanStack Query · React Router · Recharts · Lucide
- **Backend:** Node.js · TypeScript · Express · Prisma
- **Database:** SQLite (dev, zero-setup) — **PostgreSQL-ready** (change `provider` + `DATABASE_URL` in `server/prisma/schema.prisma`)
- **Auth:** bcrypt · JWT (httpOnly cookie) · double-submit CSRF · express-rate-limit · helmet
- **AI:** pluggable provider (OpenAI-compatible) — no vendor code outside `server/src/ai/provider.ts`
- **Email:** nodemailer with console fallback (dev)

---

## 🚀 Quick start

Requires **Node 18+** (tested on Node 24).

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

Open **http://localhost:5173**.

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Owner | `owner@leadflow.demo` | `Demo@1234` |
| Manager | `manager@leadflow.demo` | `Demo@1234` |
| Salesperson | `karan@leadflow.demo` | `Demo@1234` |
| Salesperson | `pooja@leadflow.demo` | `Demo@1234` |

Or click **Start Free** and run the onboarding wizard — it can seed realistic sample data for you.

### Useful commands

```bash
npm run dev           # API + web together
npm run dev:server    # API only
npm run dev:client    # web only
npm test              # server unit + API tests (55)
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
│  │  └─ seed.ts              # demo org, users, sample leads, plans
│  └─ src/
│     ├─ ai/provider.ts       # AI provider abstraction (only AI code)
│     ├─ constants/           # statuses, sources, roles, scoring
│     ├─ lib/                 # prisma, jwt, passwords, mailer, audit, http, csrf
│     ├─ middleware/          # auth (RBAC + org isolation), error, rate-limit, csrf
│     ├─ services/            # assignment, followups, leads, gst, ai-followup, onboarding
│     ├─ routes/              # auth, leads, pipeline, tasks, dashboard, team, settings, ai, misc
│     ├─ validators/          # zod schemas
│     └─ tests/               # API smoke tests (supertest)
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
- [x] JWT sessions in httpOnly, SameSite=Lax cookies
- [x] Double-submit CSRF token on all state-changing requests
- [x] Rate limiting: global API + login throttling (5 attempts / 10 min)
- [x] HTTP security headers (helmet), CORS restricted in production
- [x] Zod validation on every input (422 with readable messages)
- [x] Multi-tenant isolation: `orgId` from session only; org-scoped queries everywhere
- [x] Server-side RBAC (Owner/Admin/Manager/Sales) — frontend checks are cosmetic
- [x] Salespeople scoped to their own leads
- [x] Password reset + email verification tokens (hashed, 1h/24h expiry, single use)
- [x] Audit log for sensitive actions (login, lead create/delete, user add/remove, exports…)
- [x] Friendly error mapping — raw errors never leak (see `server/src/middleware/error.ts`)
- [x] Soft-delete for leads, API keys stored server-side only

> Production notes: set `COOKIE_SECURE=true` + `NODE_ENV=production` behind HTTPS, set a long random `JWT_SECRET`, restrict `CLIENT_ORIGIN`, and add real SMTP credentials. For Postgres, change the datasource provider and `DATABASE_URL`.

---

## 📚 API documentation

See **[API.md](./API.md)** for the full endpoint reference.

### Quick API tour

```
POST   /api/auth/signup              create org + owner, sets session
POST   /api/auth/login               sign in (rate limited)
POST   /api/auth/logout
GET    /api/auth/me                  current user + org (+ issues CSRF cookie)
POST   /api/auth/onboarding          business type, sample data, invites

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

# Billing
GET    /api/billing                  plan, subscription, payments, gateway status
POST   /api/billing/upgrade          admin+ — switch plan (demo or provider mode)
POST   /api/billing/cancel           admin+ — cancel subscription

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
```

**SALES scoping in quotations/invoices:** salespeople only see documents linked to leads they own (manager+ see everything). **Webhooks** authenticate with the per-source secret header and are rate-limited (120 / 10 min).

**Admin panel:** add emails to `SUPER_ADMIN_EMAILS` in `server/.env`, log in with one of them, then open **Avatar → Admin panel** (or `/admin`). See `docs/DEVELOPER_GUIDE.md` §3.

**Auth model:** every state-changing request must send the double-submit token from the `lf_csrf` cookie in the `x-csrf-token` header (the client does this automatically). Session cookie: `lf_session`.

**Response envelope:** success → `{ "data": ... }`; error → `{ "error": { "code", "message", "details? } }`.

---

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

Covers: GST calculations (CGST/SGST/IGST, discounts, rounding), lead scoring, signup/login, duplicate detection, auto-assignment to least-loaded salesperson, pipeline stage moves + activity logging, follow-ups, CSV export, QR lead capture, super-admin access control (org suspend/reactivate, 403 for non-admins), CSRF enforcement, and cross-org data isolation.

---

## 🚢 Deployment (production)

1. **Database:** point `DATABASE_URL` at PostgreSQL; run `npx prisma migrate deploy` in `server/`.
2. **Server:** `npm run build -w server` → `node server/dist/index.js` (or a process manager). Set `NODE_ENV=production`, `COOKIE_SECURE=true`, strong `JWT_SECRET`, real `CLIENT_ORIGIN`, SMTP credentials.
3. **Web:** `npm run build -w client` → serve `client/dist` from Nginx/Caddy/Cloudflare Pages with a `/api` reverse proxy to the Node server.
4. Run `npm run db:seed` once (or a fresh empty DB and let users sign up).

---

## 🗺 Roadmap (next)

1. **Live payment providers** — add Razorpay/Stripe keys; billing already records sessions + payments provider-agnostically
2. **Scheduled messaging** — WhatsApp/email send queue (architecture ready; gated by credentials)
3. **Phase 11 — Security hardening** — deeper audit coverage, per-org rate-limit tuning
4. **Phase 12 — Performance/SEO/accessibility** — route code-splitting, marketing SEO meta, WCAG pass

---

*Demo product. All data in seeds is fictional. Not affiliated with any real company or CRM.*
