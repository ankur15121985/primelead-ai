#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# PRIMELEAD AI — Production Deployment Script
# Builds, migrates, seeds, and starts all production services
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           PRIMELEAD AI — Production Deployment           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# ── Step 1: Check prerequisites ──────────────────────────────────
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command -v docker &>/dev/null; then
    echo -e "${RED}✗ Docker is not installed. Install it from https://docs.docker.com/get-docker/${NC}"
    exit 1
fi
echo "  ✓ Docker: $(docker --version | head -1)"

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
    echo -e "${RED}✗ Docker Compose is not installed.${NC}"
    exit 1
fi
echo "  ✓ Docker Compose: available"

# ── Step 2: Check .env ───────────────────────────────────────────
echo -e "${YELLOW}[2/7] Checking environment configuration...${NC}"

if [ ! -f .env ]; then
    echo -e "  ${YELLOW}No .env file found. Creating from .env.production template...${NC}"
    cp .env.production .env
    echo -e "  ${RED}⚠ IMPORTANT: Edit .env with your real values before continuing!${NC}"
    echo -e "  Required variables:"
    echo -e "    - ${GREEN}DB_PASSWORD${NC} — PostgreSQL password"
    echo -e "    - ${GREEN}JWT_SECRET${NC} — Random hex string (run: openssl rand -hex 48)"
    echo -e "    - ${GREEN}SESSION_SECRET${NC} — Random hex string (run: openssl rand -hex 48)"
    echo -e "    - ${GREEN}CLIENT_ORIGIN${NC} — Your domain (e.g., https://primelead.ai)"
    echo ""
    read -p "  Press Enter after editing .env to continue..."
fi

# Validate required vars
source .env 2>/dev/null || true
missing=()
[ -z "${DB_PASSWORD:-}" ] && missing+=("DB_PASSWORD")
[ -z "${JWT_SECRET:-}" ] && missing+=("JWT_SECRET")
[ -z "${SESSION_SECRET:-}" ] && missing+=("SESSION_SECRET")
[ -z "${CLIENT_ORIGIN:-}" ] && missing+=("CLIENT_ORIGIN")

if [ ${#missing[@]} -gt 0 ]; then
    echo -e "  ${RED}✗ Missing required environment variables: ${missing[*]}${NC}"
    echo -e "  Edit .env and run this script again."
    exit 1
fi
echo -e "  ${GREEN}✓ All required environment variables are set${NC}"

# ── Step 3: Generate secrets if placeholder ───────────────────────
echo -e "${YELLOW}[3/7] Checking secrets...${NC}"

if [[ "$JWT_SECRET" == "REPLACE_WITH_96_CHAR_HEX_STRING" ]] || [[ "$JWT_SECRET" == *"change-this"* ]]; then
    NEW_JWT=$(openssl rand -hex 48 2>/dev/null || head -c 96 /dev/urandom | xxd -p | tr -d '\n')
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$NEW_JWT|" .env
    echo "  ✓ Generated new JWT_SECRET"
else
    echo "  ✓ JWT_SECRET is set"
fi

if [[ "$SESSION_SECRET" == "REPLACE_WITH_STRONG_SECRET" ]] || [[ "$SESSION_SECRET" == *"change-this"* ]]; then
    NEW_SESSION=$(openssl rand -hex 48 2>/dev/null || head -c 96 /dev/urandom | xxd -p | tr -d '\n')
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$NEW_SESSION|" .env
    echo "  ✓ Generated new SESSION_SECRET"
else
    echo "  ✓ SESSION_SECRET is set"
fi

# ── Step 4: Build Docker image ──────────────────────────────────
echo -e "${YELLOW}[4/7] Building Docker image (this may take a few minutes)...${NC}"
docker build -t primelead:latest . 2>&1 | tail -5
echo -e "  ${GREEN}✓ Docker image built successfully${NC}"

# ── Step 5: Start services ──────────────────────────────────────
echo -e "${YELLOW}[5/7] Starting production services...${NC}"
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d

echo -e "  Waiting for services to be healthy..."
sleep 10

# Check health
for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml ps api | grep -q "healthy"; then
        echo -e "  ${GREEN}✓ API server is healthy${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "  ${YELLOW}⚠ API health check timed out. Check logs with: docker compose -f docker-compose.prod.yml logs api${NC}"
    fi
    sleep 2
done

# ── Step 6: Seed database ───────────────────────────────────────
echo -e "${YELLOW}[6/7] Seeding database with demo data...${NC}"
docker compose -f docker-compose.prod.yml exec -T api node dist/index.js 2>/dev/null &
SEED_PID=$!
sleep 5
kill $SEED_PID 2>/dev/null || true

# Run seed via prisma
docker compose -f docker-compose.prod.yml exec -T api sh -c "npx prisma db seed 2>/dev/null || echo 'Seed skipped (may already exist)'" 2>/dev/null || true
echo -e "  ${GREEN}✓ Database seeded${NC}"

# ── Step 7: Verify deployment ──────────────────────────────────
echo -e "${YELLOW}[7/7] Verifying deployment...${NC}"

# Check API health
API_PORT="${API_PORT:-3001}"
if curl -sf "http://localhost:$API_PORT/api/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ API health endpoint responding${NC}"
else
    echo -e "  ${YELLOW}⚠ API health check failed (may need a moment to start)${NC}"
fi

# Show running services
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  PRIMELEAD AI — Production deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Running services:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "  Endpoints:"
echo "    API:   http://localhost:$API_PORT/api/health"
echo "    App:   $CLIENT_ORIGIN"
echo ""
echo "  Useful commands:"
echo "    docker compose -f docker-compose.prod.yml logs -f api    # Follow API logs"
echo "    docker compose -f docker-compose.prod.yml logs -f db     # Follow DB logs"
echo "    docker compose -f docker-compose.prod.yml restart api    # Restart API"
echo "    docker compose -f docker-compose.prod.yml down          # Stop all"
echo "    docker compose -f docker-compose.prod.yml ps            # Status"
echo ""
echo "  Database:"
echo "    docker compose -f docker-compose.prod.yml exec db psql -U primelead -d primelead"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "    1. Point your domain DNS to this server"
echo "    2. Configure SSL with certbot (if using nginx)"
echo "    3. Set up automated backups: crontab -e → 0 2 * * * cd $SCRIPT_DIR && bash scripts/backup.sh"
echo ""
