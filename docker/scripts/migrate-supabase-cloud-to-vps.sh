#!/usr/bin/env bash
# Migra schema+dados do Supabase Cloud Free → Postgres self-host na VPS.
#
# Pré-requisitos:
#   - setup-supabase-vps.sh já rodou
#   - Variável CLOUD_DATABASE_URL = connection string do Dashboard Cloud
#     (Settings → Database → URI, modo session, senha do DB)
#   - Ou use --migrations-only para banco novo só com migrations do repo
#
# Exemplos:
#   export CLOUD_DATABASE_URL='postgresql://postgres.xxx:SENHA@aws-0-....pooler.supabase.com:5432/postgres'
#   bash docker/scripts/migrate-supabase-cloud-to-vps.sh
#
#   bash docker/scripts/migrate-supabase-cloud-to-vps.sh --migrations-only
set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
VIRA_ROOT="${VIRA_ROOT:-/opt/ViraChat}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/vira}"
MODE="${1:-full}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Lê senha do Postgres local
if [ -f "$SUPABASE_DIR/docker/.env" ]; then
  # shellcheck disable=SC1090
  set -a
  # só as vars que precisamos
  POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$SUPABASE_DIR/docker/.env" | cut -d= -f2-)"
  set +a
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

if [ "$MODE" = "--migrations-only" ]; then
  apply_repo_migrations
  echo "==> Migrations OK. Sem dump do Cloud."
  exit 0
fi

if [ -z "${CLOUD_DATABASE_URL:-}" ]; then
  echo "Defina CLOUD_DATABASE_URL (URI do Postgres do Supabase Cloud)"
  echo "Ou rode: $0 --migrations-only"
  exit 1
fi

need_psql
if ! command -v pg_dump >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y postgresql-client
fi

DUMP="$BACKUP_DIR/cloud-${STAMP}.sql"
echo "==> Dump Cloud → $DUMP"
pg_dump "$CLOUD_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  -f "$DUMP"

echo "==> Restore no Postgres local"
# Evita conflito com roles do self-host: restaura em public + auth schema cuidadosamente.
# Em caso de DB fresco do Supabase docker, preferir:
#   1) migrations-only no schema app, OU
#   2) dump só de dados das tabelas public
psql "$LOCAL_URL" -v ON_ERROR_STOP=0 -c "SELECT 1" >/dev/null

# Restore best-effort (self-host já tem auth/storage schemas)
psql "$LOCAL_URL" -v ON_ERROR_STOP=0 -f "$DUMP" || true

echo "==> Garante migrations do repo (idempotente)"
apply_repo_migrations || true

echo
echo "==> Migração concluída."
echo "Checklist:"
echo "  1. Atualize /opt/ViraChat/docker/.env (URL + ANON + SERVICE_ROLE)"
echo "  2. Auth → Site URL = URL do app (ex. http://IP:3000)"
echo "  3. Rebuild: cd /opt/ViraChat/docker && docker compose -f docker-compose.ip.yml build --no-cache virachat && docker compose -f docker-compose.ip.yml up -d virachat"
echo "  4. Login admin + tenant; testar /app/channels e webhook Evolution"
echo "  5. Quando OK, pause o projeto no Supabase Cloud Free"
echo
echo "Backup do dump: $DUMP"
