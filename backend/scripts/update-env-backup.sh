#!/bin/bash
# Update the immutable .env backup
# Usage: sudo bash scripts/update-env-backup.sh

BACKUP="/home/ubuntu/.env-vault/backend.env.backup"
SOURCE="/home/ubuntu/tulip-saas/backend/.env"

if [ ! -f "$SOURCE" ]; then
  echo "ERROR: Source .env not found at $SOURCE"
  exit 1
fi

echo "Unlocking backup..."
chattr -i "$BACKUP"

echo "Copying current .env to backup..."
cp "$SOURCE" "$BACKUP"
chmod 400 "$BACKUP"

echo "Locking backup..."
chattr +i "$BACKUP"

echo "Done. Backup updated and locked."
echo ""
echo "Verify:"
lsattr "$BACKUP"
