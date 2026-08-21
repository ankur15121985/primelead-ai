# ═══════════════════════════════════════════════════════════════
# PRIMELEAD AI — Production Dockerfile
# Multi-stage build: client → server → production
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Build client ───────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts
COPY client/ ./
RUN npm run build

# ── Stage 2: Build server ───────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production runtime ─────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install curl for healthcheck + dumb-init for signal handling
RUN apk add --no-cache curl dumb-init

# Security: run as non-root
RUN addgroup -g 1001 primelead && \
    adduser -D -u 1001 -G primelead primelead

# Copy server artifacts
COPY --from=server-builder --chown=primelead:primelead /app/server/package*.json ./
COPY --from=server-builder --chown=primelead:primelead /app/server/node_modules ./node_modules
COPY --from=server-builder --chown=primelead:primelead /app/server/dist ./dist
COPY --from=server-builder --chown=primelead:primelead /app/server/prisma ./prisma

# Copy seed file (optional, for db:seed)
COPY --from=server-builder --chown=primelead:primelead /app/server/src/seed.ts ./src/seed.ts 2>/dev/null || true

# Copy client build
COPY --from=client-builder --chown=primelead:primelead /app/client/dist ./client/dist

# Create uploads directory
RUN mkdir -p /app/uploads && chown primelead:primelead /app/uploads

# Generate Prisma client for production
RUN npx prisma generate

# Switch to non-root user
USER primelead

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Use dumb-init to properly handle PID 1 signals
ENTRYPOINT ["dumb-init", "--"]

# Start: push schema + run server
CMD ["sh", "-c", "npx prisma db push --skip-generate 2>/dev/null; node dist/index.js"]
