#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# PRIMELEAD AI — Health Check Script
# Checks API, database, Redis, and disk usage
# Usage: bash scripts/health-check.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

API_PORT="${API_PORT:-3001}"
COMPOSE_FILE="docker-compose.prod.yml"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "PRIMELEAD AI — Health Check"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── API Health ───────────────────────────────────────────────
echo -n "  API Server:       "
if RESP=$(curl -sf "http://localhost:$API_PORT/api/health" 2>/dev/null); then
    STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✓ $STATUS${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
fi

# ── Docker Services ─────────────────────────────────────────
echo ""
echo "  Docker Services:"
docker compose -f "$COMPOSE_FILE" ps --format "    {{.Name}}: {{.Status}}" 2>/dev/null || echo "    Docker Compose not available"

# ── Database ────────────────────────────────────────────────
echo ""
echo -n "  PostgreSQL:       "
if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U primelead 2>/dev/null | grep -q "accepting"; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Not connected${NC}"
fi

# ── Redis ───────────────────────────────────────────────────
echo -n "  Redis:            "
if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${YELLOW}⚠ Not connected (optional)${NC}"
fi

# ── Disk Usage ──────────────────────────────────────────────
echo ""
echo "  Disk Usage:"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')
echo "    Root:     ${DISK_USAGE}% used (${DISK_AVAIL} available)"

if [ -d "./backups" ]; then
    BACKUP_COUNT=$(ls -1 ./backups/*.sql.gz 2>/dev/null | wc -l)
    BACKUP_SIZE=$(du -sh ./backups 2>/dev/null | cut -f1)
    echo "    Backups:  $BACKUP_COUNT files ($BACKUP_SIZE)"
fi

# ── Docker Volumes ──────────────────────────────────────────
echo ""
echo "  Docker Volumes:"
docker volume ls --format "    {{.Name}}" 2>/dev/null | grep primelead || echo "    No primelead volumes found"

# ── Summary ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Checked at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
