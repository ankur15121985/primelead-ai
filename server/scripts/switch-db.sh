#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# PRIMELEAD AI — Database Provider Switcher
# ──────────────────────────────────────────────────────────────────
# Quick switch between SQLite and PostgreSQL
#
# Usage:
#   bash server/scripts/switch-db.sh sqlite    # Switch to SQLite
#   bash server/scripts/switch-db.sh postgres  # Switch to PostgreSQL
#   bash server/scripts/switch-db.sh status    # Show current provider
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$SERVER_DIR/prisma/schema.prisma"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_status() {
  local provider
  provider=$(grep -oP 'provider\s*=\s*"\K[^"]+' "$SCHEMA_FILE" | head -1)
  
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║              PRIMELEAD AI — Database Status                ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  
  if [ "$provider" = "sqlite" ]; then
    echo -e "  Current provider: ${GREEN}SQLite${NC}"
    echo "  Database file: server/prisma/dev.db"
    echo "  Connection: file:./dev.db"
  elif [ "$provider" = "postgresql" ]; then
    echo -e "  Current provider: ${BLUE}PostgreSQL${NC}"
    # Extract host from DATABASE_URL if available
    if [ -f "$SERVER_DIR/.env" ]; then
      local db_url
      db_url=$(grep '^DATABASE_URL=' "$SERVER_DIR/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
      if [ -n "$db_url" ]; then
        local host
        host=$(echo "$db_url" | grep -oP '@\K[^:/]+' || echo "unknown")
        echo "  Host: $host"
      fi
    fi
  else
    echo -e "  Current provider: ${YELLOW}Unknown ($provider)${NC}"
  fi
  echo ""
}

switch_to_sqlite() {
  echo ""
  echo "🔄 Switching to SQLite..."
  
  # Update schema
  sed -i 's/provider = "postgresql"/provider = "sqlite"/' "$SCHEMA_FILE"
  
  # Update .env if it exists
  if [ -f "$SERVER_DIR/.env" ]; then
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL="file:./dev.db"|' "$SERVER_DIR/.env"
  fi
  
  # Generate and migrate
  cd "$SERVER_DIR"
  npx prisma generate
  npx prisma migrate dev --skip-seed 2>&1 || true
  
  echo -e "  ${GREEN}✅ Switched to SQLite${NC}"
  echo ""
  echo "  Database file: server/prisma/dev.db"
  echo "  Run 'npm run db:seed' to populate demo data"
  echo ""
}

switch_to_postgres() {
  echo ""
  echo "🔄 Switching to PostgreSQL..."
  
  # Check if DATABASE_URL is set
  if [ -f "$SERVER_DIR/.env" ]; then
    local db_url
    db_url=$(grep '^DATABASE_URL=' "$SERVER_DIR/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    
    if [[ "$db_url" == file:* ]] || [ -z "$db_url" ]; then
      echo -e "  ${RED}❌ DATABASE_URL not configured for PostgreSQL${NC}"
      echo ""
      echo "  Please update server/.env:"
      echo '  DATABASE_URL="postgresql://user:pass@localhost:5432/primelead"'
      echo ""
      echo "  Then re-run this script."
      exit 1
    fi
  else
    echo -e "  ${RED}❌ server/.env not found${NC}"
    echo "  Create server/.env from .env.example and set DATABASE_URL"
    exit 1
  fi
  
  # Update schema
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA_FILE"
  
  # Generate and migrate
  cd "$SERVER_DIR"
  npx prisma generate
  npx prisma migrate dev --skip-seed 2>&1 || {
    echo ""
    echo -e "  ${YELLOW}⚠️  Migration had issues — check the output above${NC}"
  }
  
  echo -e "  ${GREEN}✅ Switched to PostgreSQL${NC}"
  echo ""
  echo "  Run 'npm run db:seed' to populate demo data (optional)"
  echo ""
}

# Main
case "${1:-status}" in
  sqlite|sql|lite|s)
    switch_to_sqlite
    ;;
  postgres|pg|postgresql|p)
    switch_to_postgres
    ;;
  status|st|s*)
    show_status
    ;;
  *)
    echo "Usage: $0 [sqlite|postgres|status]"
    echo ""
    echo "  sqlite    Switch to SQLite (default dev database)"
    echo "  postgres  Switch to PostgreSQL (requires DATABASE_URL)"
    echo "  status    Show current database provider"
    exit 1
    ;;
esac
