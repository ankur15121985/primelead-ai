#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# PRIMELEAD AI — Database Backup Script
# Usage: bash scripts/backup.sh
# Cron:  0 2 * * * cd /path/to/Compute && bash scripts/backup.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
COMPOSE_FILE="docker-compose.prod.yml"
DB_NAME="primelead"
DB_USER="primelead"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}PRIMELEAD AI — Database Backup${NC}"
echo "  Timestamp: $TIMESTAMP"
echo "  Output:    $BACKUP_FILE"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump database
echo -e "\n${YELLOW}[1/3] Dumping database...${NC}"
docker compose -f "$COMPOSE_FILE" exec -T db \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
    | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "  ${GREEN}✓ Backup created: $FILESIZE${NC}"

# Verify backup
echo -e "\n${YELLOW}[2/3] Verifying backup...${NC}"
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo -e "  ${GREEN}✓ Backup integrity verified${NC}"
else
    echo -e "  ${RED}✗ Backup integrity check failed!${NC}"
    exit 1
fi

# Clean old backups
echo -e "\n${YELLOW}[3/3] Cleaning backups older than $KEEP_DAYS days...${NC}"
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
echo "  Removed $DELETED old backup(s)"

# Summary
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Backup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Total backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | awk '{print "    " $NF " (" $5 ")"}'
echo ""
echo "  Restore command:"
echo "    gunzip -c $BACKUP_FILE | docker compose -f $COMPOSE_FILE exec -T db psql -U $DB_USER -d $DB_NAME"
echo ""
