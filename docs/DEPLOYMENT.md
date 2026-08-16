# PRIMELEAD AI — Production Deployment Guide

Phase 16. Everything below was verified against the real build: the compiled
server (`node dist/index.js`) boots and serves the built client, and the
Docker image builds, runs `prisma migrate deploy` on first start (46 tables),
and passes health + SPA deep-link checks.

## Architecture

```
                        ┌──────────────────────────────┐
   Browser  ──HTTPS──►  │  Reverse proxy / LB (TLS)    │
                        │  (nginx / Caddy / Cloud LB)  │
                        └──────────────┬───────────────┘
                                       │ :4000
                        ┌──────────────▼───────────────┐
                        │   primelead:api (container)  │
                        │   - Express API (/api/v1)    │
                        │   - gzip compression         │
                        │   - serves built client (SPA)│
                        │   - SQLite on /app/server/data│
                        └──────────────┬───────────────┘
                                       │
                          volume: primelead-data
```

One container runs the whole product: the API serves the compiled client
(guarded static mount in `server/src/app.ts`) with an SPA fallback for deep
links. SQLite is the datasource — the volume keeps data across rebuilds.

## Option A — Docker (recommended)

```bash
# 1. Build and start
docker compose up -d --build

# 2. Verify
curl http://localhost:4000/api/health          # {"status":"ok",...}
curl -I http://localhost:4000/                  # 200, SPA index.html

# 3. Logs / stop
docker compose logs -f api
docker compose down
```

Migrations run automatically on every start (`prisma migrate deploy` is
idempotent), so upgrades are: `git pull && docker compose up -d --build`.

### Required environment (docker-compose.yml)

| Variable | Purpose | Example |
|---|---|---|
| `JWT_SECRET` | MFA challenge signing (generate 48 random bytes hex) | `openssl rand -hex 48` |
| `CLIENT_ORIGIN` | CORS allowlist (comma-separated) | `https://crm.example.com` |
| `SUPER_ADMIN_EMAILS` | Emails allowed into `/admin` (empty = off) | `you@example.com` |
| `COOKIE_SECURE` | Must be `true` behind TLS | `true` |
| `APP_URL` | Public base URL for links/emails | `https://crm.example.com` |
| `PAYMENT_WEBHOOK_SECRET` | Shared secret for demo-provider webhooks | random string |
| `TRIAL_DAYS` | Free-trial length | `14` |

### Optional environment

- **AI** — `AI_PROVIDER` (openai/anthropic/gemini/custom), `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`.
- **Payments** — `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (or Stripe/Cashfree equivalents + webhook secrets). Without keys the app runs in DEMO mode; payments only ever settle via a verified server-side webhook.
- **Email** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

## Option B — Bare metal / VM (no Docker)

```bash
# From the repo root
npm ci
npm run build                        # server tsc → server/dist, client vite → client/dist
cd server
npx prisma migrate deploy            # apply schema (idempotent)
NODE_ENV=production JWT_SECRET="$(openssl rand -hex 48)" \
  CLIENT_ORIGIN=https://crm.example.com COOKIE_SECURE=true \
  node dist/index.js                 # serves API + built client on :4000
```

Or `npm run start:prod -w server`. Put it behind systemd/pm2 with the reverse
proxy terminating TLS.

## TLS, headers and the reverse proxy

- Terminate TLS at the proxy; set `COOKIE_SECURE=true` so the session cookie
  is only sent over HTTPS.
- Helmet already sets `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy` etc. and (in production) a CSP. Add `Strict-Transport-Security`
  at the proxy: `add_header Strict-Transport-Security "max-age=31536000"`.
- The app trusts the proxy (`trust proxy: 1`), so rate limiting sees real
  client IPs — make sure the proxy forwards `X-Forwarded-For`.

## Backups & recovery

SQLite is a single file: `server/data/primelead.db` (volume
`primelead-data`).

- **Backup:** stop-write consistency is easiest with the SQLite online backup:
  ```bash
  docker exec <container> sh -c "cd /app/server/data && sqlite3 primelead.db '.backup /tmp/primelead-backup.db'"  # or:
  docker cp <container>:/app/server/data/primelead.db ./backup-$(date +%F).db
  ```
- **Restore:** stop the container, copy the backup over the volume file,
  start again. Restore to the same or newer app version.
- **Retention:** keep daily backups for 14 days and a weekly for 8 weeks;
  verify a restore at least monthly (spec §58).
- RPO is the interval between backups (up to the last transaction if you
  script `.backup` frequently); RTO is your restore time — test it.

## Upgrading

```bash
git pull
docker compose up -d --build     # migrate deploy runs on boot
```

Migrations are forward-only (`prisma migrate deploy`). Roll back by restoring
a pre-upgrade backup. Never edit production schema by hand.

## Moving to PostgreSQL

The current schema is pinned to SQLite (`provider = "sqlite"`) and migrations
are SQLite SQL. Postgres is a supported direction, not yet the default:

1. Change `provider` to `"postgresql"` in `server/prisma/schema.prisma`.
2. Generate Postgres migrations in a branch: `npx prisma migrate dev --name init-pg` against a scratch Postgres.
3. Review the generated SQL (money is `Int` paise — exact, portable).
4. Point `DATABASE_URL` at the Postgres DSN, add a `db` service to compose, `npx prisma migrate deploy`.

No business code changes are expected — every entity is tenant-scoped by
`orgId`, money is integer paise, and enums are strings.

## Platform admin (super-admin)

The `/admin` console is only reachable by emails listed in
`SUPER_ADMIN_EMAILS`. Leave it empty in production unless you need it — the
admin area is entirely disabled then (safe default).

## Observability

- `/api/health` — liveness for the proxy healthcheck (container has one wired
  up).
- Request IDs on every response (`X-Request-Id` + `error.requestId`) for
  support traceability.
- Structured logs go to stdout (capture via `docker compose logs` or your log
  driver). The admin System page shows the live error feed.
