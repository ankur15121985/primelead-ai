#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# PRIMELEAD AI — SSL Certificate Setup (Let's Encrypt)
# Installs certbot, obtains SSL cert, configures auto-renewal
# Usage: sudo bash scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arguments
DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}Usage: sudo bash scripts/setup-ssl.sh <domain> <email>${NC}"
    echo "Example: sudo bash scripts/setup-ssl.sh primelead.ai admin@primelead.ai"
    exit 1
fi

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           PRIMELEAD AI — SSL Certificate Setup           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "  Domain: $DOMAIN"
echo "  Email:  $EMAIL"
echo ""

# ── Step 1: Install certbot ─────────────────────────────────
echo -e "${YELLOW}[1/5] Installing certbot...${NC}"

if command -v certbot &>/dev/null; then
    echo "  ✓ certbot already installed"
else
    if command -v apt-get &>/dev/null; then
        apt-get update -qq && apt-get install -y -qq certbot 2>&1 | tail -2
    elif command -v yum &>/dev/null; then
        yum install -y epel-release && yum install -y certbot 2>&1 | tail -2
    elif command -v apk &>/dev/null; then
        apk add --no-cache certbot 2>&1 | tail -2
    else
        echo -e "${RED}✗ Cannot install certbot. Install manually: https://certbot.eff.org/instructions${NC}"
        exit 1
    fi
    echo "  ✓ certbot installed"
fi

# ── Step 2: Stop nginx temporarily ───────────────────────────
echo -e "${YELLOW}[2/5] Stopping nginx for certificate validation...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true
echo "  ✓ nginx stopped"

# ── Step 3: Obtain certificate ──────────────────────────────
echo -e "${YELLOW}[3/5] Obtaining SSL certificate from Let's Encrypt...${NC}"

# Create webroot for HTTP challenge
mkdir -p /var/www/certbot

# Stop anything on port 80 temporarily
fuser -k 80/tcp 2>/dev/null || true

# Get certificate
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ SSL certificate obtained successfully${NC}"
else
    echo -e "  ${RED}✗ Failed to obtain certificate${NC}"
    echo "  Make sure port 80 is accessible from the internet."
    echo "  Check DNS records point to this server."
    exit 1
fi

# ── Step 4: Update nginx config ─────────────────────────────
echo -e "${YELLOW}[4/5] Updating nginx configuration...${NC}"

# Update domain in nginx config
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/primelead.conf

# Copy certificates to Docker volume
mkdir -p nginx/certs
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" nginx/certs/fullchain.pem
cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" nginx/certs/privkey.pem

echo -e "  ${GREEN}✓ Nginx config updated${NC}"

# ── Step 5: Setup auto-renewal ──────────────────────────────
echo -e "${YELLOW}[5/5] Setting up auto-renewal...${NC}"

# Create renewal script
cat > scripts/renew-ssl.sh << 'RENEW_EOF'
#!/bin/bash
# Auto-renew SSL certificate and reload nginx
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

DOMAIN=$(grep -oP 'server_name \K[^ ;]+' nginx/primelead.conf | head -1)

# Renew certificate
certbot renew --quiet --deploy-hook "echo 'Certificate renewed'"

# Copy new certs
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" nginx/certs/fullchain.pem
cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" nginx/certs/privkey.pem

# Reload nginx
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload 2>/dev/null || \
    docker compose -f docker-compose.prod.yml restart nginx

echo "[$(date)] SSL certificate renewed for $DOMAIN" >> logs/ssl-renewal.log
RENEW_EOF

chmod +x scripts/renew-ssl.sh

# Add cron job for auto-renewal (twice daily)
CRON_CMD="0 3,15 * * * cd $SCRIPT_DIR && bash scripts/renew-ssl.sh >> logs/ssl-renewal.log 2>&1"
(crontab -l 2>/dev/null | grep -v "renew-ssl"; echo "$CRON_CMD") | crontab -

mkdir -p logs
echo -e "  ${GREEN}✓ Auto-renewal configured (runs twice daily)${NC}"

# ── Restart services ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}Restarting services...${NC}"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  SSL setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Certificate details:"
echo "    Domain:   $DOMAIN"
echo "    Cert:     /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "    Key:      /etc/letsencrypt/live/$DOMAIN/privkey.pem"
echo "    Renewal:  Twice daily via cron"
echo ""
echo "  Test your SSL:"
echo "    curl -I https://$DOMAIN"
echo "    openssl s_client -connect $DOMAIN:443 -servername $DOMAIN"
echo ""
echo "  Check renewal status:"
echo "    certbot certificates"
echo "    cat logs/ssl-renewal.log"
echo ""
