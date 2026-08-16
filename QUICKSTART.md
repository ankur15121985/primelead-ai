# PRIMELEAD AI — MVP Quickstart

Run the whole product (API + client + seeded demo data) with **one command**.

## Step 1 — Install

```bash
npm install
```

## Step 2 — Launch (this is the whole setup)

```bash
npm run quickstart
```

That single command:
1. applies database migrations (idempotent),
2. seeds a demo org with sample leads/quotations (skips if already there),
3. starts the API (`:4000`) and the client (`:5173`) together.

Watch the terminal — when you see `⚡ PRIMELEAD API listening` and
`➜ Local: http://localhost:5173/`, it's ready.

## Step 3 — Open the client

Open **http://localhost:5173** in Chrome/Edge.

## Step 4 — Log in

| Field | Value |
|---|---|
| Email | `owner@primelead.demo` |
| Password | `Demo@1234` |

## Step 5 — Tour the app (5 minutes)

1. **Dashboard** — cards for leads, follow-ups today, pipeline value, revenue; charts for leads by source, trend, funnel.
2. **Leads** → **Add lead** — type a name + phone and save; it auto-assigns to a salesperson and scores itself.
3. **Follow-ups** — open the lead you created, click **Schedule follow-up**, pick a time. It shows in the dashboard's Today's follow-ups.
4. **Quotations** → **New quotation** — pick the lead, add a line item; GST (CGST/SGST) is computed automatically.
5. **Invoices** — convert the quotation to an invoice, then **Record payment** (demo mode settles instantly).
6. **Inbox** — the WhatsApp team inbox. Use **Demo simulator** to send yourself an inbound message; it links to a lead by phone.
7. **AI** — the assistant works even with no API key (demo answers); connect a key in Settings for real generations.
8. **Integrations** — the Social & messaging section: connect X / LinkedIn / Telegram / Hike / Snapchat and copy the webhook URL + secret.

## Stopping

Press `Ctrl+C` in the terminal. Data persists in `server/prisma/dev.db` — the
next `npm run quickstart` resumes where you left off.

## Other useful commands

```bash
npm test                    # 146 automated tests
npm run test:e2e -w client  # browser E2E (run `npm run build` first)
npm run backup -w server    # online DB snapshot
npm run build               # production build
docker compose up -d --build  # production mode (serves client + API on :4000)
```

Demo-mode note: payments and WhatsApp use clearly-labelled simulated providers
until real credentials are added — nothing fake is ever marked as real.
