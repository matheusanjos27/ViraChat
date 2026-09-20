#!/usr/bin/env bash
# Roda NA VPS: git pull → migrations → rebuild containers
# Chamado pelo GitHub Actions (push na main) ou manualmente:
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

echo "==> migrations"
if [ -n "${DATABASE_URL:-}" ]; then
  if command -v npx >/dev/null 2>&1; then
    npx --yes supabase db push --db-url "$DATABASE_URL" --yes
  else
    docker run --rm \
      --network host \
      -v "$APP_DIR:/work" \
      -w /work \
      -e SUPABASE_INTERNAL_IMAGE_REGISTRY= \
      supabase/cli:latest \
      db push --db-url "$DATABASE_URL" --yes
  fi
else
  echo "AVISO: DATABASE_URL não definida em docker/.env — pulando migrations."
  echo "       Defina a connection string do Postgres (Supabase self-host ou Cloud)."
fi

echo "==> docker compose up --build"
cd "$APP_DIR/docker"
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "==> status"
docker compose -f "$COMPOSE_FILE" ps
echo "==> deploy ok $(date -u +%Y-%m-%dT%H:%M:%SZ)"
