#!/usr/bin/env bash
# Backup diário do Postgres do Supabase self-host (via docker exec, sem Supavisor).
#   15 3 * * * /opt/ViraChat/docker/scripts/backup-supabase-pg.sh >> /var/log/vira-pg-backup.log 2>&1
set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/vira}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/pg-${STAMP}.sql.gz"

DB_CID="$(cd "$SUPABASE_DIR/docker" 2>/dev/null && docker compose ps -q db 2>/dev/null | head -1 || true)"
if [ -z "${DB_CID:-}" ]; then
  DB_CID="$(docker ps --format '{{.ID}} {{.Names}}' | awk '/(^|-)db($|-)|supabase.*db/ {print $1; exit}')"
fi
if [ -z "${DB_CID:-}" ]; then
  echo "Container db do Supabase não encontrado"
  exit 1
fi

docker exec "$DB_CID" pg_dump -U postgres -d postgres --no-owner --no-acl | gzip -c > "$OUT"
find "$BACKUP_DIR" -name 'pg-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "OK $OUT ($(du -h "$OUT" | cut -f1))"
