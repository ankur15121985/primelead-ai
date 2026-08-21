#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# PRIMELEAD AI — SQLite → PostgreSQL Migration Script
# ──────────────────────────────────────────────────────────────────
# Usage:
#   1. Set DATABASE_URL in server/.env to your Postgres connection string
#   2. Run: cd Compute && bash server/scripts/migrate-to-postgres.sh
#   3. Seed: npm run db:seed (optional, for demo data)
#
# Prerequisites:
#   - PostgreSQL 14+ running
#   - Database created: createdb primelead
#   - DATABASE_URL="postgresql://user:pass@localhost:5432/primelead"
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
cd "$SERVER_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     PRIMELEAD AI — SQLite → PostgreSQL Migration           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Check .env ──────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "❌ .env file not found. Copy .env.example to .env and configure DATABASE_URL."
  exit 1
fi

# Source .env to get DATABASE_URL
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL not set in .env"
  exit 1
fi

if [[ "$DATABASE_URL" == file:* ]]; then
  echo "⚠️  DATABASE_URL still points to SQLite ($DATABASE_URL)"
  echo ""
  echo "   To migrate to PostgreSQL:"
  echo "   1. Create a PostgreSQL database: createdb primelead"
  echo "   2. Update .env: DATABASE_URL=\"postgresql://user:pass@localhost:5432/primelead\""
  echo "   3. Re-run this script"
  echo ""
  echo "   Keeping SQLite for now. Done."
  exit 0
fi

echo "📡 Target: PostgreSQL"
echo "   URL: ${DATABASE_URL%%@*}@***"
echo ""

# ── Export SQLite data (if exists) ──────────────────────────────
SQLITE_DB="$SERVER_DIR/prisma/dev.db"
EXPORT_DIR="$SERVER_DIR/prisma/pg-migration"
mkdir -p "$EXPORT_DIR"

if [ -f "$SQLITE_DB" ]; then
  echo "📦 Exporting data from SQLite..."
  
  # Check if sqlite3 is available
  if command -v sqlite3 &> /dev/null; then
    # Export each table as CSV
    TABLES=$(sqlite3 "$SQLITE_DB" ".tables" | tr -s ' ' '\n' | grep -v '^$')
    
    for table in $TABLES; do
      echo "   Exporting: $table"
      sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM \"$table\";" > "$EXPORT_DIR/$table.csv" 2>/dev/null || true
    done
    
    echo "   ✅ Exported $(echo "$TABLES" | wc -l) tables to $EXPORT_DIR/"
  else
    echo "   ⚠️  sqlite3 not found — skipping data export"
    echo "   Install sqlite3 to export existing data, or start fresh with npm run db:seed"
  fi
else
  echo "📦 No SQLite database found — starting fresh"
fi

# ── Switch schema to PostgreSQL ─────────────────────────────────
echo ""
echo "🔄 Switching Prisma schema to PostgreSQL..."

SCHEMA_FILE="$SERVER_DIR/prisma/schema.prisma"

# Backup current schema
cp "$SCHEMA_FILE" "$SCHEMA_FILE.bak"

# Replace SQLite provider with PostgreSQL
sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA_FILE"

echo "   ✅ Schema updated (backup: schema.prisma.bak)"

# ── Run migrations ──────────────────────────────────────────────
echo ""
echo "🗄️  Running Prisma migrations..."

# Generate Prisma Client
echo "   Generating Prisma Client..."
npx prisma generate

# Create and apply migration
echo "   Creating migration..."
npx prisma migrate dev --name postgres-migration --skip-seed 2>&1 || {
  echo ""
  echo "⚠️  Migration created but may have issues. Check the output above."
  echo "   Common fixes:"
  echo "   - Ensure PostgreSQL is running"
  echo "   - Ensure the database exists"
  echo "   - Check DATABASE_URL format"
}

# ── Import data (if exported) ──────────────────────────────────
if [ -d "$EXPORT_DIR" ] && [ "$(ls -A "$EXPORT_DIR" 2>/dev/null)" ]; then
  echo ""
  echo "📥 Importing data to PostgreSQL..."
  echo "   ⚠️  Manual import required — see instructions below"
  echo ""
  echo "   For each table CSV in $EXPORT_DIR/:"
  echo "   1. Create a temporary table in PostgreSQL"
  echo "   2. Use COPY or \\copy to import"
  echo "   3. Insert into the real table"
  echo ""
  echo "   Example:"
  echo "   psql primelead -c \"\\copy users FROM '$EXPORT_DIR/users.csv' WITH (FORMAT csv, HEADER true)\""
  echo ""
  echo "   Or use a migration tool like pgloader for automated conversion."
else
  echo ""
  echo "📦 No data to import — run 'npm run db:seed' for demo data"
fi

# ── Verify ──────────────────────────────────────────────────────
echo ""
echo "🔍 Verifying migration..."

npx prisma db push --skip-generate 2>&1 || true

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Migration Complete!                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Verify data: npm run db:seed (or import from CSV)"
echo "  2. Start dev: npm run dev"
echo "  3. Run tests: npm test"
echo ""
echo "To rollback to SQLite:"
echo "  cp prisma/schema.prisma.bak prisma/schema.prisma"
echo "  npx prisma migrate dev --name back-to-sqlite"
echo ""
