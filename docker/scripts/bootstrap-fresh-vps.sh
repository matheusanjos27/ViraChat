#!/usr/bin/env bash
# Bootstrap do zero na VPS: schema do repo + (instruções) seed do admin.
# NÃO importa dados do Supabase Cloud — banco limpo.
#
# Pré: setup-supabase-vps.sh já rodou
#
# Uso:
#   bash /opt/ViraChat/docker/scripts/bootstrap-fresh-vps.sh
set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
VIRA_ROOT="${VIRA_ROOT:-/opt/ViraChat}"
VIRA_DOCKER="${VIRA_DOCKER:-$VIRA_ROOT/docker}"

find_db_container() {
  # Prefer container from /opt/supabase compose
  local id
  id="$(cd "$SUPABASE_DIR/docker" 2>/dev/null && docker compose ps -q db 2>/dev/null | head -1 || true)"
  if [ -n "${id:-}" ]; then
    echo "$id"
    return 0
  fi
  docker ps --format '{{.ID}} {{.Names}}' | awk '/(^|-)db($|-)|supabase.*db/ {print $1; exit}'
}

run_sql_file() {
  local file="$1"
  local cid="$2"
  # Executa dentro do container Postgres (evita Supavisor em 127.0.0.1:5432)
  docker exec -i "$cid" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
}

DB_CID="$(find_db_container || true)"
if [ -z "${DB_CID:-}" ]; then
  echo "Não achei o container do Postgres do Supabase."
  echo "Confira: cd $SUPABASE_DIR/docker && docker compose ps"
  exit 1
fi

echo "==> Postgres container: $DB_CID"
echo "==> Aplicando migrations (banco limpo / schema app)"
for f in "$VIRA_ROOT"/supabase/migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "  -> $(basename "$f")"
  run_sql_file "$f" "$DB_CID"
done

echo
echo "==> Schema OK."
echo
echo "Próximos passos:"
echo "  1. Chaves:"
echo "       grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD)=' $SUPABASE_DIR/docker/.env"
echo
echo "  2. Em $VIRA_DOCKER/.env:"
echo "       NEXT_PUBLIC_APP_URL=http://177.153.62.148:3000"
echo "       NEXT_PUBLIC_SUPABASE_URL=http://177.153.62.148:8000"
echo "       NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
echo "       SUPABASE_SERVICE_ROLE_KEY=..."
echo "       PLATFORM_ADMIN_EMAILS=seu@gmail.com"
echo "       PLATFORM_ADMIN_PASSWORD=senha-forte"
echo
echo "  3. Rebuild:"
echo "       cd $VIRA_DOCKER"
echo "       docker compose -f docker-compose.ip.yml build --no-cache virachat"
echo "       docker compose -f docker-compose.ip.yml up -d virachat"
echo
echo "  4. Seed admin:"
echo "       docker run --rm --env-file $VIRA_DOCKER/.env \\"
echo "         -v $VIRA_ROOT/scripts/seed-platform-admin.mjs:/seed.mjs:ro \\"
echo "         -w /tmp node:22-alpine \\"
echo "         sh -c 'npm init -y >/dev/null 2>&1 && npm i @supabase/supabase-js@2 --silent && node /seed.mjs'"
