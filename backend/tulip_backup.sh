#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  tulip_backup.sh
#  Creates a timestamped backup of all critical Tulip files
#  before a phase transition.
#
#  Usage:
#    chmod +x tulip_backup.sh
#    ./tulip_backup.sh phase4
#    ./tulip_backup.sh phase5   (run before starting Phase 5)
# ─────────────────────────────────────────────────────────────

PHASE=${1:-"manual"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$HOME/tulip-backups/${PHASE}_${TIMESTAMP}"
BACKEND="/Users/benzer/tulip-saas/backend"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "  Tulip Backup — ${PHASE} — ${TIMESTAMP}"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Backing up to: $BACKUP_DIR"
echo ""

mkdir -p "$BACKUP_DIR"

# ── Files to backup ───────────────────────────────────────────
FILES=(
  "app.js"
  "prisma/schema.prisma"
  "prisma/client.js"
  "lib/client.js"
  "lib/merkle.js"
  "lib/blockchain.js"
  "routes/authRoutes.js"
  "routes/projectRoutes.js"
  "routes/fundingSourceRoutes.js"
  "routes/expenseRoutes.js"
  "routes/documentRoutes.js"
  "routes/auditRoutes.js"
  "src/routes/verify.js"
  "controllers/authController.js"
  "controllers/projectController.js"
  "controllers/fundingSourceController.js"
  "controllers/expenseController.js"
  "controllers/documentController.js"
  "middleware/authenticate.js"
  "middleware/authorize.js"
  "services/auditService.js"
  "services/batchAnchorService.js"
  "services/anchorScheduler.js"
  "src/services/anchorService.js"
)

PASS=0
SKIP=0

for FILE in "${FILES[@]}"; do
  SRC="$BACKEND/$FILE"
  DEST="$BACKUP_DIR/$FILE"
  DIR=$(dirname "$DEST")

  if [ -f "$SRC" ]; then
    mkdir -p "$DIR"
    cp "$SRC" "$DEST"
    echo "  ✔ $FILE"
    PASS=$((PASS + 1))
  else
    echo "  ⚠ SKIP (not found): $FILE"
    SKIP=$((SKIP + 1))
  fi
done

# ── Database dump ─────────────────────────────────────────────
echo ""
echo "Dumping database..."
pg_dump postgresql://benzer@localhost:5432/tulip \
  > "$BACKUP_DIR/tulip_db_${TIMESTAMP}.sql" 2>/dev/null

if [ $? -eq 0 ]; then
  SIZE=$(du -sh "$BACKUP_DIR/tulip_db_${TIMESTAMP}.sql" | cut -f1)
  echo "  ✔ Database dump: tulip_db_${TIMESTAMP}.sql ($SIZE)"
else
  echo "  ⚠ Database dump failed — check pg_dump is available"
fi

# ── Prisma migrations ─────────────────────────────────────────
if [ -d "$BACKEND/prisma/migrations" ]; then
  cp -r "$BACKEND/prisma/migrations" "$BACKUP_DIR/prisma/migrations"
  echo "  ✔ Prisma migrations folder"
fi

# ── .env (masked) ─────────────────────────────────────────────
if [ -f "$BACKEND/.env" ]; then
  sed 's/=.*/=***REDACTED***/' "$BACKEND/.env" > "$BACKUP_DIR/.env.masked"
  echo "  ✔ .env (values masked for safety)"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────"
echo "  ✔ Backed up: $PASS files"
echo "  ⚠ Skipped:  $SKIP files"
echo "  📁 Location: $BACKUP_DIR"
echo "──────────────────────────────────────────────"
echo ""
echo "To restore a file:"
echo "  cp $BACKUP_DIR/services/auditService.js $BACKEND/services/auditService.js"
echo ""
echo "To restore the full database:"
echo "  psql postgresql://benzer@localhost:5432/tulip < $BACKUP_DIR/tulip_db_${TIMESTAMP}.sql"
echo ""
