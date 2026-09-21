#!/usr/bin/env bash
# Roda NA VPS: git pull → migrations → rebuild containers
#   bash /opt/ViraChat/docker/scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ViraChat}"
BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$APP_DIR"

echo "==> git fetch/reset $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# Carrega só DATABASE_URL do .env (evita source quebrado com caracteres especiais)
if [ -f "$APP_DIR/docker/.env" ]; then
  DATABASE_URL="$(
    grep -E '^DATABASE_URL=' "$APP_DIR/docker/.env" | head -n1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//'
  )"
  export DATABASE_URL
fi

find_db_container() {
  local id
  if [ -d /opt/supabase/docker ]; then
    id="$(cd /opt/supabase/docker && docker compose ps -q db 2>/dev/null | head -1 || true)"
    if [ -n "${id:-}" ]; then
      echo "$id"
      return 0
    fi
  fi
  docker ps --format '{{.ID}} {{.Names}}' \
    | awk '/supabase.*db|(^|-)db($|-)/ {print $1; exit}'
}

# 127.0.0.1:5432 no self-host costuma ser Supavisor (ENOIDENTIFIER) — use o container db.
is_supavisor_url() {
  local url="${1:-}"
  [[ "$url" == *"127.0.0.1:5432"* || "$url" == *"localhost:5432"* ]]
}

ensure_migrations_table() {
  local runner="$1"
  local sql="create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  );"
  docker exec -i "$runner" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$sql"
}

is_applied() {
  local runner="$1" version="$2" out
  out="$(docker exec -i "$runner" psql -U postgres -d postgres -tAc \
    "select 1 from public.schema_migrations where version = '$version'" || true)"
  [[ "$out" == *1* ]]
}

mark_applied() {
  local runner="$1" version="$2"
  docker exec -i "$runner" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
    "insert into public.schema_migrations (version) values ('$version') on conflict do nothing;"
}

run_sql_file() {
  local runner="$1" file="$2"
  docker exec -i "$runner" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
}

looks_already_applied() {
  local err="$1"
  grep -qiE 'already exists|duplicate key|multiple primary keys' <<<"$err"
}

apply_pending_migrations() {
  local runner="$1"
  ensure_migrations_table "$runner"

  local f base err
  for f in "$APP_DIR"/supabase/migrations/*.sql; do
    [ -f "$f" ] || continue
    base="$(basename "$f" .sql)"
    if is_applied "$runner" "$base"; then
      echo "  · skip $base"
      continue
    fi
    echo "  · apply $base"
    if err="$(run_sql_file "$runner" "$f" 2>&1)"; then
      echo "$err" | tail -n 3
      mark_applied "$runner" "$base"
    else
      echo "$err" | tail -n 8
      if looks_already_applied "$err"; then
        echo "  · $base já no banco — marcando"
        mark_applied "$runner" "$base"
      else
        echo "ERRO real em $base — abortando migrations"
        return 1
      fi
    fi
  done
}

echo "==> migrations"
MIGRATED=0
DB_CID="$(find_db_container || true)"

if [ -n "${DB_CID:-}" ]; then
  echo "  · via container db ($DB_CID)"
  if apply_pending_migrations "$DB_CID"; then
    MIGRATED=1
  fi
elif [ -n "${DATABASE_URL:-}" ] && ! is_supavisor_url "$DATABASE_URL"; then
  echo "  · sem container db; DATABASE_URL direta (não-localhost)"
  if command -v npx >/dev/null 2>&1; then
    if npx --yes supabase@2 db push --db-url "$DATABASE_URL" --yes; then
      MIGRATED=1
    fi
  fi
else
  echo "  · AVISO: DATABASE_URL em 127.0.0.1:5432 é Supavisor — precisa do container db"
fi

if [ "$MIGRATED" -eq 0 ]; then
  echo "AVISO: migrations não aplicadas automaticamente."
  echo "       Rebuild segue. Confira: docker ps | grep db"
fi

echo "==> docker compose up --build"
cd "$APP_DIR/docker"
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "==> status"
docker compose -f "$COMPOSE_FILE" ps
echo "==> deploy ok $(date -u +%Y-%m-%dT%H:%M:%SZ)"
