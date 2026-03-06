#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  tulip_backup_v2.sh
#
#  Creates a full backup of:
#  1. PostgreSQL database (pg_dump)
#  2. Backend source code (tar)
#
#  Uploads both to S3:
#    tulipglobal.org/backups/YYYY-MM-DD/db/tulip_LABEL_TIMESTAMP.sql.gz
#    tulipglobal.org/backups/YYYY-MM-DD/code/tulip_LABEL_TIMESTAMP.tar.gz
#
#  Usage:
#    ./tulip_backup_v2.sh phase5-complete
#    ./tulip_backup_v2.sh pre-migration
# ─────────────────────────────────────────────────────────────

set -e

LABEL=${1:-"manual"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/tmp/tulip_backups"
DB_URL="postgresql://benzer@localhost:5432/tulip"
S3_BUCKET="tulipglobal.org"
S3_REGION="ap-south-1"
PROJECT_DIR="/Users/benzer/tulip-saas"

mkdir -p "$BACKUP_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Tulip Backup — $LABEL"
echo "  Timestamp: $TIMESTAMP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Database backup ────────────────────────────────────────
DB_FILE="$BACKUP_DIR/tulip_${LABEL}_${TIMESTAMP}.sql.gz"
echo ""
echo "► Backing up PostgreSQL database..."
pg_dump "$DB_URL" | gzip > "$DB_FILE"
DB_SIZE=$(du -sh "$DB_FILE" | cut -f1)
echo "  ✔ Database dump: $DB_SIZE"

# ── 2. Code backup ────────────────────────────────────────────
CODE_FILE="$BACKUP_DIR/tulip_code_${LABEL}_${TIMESTAMP}.tar.gz"
echo ""
echo "► Backing up source code..."
tar -czf "$CODE_FILE" \
  --exclude="$PROJECT_DIR/backend/node_modules" \
  --exclude="$PROJECT_DIR/frontend/node_modules" \
  --exclude="$PROJECT_DIR/.git" \
  --exclude="$PROJECT_DIR/backend/.env" \
  -C "$(dirname $PROJECT_DIR)" \
  "$(basename $PROJECT_DIR)"
CODE_SIZE=$(du -sh "$CODE_FILE" | cut -f1)
echo "  ✔ Code archive: $CODE_SIZE"

# ── 3. Upload to S3 ───────────────────────────────────────────
echo ""
echo "► Uploading to S3 (tulipglobal.org)..."

S3_DB_KEY="backups/$DATE/db/tulip_${LABEL}_${TIMESTAMP}.sql.gz"
aws s3 cp "$DB_FILE" "s3://$S3_BUCKET/$S3_DB_KEY" \
  --region "$S3_REGION" \
  --sse AES256 \
  --quiet
echo "  ✔ DB   → s3://$S3_BUCKET/$S3_DB_KEY"

S3_CODE_KEY="backups/$DATE/code/tulip_code_${LABEL}_${TIMESTAMP}.tar.gz"
aws s3 cp "$CODE_FILE" "s3://$S3_BUCKET/$S3_CODE_KEY" \
  --region "$S3_REGION" \
  --sse AES256 \
  --quiet
echo "  ✔ Code → s3://$S3_BUCKET/$S3_CODE_KEY"

# ── 4. Cleanup local temp files ───────────────────────────────
rm -f "$DB_FILE" "$CODE_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backup complete — $LABEL"
echo "  s3://$S3_BUCKET/backups/$DATE/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
