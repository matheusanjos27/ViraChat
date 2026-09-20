#!/usr/bin/env bash
# Schema do app no Postgres self-host.
# Padrão: banco NOVO (migrations only). Dump do Cloud é opcional (--from-cloud).
#
#   bash docker/scripts/migrate-supabase-cloud-to-vps.sh
#   bash docker/scripts/migrate-supabase-cloud-to-vps.sh --from-cloud   # precisa CLOUD_DATABASE_URL
#
# Preferido (do zero + admin): bootstrap-fresh-vps.sh
set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
VIRA_ROOT="${VIRA_ROOT:-/opt/ViraChat}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/vira}"
MODE="${1:---migrations-only}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [ -f "$SUPABASE_DIR/docker/.env" ]; then
  POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$SUPABASE_DIR/docker/.env" | cut -d= -f2-)"
fi

LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres}"

need_psql() {
  if ! command -v psql >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y postgresql-client
  fi
}

apply_repo_migrations() {
  echo "==> Aplicando migrations do repo ($VIRA_ROOT/supabase/migrations)"
  need_psql
  for f in "$VIRA_ROOT"/supabase/migrations/*.sql; do
    [ -f "$f" ] || continue
    echo "  -> $(basename "$f")"
    psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
}

if [ "$MODE" = "--migrations-only" ] || [ "$MODE" = "" ]; then
  apply_repo_migrations
  echo "==> Banco pronto (vazio). Rode bootstrap-fresh-vps.sh ou o seed do admin."
  echo "    Preferido: bash $VIRA_ROOT/docker/scripts/bootstrap-fresh-vps.sh"
  exit 0
fi

if [ "$MODE" != "--from-cloud" ]; then
  echo "Uso: $0 [--migrations-only|--from-cloud]"
  exit 1
fi

if [ -z "${CLOUD_DATABASE_URL:-}" ]; then
  echo "Defina CLOUD_DATABASE_URL para --from-cloud"
  echo "Ou use o caminho recomendado: bootstrap-fresh-vps.sh (banco limpo)"
  exit 1
fi

need_psql
if ! command -v pg_dump >/dev/null 2>&1; then
  apt-get install -y postgresql-client
fi

DUMP="$BACKUP_DIR/cloud-${STAMP}.sql"
echo "==> Dump Cloud → $DUMP"
pg_dump "$CLOUD_DATABASE_URL" --no-owner --no-acl --format=plain -f "$DUMP"
psql "$LOCAL_URL" -v ON_ERROR_STOP=0 -f "$DUMP" || true
apply_repo_migrations || true
echo "==> Restore Cloud concluído. Dump: $DUMP"
