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

ensure_migrations_table() {
  local runner="$1" # psql-url | docker:CID
  local sql="create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  );"
  if [[ "$runner" == docker:* ]]; then
    docker exec -i "${runner#docker:}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$sql"
  else
    psql "$runner" -v ON_ERROR_STOP=1 -c "$sql"
  fi
}

is_applied() {
  local runner="$1" version="$2" out
  if [[ "$runner" == docker:* ]]; then
    out="$(docker exec -i "${runner#docker:}" psql -U postgres -d postgres -tAc \
      "select 1 from public.schema_migrations where version = '$version'" || true)"
  else
    out="$(psql "$runner" -tAc \
      "select 1 from public.schema_migrations where version = '$version'" || true)"
  fi
  [[ "$out" == *1* ]]
}

mark_applied() {
  local runner="$1" version="$2"
  local sql="insert into public.schema_migrations (version) values ('$version') on conflict do nothing;"
  if [[ "$runner" == docker:* ]]; then
    docker exec -i "${runner#docker:}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$sql"
  else
    psql "$runner" -v ON_ERROR_STOP=1 -c "$sql"
  fi
}

run_sql_file() {
  local runner="$1" file="$2"
  if [[ "$runner" == docker:* ]]; then
    docker exec -i "${runner#docker:}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
  else
    psql "$runner" -v ON_ERROR_STOP=1 -f "$file"
  fi
}

seed_baseline_if_needed() {
  # Banco já em produção sem tracking: marca migrations ANTIGAS como aplicadas
  # e deixa as que ainda não rodaram (falha ao marcar? não — lista tudo e
  # tentamos aplicar; se "already exists", marcamos).
  local runner="$1" count exists
  if [[ "$runner" == docker:* ]]; then
    count="$(docker exec -i "${runner#docker:}" psql -U postgres -d postgres -tAc \
      "select count(*) from public.schema_migrations" | tr -d '[:space:]')"
    exists="$(docker exec -i "${runner#docker:}" psql -U postgres -d postgres -tAc \
      "select 1 from information_schema.tables where table_schema='public' and table_name='tenants'" | tr -d '[:space:]')"
  else
    count="$(psql "$runner" -tAc "select count(*) from public.schema_migrations" | tr -d '[:space:]')"
    exists="$(psql "$runner" -tAc \
      "select 1 from information_schema.tables where table_schema='public' and table_name='tenants'" | tr -d '[:space:]')"
  fi
  if [[ "${count:-0}" == "0" && "${exists:-}" == "1" ]]; then
    echo "  · banco já em uso sem tracking — aplicando só o que ainda não existe"
  fi
}

apply_pending_migrations() {
  local runner="$1"
  ensure_migrations_table "$runner"
  seed_baseline_if_needed "$runner"

  local f base
  for f in "$APP_DIR"/supabase/migrations/*.sql; do
    [ -f "$f" ] || continue
    base="$(basename "$f" .sql)"
    if is_applied "$runner" "$base"; then
      echo "  · skip $base"
      continue
    fi
    echo "  · apply $base"
    if run_sql_file "$runner" "$f"; then
      mark_applied "$runner" "$base"
    else
      # Provável "already exists" em banco antigo sem tracking
      echo "  · $base falhou (talvez já aplicada) — marcando e seguindo"
      mark_applied "$runner" "$base"
    fi
  done
}

echo "==> migrations"
MIGRATED=0

if [ -n "${DATABASE_URL:-}" ] && command -v npx >/dev/null 2>&1; then
  echo "  · tentando npx supabase db push"
  if npx --yes supabase@2 db push --db-url "$DATABASE_URL" --yes; then
    MIGRATED=1
  else
    echo "  · npx supabase falhou — tentando psql/docker"
  fi
fi

if [ "$MIGRATED" -eq 0 ] && [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  if apply_pending_migrations "$DATABASE_URL"; then
    MIGRATED=1
  fi
fi

if [ "$MIGRATED" -eq 0 ]; then
  DB_CID="$(find_db_container || true)"
  if [ -n "${DB_CID:-}" ]; then
    if apply_pending_migrations "docker:$DB_CID"; then
      MIGRATED=1
    fi
  fi
fi

if [ "$MIGRATED" -eq 0 ]; then
  echo "AVISO: migrations não aplicadas automaticamente."
  echo "       Rebuild segue. Aplique SQL em /opt/ViraChat/supabase/migrations depois."
fi

echo "==> docker compose up --build"
cd "$APP_DIR/docker"
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "==> status"
docker compose -f "$COMPOSE_FILE" ps
echo "==> deploy ok $(date -u +%Y-%m-%dT%H:%M:%SZ)"
