# Graph Report - Compute  (2026-08-10)

## Corpus Check
- 146 files · ~165,349 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1288 nodes · 3158 edges · 110 communities (95 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- schemas.ts
- QrCodes.tsx
- friendlyError
- LeadDetail.tsx
- App.tsx
- auth.routes.ts
- LeadFlow AI — Developer & Maintenance Guide
- queries.ts
- http.ts
- use-auth.tsx
- devDependencies
- api
- ai-chat.ts
- app.ts
- cn
- dependencies
- devDependencies
- compilerOptions
- scripts
- leads.routes.ts
- auth.ts
- dependencies
- prisma.ts
- compilerOptions
- LeadFlow AI — User Guide
- AppLayout.tsx
- admin.routes.ts
- documents.ts
- LeadFlow AI — Complete User & Admin Guide
- 📚 Available Documents
- LeadFlow AI — API Reference
- Quotations
- Leads
- LeadFlow AI
- verify-new-modules.js
- 4. User Dashboard
- verify-funnel.js
- qr.routes.ts
- client/package.json
- 5. Lead Management
- Auth
- Super-admin (website handler / developer)
- Common Issues
- Appendix B: API Quick Reference
- scripts
- Invoices
- QR lead capture
- Quotations (GST)
- Navbar.tsx
- 21. Super-Admin Panel
- Installation Steps
- capture-screenshots.js
- 9. Quotations (GST)
- Integrations & webhooks
- Tasks / Follow-ups
- Settings
- AiFollowUpDialog
- 10. Invoices (GST)
- 13. Integrations & Webhooks
- 14. Reports & Analytics
- 16. Team Management
- 3. Marketing Site & Authentication
- 7. Follow-ups & Tasks
- 8. QR Code Lead Capture
- 3. Adding and managing leads
- AI assistant (conversational)
- Contacts
- Team (RBAC)
- Integrations
- QrCodes
- 17. Settings
- 6. Sales Pipeline
- server/package.json
- api.test.ts
- Billing
- Misc
- Notifications
- Billing
- useTasks
- 12. AI Follow-up Writer
- 15. Billing & Subscriptions
- 1. Introduction
- 20. Notifications
- 6. QR lead capture
- Contacts
- PublicLeadForm
- Getting started
- 🚀 Quick start
- @hookform/resolvers
- @radix-ui/react-label
- @radix-ui/react-switch
- @radix-ui/react-tooltip
- react-dom
- react-hook-form
- recharts
- @tanstack/react-query
- zod
- csv-parse
- express-rate-limit
- @prisma/client
- tsx
- @types/qrcode
- typescript

## God Nodes (most connected - your core abstractions)
1. `api()` - 83 edges
2. `cn()` - 68 edges
3. `friendlyError()` - 63 edges
4. `useToast()` - 60 edges
5. `useAuth()` - 36 edges
6. `Button` - 31 edges
7. `prisma` - 31 edges
8. `LeadFlow AI — Complete User & Admin Guide` - 27 edges
9. `Badge()` - 25 edges
10. `Card()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `createApp()` --indirect_call--> `csrfProtection()`  [INFERRED]
  server/src/app.ts → server/src/middleware/csrf.ts
- `createApp()` --indirect_call--> `ensureCsrfCookie()`  [INFERRED]
  server/src/app.ts → server/src/middleware/csrf.ts
- `createApp()` --indirect_call--> `errorHandler()`  [INFERRED]
  server/src/app.ts → server/src/middleware/error.ts
- `createApp()` --indirect_call--> `notFoundHandler()`  [INFERRED]
  server/src/app.ts → server/src/middleware/error.ts
- `AppLayout()` --calls--> `useAuth()`  [EXTRACTED]
  client/src/components/layout/AppLayout.tsx → client/src/hooks/use-auth.tsx

## Import Cycles
- None detected.

## Communities (110 total, 15 thin omitted)

### Community 0 - "schemas.ts"
Cohesion: 0.05
Nodes (47): ACTIVITY_TYPES, ActivityType, BUSINESS_TYPES, canManage(), LEAD_SOURCES, LEAD_STATUSES, LeadStatus, LOST_STATUS (+39 more)

### Community 1 - "QrCodes.tsx"
Cohesion: 0.11
Nodes (32): Badge(), BadgeProps, Tone, tones, Button, ButtonProps, Size, sizes (+24 more)

### Community 2 - "friendlyError"
Cohesion: 0.14
Nodes (35): ImportDialog(), NewLeadDialog(), Select, Table(), TableBody(), TableCell(), TableHead(), TableHeader() (+27 more)

### Community 3 - "LeadDetail.tsx"
Cohesion: 0.11
Nodes (30): PriorityBadge(), StatusBadge(), useAddActivity(), useAddFollowUp(), useAdminOrg(), useAdminUpdateOrg(), useDashboard(), useUpdateLead() (+22 more)

### Community 4 - "App.tsx"
Cohesion: 0.17
Nodes (18): Input, Label, useSeo(), RequestOptions, TYPES, AuthShell(), Contact(), FAQ() (+10 more)

### Community 5 - "auth.routes.ts"
Cohesion: 0.10
Nodes (25): audit(), AuditInput, hashToken(), randomToken(), signSession(), layoutMail(), MailInput, sendMail() (+17 more)

### Community 6 - "LeadFlow AI — Developer & Maintenance Guide"
Cohesion: 0.06
Nodes (35): 10. Extending — quick recipes, 1. Architecture at a glance, 2. Local development, 3. The super-admin panel (`/admin`), 4. Database, 5. Security model (what you must never break), 6. Phase 5–10 modules (quotations, invoices, AI, integrations, reports, billing, contacts), 7. Deployment (production) (+27 more)

### Community 7 - "queries.ts"
Cohesion: 0.11
Nodes (32): LeadFilters, AuthContextValue, Activity, AdminOrg, AdminOrgDetail, AdminOverview, AdminSystem, AiConversation (+24 more)

### Community 8 - "http.ts"
Cohesion: 0.12
Nodes (24): computeLeadScore(), Priority, sourceLabel(), ApiError, badRequest(), conflict(), tooMany(), apiLimiter (+16 more)

### Community 9 - "use-auth.tsx"
Cohesion: 0.10
Nodes (21): App(), Dialog(), DialogContent(), AuthContext, AuthProvider(), ICONS, Toast, ToastContext (+13 more)

### Community 10 - "devDependencies"
Cohesion: 0.07
Nodes (27): autoprefixer, devDependencies, autoprefixer, eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, postcss, tailwindcss (+19 more)

### Community 11 - "api"
Cohesion: 0.09
Nodes (27): useAdminOrgs(), useAdminUpdateUser(), useAdminUsers(), useAiChat(), useAiConversation(), useAiConversations(), useAiStatus(), useBulkLeads() (+19 more)

### Community 12 - "ai-chat.ts"
Cohesion: 0.10
Nodes (19): AiOverride, AiProvider, ChatMessage, GenerateOptions, getAiProvider(), OpenAICompatibleProvider, AI_CHAT_ERROR, buildContext() (+11 more)

### Community 13 - "app.ts"
Cohesion: 0.13
Nodes (19): OPEN_STATUSES, asyncHandler(), ok(), AuthedRequest, scopedWhere(), router, router, router (+11 more)

### Community 14 - "cn"
Cohesion: 0.17
Nodes (18): AdminLayout(), NAV, ProtectedRoute(), Avatar(), CardContent(), CardDescription(), CardFooter(), CardHeader() (+10 more)

### Community 15 - "dependencies"
Cohesion: 0.08
Nodes (25): bcryptjs, cookie-parser, cors, dotenv, express, helmet, jsonwebtoken, multer (+17 more)

### Community 16 - "devDependencies"
Cohesion: 0.08
Nodes (25): prisma, devDependencies, prisma, supertest, @types/bcryptjs, @types/cookie-parser, @types/cors, @types/express (+17 more)

### Community 17 - "compilerOptions"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+15 more)

### Community 18 - "scripts"
Cohesion: 0.08
Nodes (23): concurrently, dependencies, playwright, description, devDependencies, concurrently, name, private (+15 more)

### Community 19 - "leads.routes.ts"
Cohesion: 0.14
Nodes (19): createApp(), TaskKind, main(), notify(), assertManagerOrAbove(), isManagerOrAbove(), upload, assertManagerOrAboveSafe() (+11 more)

### Community 20 - "auth.ts"
Cohesion: 0.16
Nodes (16): config, forbidden(), unauthorized(), SessionPayload, verifySession(), isSuperAdminEmail(), requireSuperAdmin(), assertAdminOrAbove() (+8 more)

### Community 21 - "dependencies"
Cohesion: 0.09
Nodes (23): class-variance-authority, dependencies, class-variance-authority, clsx, framer-motion, lucide-react, @radix-ui/react-avatar, @radix-ui/react-dialog (+15 more)

### Community 22 - "prisma.ts"
Cohesion: 0.18
Nodes (17): main(), seedDemoBusiness(), seedDemoOrg(), seedDemoQr(), seedPlans(), prisma, NotifyInput, publicOrg() (+9 more)

### Community 23 - "compilerOptions"
Cohesion: 0.10
Nodes (20): node, prisma/seed.ts, vitest.config.ts, compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib (+12 more)

### Community 24 - "LeadFlow AI — User Guide"
Cohesion: 0.11
Nodes (18): 10. Integrations (Grow → Integrations), 11. Reports (Sell → Reports), 12. Billing (Grow → Billing), 13. Calendar & Contacts, 14. AI follow-up writer, 2. The Dashboard, 4. The sales pipeline, 5. Follow-ups & tasks (+10 more)

### Community 25 - "AppLayout.tsx"
Cohesion: 0.23
Nodes (13): AppLayout(), GROW_NAV, NAV, SELL_NAV, NotificationsBell(), DropdownItem(), DropdownLabel(), DropdownMenu() (+5 more)

### Community 26 - "admin.routes.ts"
Cohesion: 0.17
Nodes (12): clearErrors(), entries, LogEntry, recentErrors(), recordError(), startedAt, uptimeSeconds(), errorHandler() (+4 more)

### Community 27 - "documents.ts"
Cohesion: 0.19
Nodes (13): formatINR(), money(), nextDocumentNumber(), PDFDocument, renderDocumentPdf(), serializeInvoice(), serializeQuotation(), withNextNumber() (+5 more)

### Community 28 - "LeadFlow AI — Complete User & Admin Guide"
Cohesion: 0.13
Nodes (15): 11.1 What Can AI Answer?, 11.2 Using the Assistant, 11.3 Data Privacy, 11.4 Configuration, 11. AI CRM Assistant, 18.1 Monthly View, 18.2 Creating Events, 18. Calendar (+7 more)

### Community 29 - "📚 Available Documents"
Cohesion: 0.13
Nodes (14): 1. LeadFlow_AI_Complete_Guide.md, 2. LeadFlow_AI_Complete_Guide.doc.html, 3. LeadFlow_AI_Workflow_Guide.html, 4. USER_GUIDE.md, 5. DEVELOPER_GUIDE.md, Adding Screenshots, 📚 Available Documents, Creating Word Document (+6 more)

### Community 30 - "LeadFlow AI — API Reference"
Cohesion: 0.15
Nodes (13): AI, Dashboard, `GET /ai/status` → `200 { data: { configured } }`, `GET /dashboard`, `GET /pipeline` → `200 { data: { stages: [{ id, name, order, color, isWon, isLost, leads: [...] }], pipeline } }`, `GET /reports/export?from=&to=` → CSV attachment, `GET /reports?from=&to=` → `200 { data: { range, cards, charts } }`, LeadFlow AI — API Reference (+5 more)

### Community 31 - "Quotations"
Cohesion: 0.18
Nodes (13): downloadQuotationPdf(), useConvertQuotation(), useDeleteQuotation(), useExportLeads(), useExportReport(), useQuotation(), useQuotations(), useReports() (+5 more)

### Community 33 - "Leads"
Cohesion: 0.17
Nodes (12): `DELETE /leads/:id` (manager+) — soft delete → `200 { data: { deleted: true } }`, `GET /leads`, `GET /leads/export` → CSV attachment (respects current filters), `GET /leads/:id`, Leads, `PATCH /leads/:id`, `POST /leads`, `POST /leads/bulk` (+4 more)

### Community 34 - "LeadFlow AI"
Cohesion: 0.17
Nodes (12): 🧠 AI setup, 📚 API documentation, 🚢 Deployment (production), 📖 Guides, LeadFlow AI, 🗂 Project structure, Quick API tour, 🗺 Roadmap (next) (+4 more)

### Community 35 - "verify-new-modules.js"
Cohesion: 0.29
Nodes (11): api(), check(), cookieHeader(), csrfToken(), fs, JAR, main(), path (+3 more)

### Community 36 - "4. User Dashboard"
Cohesion: 0.18
Nodes (11): 14-Day Trend (Line Chart), 4.1 Top Stat Cards, 4.2 Charts & Visualizations, 4.3 Today's Follow-ups, 4.4 Overdue Leads, 4.5 Recent Leads, 4.6 Top Salespeople, 4. User Dashboard (+3 more)

### Community 37 - "verify-funnel.js"
Cohesion: 0.25
Nodes (7): cookieHeader(), csrf(), getCookieSet(), jar, readCookies(), req(), makeClient()

### Community 38 - "qr.routes.ts"
Cohesion: 0.22
Nodes (8): QR_FIELD_DEFAULTS, qrPublicUrl(), QrRow, renderQrImage(), router, serializeQr(), qrCreateSchema, qrUpdateSchema

### Community 39 - "client/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, preview, typecheck, type (+1 more)

### Community 40 - "5. Lead Management"
Cohesion: 0.20
Nodes (10): 5.1 Viewing All Leads, 5.2 Adding a New Lead, 5.3 Lead Detail Page, 5.4 Bulk Operations, 5.5 Import Leads from CSV, 5.6 Export Leads, 5. Lead Management, Action Buttons (One-Tap) (+2 more)

### Community 41 - "Auth"
Cohesion: 0.22
Nodes (9): Auth, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/login` (rate limited: 5/10min per IP), `POST /auth/logout` → `200 { data: { loggedOut: true } }`, `POST /auth/onboarding` (authenticated), `POST /auth/reset-password`, `POST /auth/signup` (+1 more)

### Community 42 - "Super-admin (website handler / developer)"
Cohesion: 0.22
Nodes (9): `GET /admin/orgs`, `GET /admin/orgs/:id`, `GET /admin/overview`, `GET /admin/system`, `GET /admin/users`, `PATCH /admin/orgs/:id`, `PATCH /admin/users/:id`, `POST /admin/system/clear-errors` (+1 more)

### Community 43 - "Common Issues"
Cohesion: 0.22
Nodes (9): 22. Troubleshooting, "401 Unauthorized" After Login, "403 CSRF" Error, AI Features Say "Connect Your Key", Common Issues, New Route Returns 404, Port Already in Use, Prisma Changes Not Taking Effect (+1 more)

### Community 44 - "Appendix B: API Quick Reference"
Cohesion: 0.22
Nodes (9): Admin, AI, Appendix B: API Quick Reference, Authentication, Invoices, Leads, Pipeline, Quotations (+1 more)

### Community 45 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:generate, db:migrate, db:seed, dev, start, test (+1 more)

### Community 46 - "Invoices"
Cohesion: 0.25
Nodes (8): `DELETE /invoices/:id` (manager+) → `200 { data: { deleted } }`, `GET /invoices/:id` → `200 { data: { invoice } }`, `GET /invoices/:id/pdf` → PDF attachment, `GET /invoices?status=&search=` → `200 { data: { invoices, counts: { total, paid, pending, overdue, totalValue } } }`, Invoices, `PATCH /invoices/:id` — update fields / `status`, `POST /invoices` → `201 { data: { invoice } }`, `POST /invoices/:id/payment` `{ "paidAmount": 10000 }` → `200 { data: { invoice } }`

### Community 47 - "QR lead capture"
Cohesion: 0.25
Nodes (8): `DELETE /qr-codes/:id` (manager+), `GET /public/qr/:slug` (public), `GET /qr-codes` (authenticated), `GET /qr-codes/:id` (authenticated), `PATCH /qr-codes/:id` (manager+), `POST /public/qr/:slug/lead` (public, rate limited 15/hour/IP), `POST /qr-codes` (authenticated), QR lead capture

### Community 48 - "Quotations (GST)"
Cohesion: 0.25
Nodes (8): `DELETE /quotations/:id` (manager+) → `200 { data: { deleted } }`, `GET /quotations/:id` → `200 { data: { quotation } }`, `GET /quotations/:id/pdf` → PDF attachment (PDFKit, A4, GST table, totals), `GET /quotations?status=&search=` → `200 { data: { quotations, counts } }`, `PATCH /quotations/:id` — update fields / `status`, `POST /quotations` → `201 { data: { quotation } }`, `POST /quotations/:id/convert` → `200 { data: { invoice: { id, number, total } } }`, Quotations (GST)

### Community 49 - "Navbar.tsx"
Cohesion: 0.39
Nodes (5): Footer(), MarketingLayout(), LINKS, Logo(), Navbar()

### Community 50 - "21. Super-Admin Panel"
Cohesion: 0.25
Nodes (8): 21.1 Access Control, 21.2 Admin Overview, 21.3 Organization Management, 21.4 Organization Detail, 21.5 User Management, 21.6 System Health, 21.7 Error Feed, 21. Super-Admin Panel

### Community 51 - "Installation Steps"
Cohesion: 0.25
Nodes (8): 2. Getting Started, Demo Credentials, Installation Steps, Step 1: Clone and Install Dependencies, Step 2: Configure Environment, Step 3: Initialize Database, Step 4: Start Development Server, System Requirements

### Community 52 - "capture-screenshots.js"
Cohesion: 0.29
Nodes (7): captureScreenshots(), { chromium }, fs, login(), pages, path, SCREENSHOTS_DIR

### Community 53 - "9. Quotations (GST)"
Cohesion: 0.29
Nodes (7): 9.1 Creating a Quotation, 9.2 Quotation Numbering, 9.3 GST Calculation, 9.4 Quotation Workflow, 9.5 Converting to Invoice, 9.6 Downloading PDF, 9. Quotations (GST)

### Community 54 - "Integrations & webhooks"
Cohesion: 0.33
Nodes (6): `DELETE /integrations/:source` (manager+) — disconnect, `GET /integrations` → `200 { data: { catalog, connections } }`, Integrations & webhooks, `PATCH /integrations/:source` — `{ "enabled"?, "status"?, "name"?, "config"? }` (manager+), `POST /integrations/:source/connect` (manager+) → `200 { data: { integration: { source, webhookUrl, webhookSecret } } }`, `POST /webhooks/:source` (public, rate limited 120/10min per IP)

### Community 55 - "Tasks / Follow-ups"
Cohesion: 0.33
Nodes (6): `DELETE /tasks/:id` → `200`, `GET /tasks?view=today|overdue|upcoming|done|missed`, `PATCH /tasks/:id` `{ "status": "PENDING|DONE|CANCELLED", "title"?, "dueAt"?, "notes"? }` → `200`, `POST /tasks` `{ "leadId"?, "userId"?, "title", "kind"?, "dueAt", "notes"? }` → `201`, `POST /tasks/sync` → `200 { data: { missed, notified } }`, Tasks / Follow-ups

### Community 56 - "Settings"
Cohesion: 0.33
Nodes (6): `GET /settings` → org, `leadSources`, `sourceAssignments`, `ai` (never the key itself), `PATCH /settings/org` `{ "name"?, "businessType"?, "logoUrl"? }`, `PATCH /settings/profile` `{ "name"?, "phone"?, "title"? }`, `POST /settings/ai` `{ "apiKey"?, "model"?, "provider"? }` — key stored server-side only, `POST /settings/source-assignments` `{ "rules": { "WEBSITE": "userId", "WHATSAPP": null } }`, Settings

### Community 57 - "AiFollowUpDialog"
Cohesion: 0.33
Nodes (6): useAiFollowUp(), useLead(), AiFollowUpDialog(), LeadDetail(), useAiStatusQuery(), useWaNumber()

### Community 58 - "10. Invoices (GST)"
Cohesion: 0.33
Nodes (6): 10.1 Creating an Invoice, 10.2 Invoice Numbering, 10.3 Recording Payments, 10.4 Invoice Status, 10.5 Payment History, 10. Invoices (GST)

### Community 59 - "13. Integrations & Webhooks"
Cohesion: 0.33
Nodes (6): 13.1 Available Integrations, 13.2 Connecting a Source, 13.3 Webhook Authentication, 13.4 Lead Processing Pipeline, 13.5 Managing Integrations, 13. Integrations & Webhooks

### Community 60 - "14. Reports & Analytics"
Cohesion: 0.33
Nodes (6): 14.1 Selecting Date Range, 14.2 Report Metrics, 14.3 Exporting Reports, 14. Reports & Analytics, Cards, Charts

### Community 61 - "16. Team Management"
Cohesion: 0.33
Nodes (6): 16.1 Viewing Team Members, 16.2 Adding Team Members, 16.3 Changing Roles, 16.4 Deactivating Members, 16.5 Automatic Lead Assignment, 16. Team Management

### Community 62 - "3. Marketing Site & Authentication"
Cohesion: 0.33
Nodes (6): 3.1 Marketing Homepage, 3.2 User Registration (Signup), 3.3 User Login, 3.4 Password Reset, 3.5 Email Verification, 3. Marketing Site & Authentication

### Community 63 - "7. Follow-ups & Tasks"
Cohesion: 0.33
Nodes (6): 7.1 Follow-up Views, 7.2 Creating a Follow-up, 7.3 Completing a Follow-up, 7.4 Automatic Overdue Detection, 7.5 Calendar View, 7. Follow-ups & Tasks

### Community 64 - "8. QR Code Lead Capture"
Cohesion: 0.33
Nodes (6): 8.1 Creating a QR Code, 8.2 Using the QR Code, 8.3 Customer Experience, 8.4 What Happens Behind the Scenes, 8.5 QR Code Management, 8. QR Code Lead Capture

### Community 65 - "3. Adding and managing leads"
Cohesion: 0.33
Nodes (6): 3. Adding and managing leads, Add a lead manually, Bulk actions, Export, Import from Excel / CSV, The leads table

### Community 67 - "AI assistant (conversational)"
Cohesion: 0.40
Nodes (5): AI assistant (conversational), `GET /ai/conversations` → `200 { data: { conversations: [{ id, topic, updatedAt, preview }] } }`, `GET /ai/conversations/:id` → `200 { data: { conversation } }`, `GET /ai/status` → `200 { data: { configured } }`, `POST /ai/chat` `{ "message": "…", "conversationId"? }` → `200 { data: { conversationId, reply, notConfigured } }`

### Community 68 - "Contacts"
Cohesion: 0.40
Nodes (5): Contacts, `DELETE /contacts/:id` → `200 { data: { deleted } }`, `GET /contacts?search=` → `200 { data: { contacts, total } }`, `PATCH /contacts/:id` → `200 { data: { contact } }`, `POST /contacts` → `201 { data: { contact } }` — `{ name, phone?, email?, company?, notes?, tags?, leadId? }` (lead must belong to the org)

### Community 69 - "Team (RBAC)"
Cohesion: 0.40
Nodes (5): `DELETE /team/:id` (admin+) — reassigns leads to unassigned, then removes, `GET /team` → `200 { data: { users } }`, `PATCH /team/:id` (admin+) `{ "role"?, "active"?, "title"? }` — can't change yourself or the owner, `POST /team` (manager+; cannot create a role above your own), Team (RBAC)

### Community 70 - "Integrations"
Cohesion: 0.40
Nodes (5): useConnectIntegration(), useDisconnectIntegration(), useIntegrations(), useUpdateIntegration(), Integrations()

### Community 71 - "QrCodes"
Cohesion: 0.40
Nodes (5): useDeleteQrCode(), useQrCodes(), useUpdateQrCode(), downloadPng(), QrCodes()

### Community 72 - "17. Settings"
Cohesion: 0.40
Nodes (5): 17.1 Profile Settings, 17.2 Organization Settings, 17.3 Assignment Rules, 17.4 AI Configuration, 17. Settings

### Community 73 - "6. Sales Pipeline"
Cohesion: 0.40
Nodes (5): 6.1 Pipeline Overview, 6.2 Drag-and-Drop, 6.3 Lead Card Information, 6.4 Customizing Stages, 6. Sales Pipeline

### Community 74 - "server/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 75 - "api.test.ts"
Cohesion: 0.50
Nodes (3): NOTE: everything is imported dynamically so the isolated test DATABASE_URL, resetDb(), TEST_DB

### Community 76 - "Billing"
Cohesion: 0.50
Nodes (4): Billing, `GET /billing` → `200 { data: { org, plans, subscription, currentPlan, payments, gateway } }`, `POST /billing/cancel` (admin+) → `200 { data: { cancelled } }`, `POST /billing/upgrade` (admin+) `{ "planSlug": "growth|business|starter", "period": "MONTHLY|YEARLY" }`

### Community 77 - "Misc"
Cohesion: 0.50
Nodes (4): `GET /health` — public, `GET /lead-sources` (authenticated) — source + business-type constants, Misc, `POST /contact` — public `{ "name", "email", "company"?, "message" }`

### Community 78 - "Notifications"
Cohesion: 0.50
Nodes (4): `GET /notifications` → `200 { data: { items, unread } }`, Notifications, `PATCH /notifications/:id/read` → `200`, `POST /notifications/read-all` → `200`

### Community 79 - "Billing"
Cohesion: 0.50
Nodes (4): useBilling(), useCancelSubscription(), useUpgradePlan(), Billing()

### Community 80 - "useTasks"
Cohesion: 0.50
Nodes (4): useCompleteTask(), useTasks(), Calendar(), Tasks()

### Community 81 - "12. AI Follow-up Writer"
Cohesion: 0.50
Nodes (4): 12.1 What It Does, 12.2 Using the AI Writer, 12.3 Example Outputs, 12. AI Follow-up Writer

### Community 82 - "15. Billing & Subscriptions"
Cohesion: 0.50
Nodes (4): 15.1 Available Plans, 15.2 Subscription Management, 15.3 Payment History, 15. Billing & Subscriptions

### Community 83 - "1. Introduction"
Cohesion: 0.50
Nodes (4): 1. Introduction, Target Audience, Technology Stack, What is LeadFlow AI?

### Community 84 - "20. Notifications"
Cohesion: 0.50
Nodes (4): 20.1 Bell Icon, 20.2 Notification Types, 20.3 Managing Notifications, 20. Notifications

### Community 85 - "6. QR lead capture"
Cohesion: 0.50
Nodes (4): 6. QR lead capture, Create a QR code (Owner / Admin / Manager), Use it, What the customer sees

### Community 86 - "Contacts"
Cohesion: 0.67
Nodes (3): useContacts(), useDeleteContact(), Contacts()

### Community 87 - "PublicLeadForm"
Cohesion: 0.67
Nodes (3): usePublicQrMeta(), useSubmitPublicLead(), PublicLeadForm()

### Community 88 - "Getting started"
Cohesion: 0.67
Nodes (3): 1. Logging in, Getting started, The three roles

### Community 89 - "🚀 Quick start"
Cohesion: 0.67
Nodes (3): Demo credentials, 🚀 Quick start, Useful commands

## Knowledge Gaps
- **534 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+529 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LeadFlow AI — Complete User & Admin Guide` connect `LeadFlow AI — Complete User & Admin Guide` to `4. User Dashboard`, `5. Lead Management`, `Common Issues`, `Appendix B: API Quick Reference`, `21. Super-Admin Panel`, `Installation Steps`, `9. Quotations (GST)`, `10. Invoices (GST)`, `13. Integrations & Webhooks`, `14. Reports & Analytics`, `16. Team Management`, `3. Marketing Site & Authentication`, `7. Follow-ups & Tasks`, `8. QR Code Lead Capture`, `DEVELOPER_GUIDE.md`, `17. Settings`, `6. Sales Pipeline`, `12. AI Follow-up Writer`, `15. Billing & Subscriptions`, `1. Introduction`, `20. Notifications`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `LeadFlow AI — API Reference` connect `LeadFlow AI — API Reference` to `Leads`, `DEVELOPER_GUIDE.md`, `AI assistant (conversational)`, `Contacts`, `Team (RBAC)`, `Auth`, `Super-admin (website handler / developer)`, `Billing`, `Misc`, `Invoices`, `Notifications`, `QR lead capture`, `Quotations (GST)`, `Integrations & webhooks`, `Tasks / Follow-ups`, `Settings`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `LeadFlow AI — User Guide` connect `LeadFlow AI — User Guide` to `Getting started`, `3. Adding and managing leads`, `DEVELOPER_GUIDE.md`, `6. QR lead capture`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _534 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `schemas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04887218045112782 - nodes in this community are weakly interconnected._
- **Should `QrCodes.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1138763197586727 - nodes in this community are weakly interconnected._
- **Should `friendlyError` be split into smaller, more focused modules?**
  _Cohesion score 0.14174972314507198 - nodes in this community are weakly interconnected._