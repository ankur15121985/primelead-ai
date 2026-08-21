#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# PRIMELEAD AI — MVP Startup Script
# Runs the full application: database setup, migrations, server + client
# ═══════════════════════════════════════════════════════════════════════

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           PRIMELEAD AI — Full-Stack CRM SaaS             ║"
echo "║                    MVP Launch Script                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}[1/7] Checking Node.js version...${NC}"
NODE_VERSION=$(node -v)
echo "  Node.js: $NODE_VERSION"

echo -e "${YELLOW}[2/7] Installing dependencies...${NC}"
npm install --legacy-peer-deps 2>/dev/null || npm install

echo -e "${YELLOW}[3/7] Setting up database...${NC}"
cd server

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo -e "  Creating .env from template..."
  cat > .env << 'EOF'
DATABASE_URL="file:./dev.db"
PORT=3001
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
SESSION_SECRET="mvp-dev-secret-change-in-production"
JWT_SECRET="mvp-dev-jwt-secret-change-in-production"
PAYMENT_WEBHOOK_SECRET="test-webhook-secret"
SUPER_ADMIN_EMAILS="admin@primelead.ai"
API_RATE_LIMIT=100000
LOGIN_RATE_LIMIT=500
LOGIN_MAX_ATTEMPTS=10
LOGIN_LOCK_MINUTES=15
EOF
fi

echo "  Running Prisma migrations..."
npx prisma generate 2>/dev/null || npx prisma generate
npx prisma db push --skip-generate 2>/dev/null || npx prisma db push --skip-generate

cd ..

echo -e "${YELLOW}[4/7] Building client...${NC}"
cd client
npm install --legacy-peer-deps 2>/dev/null || npm install

echo -e "${YELLOW}[5/7] Starting development servers...${NC}"
echo ""

# Start server in background
echo -e "  ${GREEN}Starting API server on http://localhost:3001${NC}"
cd ../server
PORT=3001 npx tsx watch src/index.ts &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo -e "  ${GREEN}Starting client on http://localhost:5173${NC}"
cd ../client
npm run dev &
CLIENT_PID=$!

sleep 2

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 MVP is now running!                      ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Client:     http://localhost:5173                       ║${NC}"
echo -e "${GREEN}║  API:        http://localhost:3001                       ║${NC}"
echo -e "${GREEN}║  WebSocket:  ws://localhost:3001/ws/signaling            ║${NC}"
echo -e "${GREEN}║  Health:     http://localhost:3001/api/health             ║${NC}"
echo -e "${GREEN}║  OpenAPI:    server/docs/openapi.yaml                    ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Demo login: admin@primelead.ai / password123            ║${NC}"
echo -e "${GREEN}║  SMS webhook: POST http://localhost:3001/webhooks/sms    ║${NC}"
echo -e "${GREEN}║  SMS status:  POST http://localhost:3001/webhooks/sms/status║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${RED}Shutting down servers...${NC}"
  kill $SERVER_PID 2>/dev/null || true
  kill $CLIENT_PID 2>/dev/null || true
  wait
  echo -e "${GREEN}Done.${NC}"
}

trap cleanup EXIT INT TERM

wait
