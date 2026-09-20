#!/usr/bin/env bash
# Backup diário do Postgres do Supabase self-host.
# Cron exemplo (root):
#   15 3 * * * /opt/ViraChat/docker/scripts/backup-supabase-pg.sh >> /var/log/vira-pg-backup.log 2>&1
set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/vira}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$SUPABASE_DIR/docker/.env" | cut -d= -f2-)"
LOCAL_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/pg-${STAMP}.sql.gz"

if ! command -v pg_dump >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y postgresql-client
fi

pg_dump "$LOCAL_URL" --no-owner --no-acl | gzip -c > "$OUT"
find "$BACKUP_DIR" -name 'pg-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "OK $OUT ($(du -h "$OUT" | cut -f1))"
