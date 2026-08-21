# Stage 1: Build client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --legacy-peer-deps
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy server
COPY --from=server-builder /app/server/package*.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/prisma ./prisma
COPY --from=server-builder /app/server/src/seed.ts ./src/seed.ts 2>/dev/null || true

# Copy client build
COPY --from=client-builder /app/client/dist ./client/dist

# Copy scripts
COPY scripts/ ./scripts/

# Create uploads directory
RUN mkdir -p /app/uploads

# Generate Prisma client for production
RUN npx prisma generate

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Start command: run migrations + seed + start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
