# ── PRIMELEAD AI — single-container build ──────────────────────────────
# The API serves the built client (guarded static mount in server/src/app.ts),
# so one container runs the whole product. SQLite is the datasource; mount a
# volume at /app/server/data for persistence (see docker-compose.yml).

# 1. Install workspace dependencies (root npm workspaces hoist to ./node_modules)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

# 2. Build server (tsc → server/dist) and client (vite → client/dist)
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client is generated for SQLite during install; regenerate to be safe.
RUN cd server && npx prisma generate && npm run build && cd ../client && npm run build

# 3. Runtime — node_modules (kept whole so `prisma migrate deploy` works),
#    compiled server, prisma schema/migrations, and the built client.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/client/dist ./client/dist

# SQLite lives on a volume so data survives container rebuilds.
RUN mkdir -p /app/server/data
ENV DATABASE_URL="file:/app/server/data/primelead.db"

EXPOSE 4000
WORKDIR /app/server
# Apply pending migrations, then boot the compiled API. Migrations are
# idempotent — safe on every container start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
