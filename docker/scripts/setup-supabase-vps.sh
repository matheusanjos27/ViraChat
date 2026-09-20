#!/usr/bin/env bash
# Instala Supabase self-host na VPS (ao lado do ViraChat).
# Uso (root):
#   bash /opt/ViraChat/docker/scripts/setup-supabase-vps.sh
#   bash /opt/ViraChat/docker/scripts/setup-supabase-vps.sh http://177.x.x.x:3000 http://177.x.x.x:8000
set -euo pipefail

SITE_URL="${1:-http://127.0.0.1:3000}"
API_URL="${2:-http://127.0.0.1:8000}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
VIRA_DOCKER="${VIRA_DOCKER:-/opt/ViraChat/docker}"

echo "==> Site URL: $SITE_URL"
echo "==> API URL:  $API_URL"

if [ ! -d "$SUPABASE_DIR/docker" ]; then
  echo "==> Clonando supabase/supabase"
  git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR"
fi

cd "$SUPABASE_DIR/docker"

if [ ! -f .env ]; then
  cp .env.example .env
fi

# URLs públicas / Auth redirects
sed -i "s|^SITE_URL=.*|SITE_URL=${SITE_URL}|" .env
sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=${API_URL}|" .env
sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=${API_URL}|" .env

# Override de memória (repo Vira)
if [ -f "$VIRA_DOCKER/supabase/docker-compose.override.yml" ]; then
  cp "$VIRA_DOCKER/supabase/docker-compose.override.yml" ./docker-compose.override.yml
  echo "==> Override de RAM copiado"
fi

echo "==> Subindo stack Supabase (pode demorar no 1º pull)"
docker compose up -d

echo "==> Desligando Studio/Analytics/Vector (economiza RAM)"
docker compose stop studio analytics vector 2>/dev/null || true

# Rede: permite virachat falar com Kong pelo nome, se ambos existirem
VIRA_NET="$(docker network ls --format '{{.Name}}' | grep -E 'docker_default|vira' | head -1 || true)"
KONG_ID="$(docker ps --filter name=kong --format '{{.ID}}' | head -1 || true)"
if [ -n "${VIRA_NET:-}" ] && [ -n "${KONG_ID:-}" ]; then
  docker network connect "$VIRA_NET" "$KONG_ID" 2>/dev/null || true
  echo "==> Kong conectado à rede $VIRA_NET"
fi

echo
echo "==> Pronto. Chaves em $SUPABASE_DIR/docker/.env :"
grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD)=' .env || true
echo
echo "No ViraChat/docker/.env defina:"
echo "  NEXT_PUBLIC_SUPABASE_URL=${API_URL}"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>"
echo "  SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>"
echo "  DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres"
echo
echo "Depois:"
echo "  bash $VIRA_DOCKER/scripts/migrate-supabase-cloud-to-vps.sh"
echo "  cd $VIRA_DOCKER && docker compose -f docker-compose.ip.yml up -d --build virachat"
