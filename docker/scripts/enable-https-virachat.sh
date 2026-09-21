#!/usr/bin/env bash
# Liga HTTPS (Caddy) para virachat.com.br na VPS.
# Uso:
#   cd /opt/ViraChat && git pull && bash docker/scripts/enable-https-virachat.sh
set -euo pipefail

VIRA_ROOT="${VIRA_ROOT:-/opt/ViraChat}"
VIRA_DOCKER="${VIRA_DOCKER:-$VIRA_ROOT/docker}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
ENV_FILE="$VIRA_DOCKER/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Não achei $ENV_FILE"
  exit 1
fi

cd "$VIRA_ROOT"
git pull --ff-only || git pull

# Detecta nome do Kong
KONG_NAME="$(docker ps --format '{{.Names}}' | grep -i kong | head -1 || true)"
if [ -z "${KONG_NAME:-}" ]; then
  KONG_NAME="supabase-kong-1"
  echo "Aviso: Kong não encontrado rodando; usando $KONG_NAME"
else
  echo "Kong: $KONG_NAME"
fi

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

echo "==> Atualizando $ENV_FILE"
upsert_env APP_DOMAIN "www.virachat.com.br"
upsert_env APP_ALIAS "app.virachat.com.br"
upsert_env ROOT_DOMAIN "virachat.com.br"
upsert_env WA_DOMAIN "wa.virachat.com.br"
upsert_env API_DOMAIN "api.virachat.com.br"
upsert_env SUPABASE_KONG_UPSTREAM "${KONG_NAME}:8000"
upsert_env NEXT_PUBLIC_APP_URL "https://www.virachat.com.br"
upsert_env NEXT_PUBLIC_SUPABASE_URL "https://api.virachat.com.br"
upsert_env EVOLUTION_SERVER_URL "https://wa.virachat.com.br"
upsert_env EVOLUTION_API_URL "http://evolution-api:8080"

# Supabase Auth URLs
if [ -f "$SUPABASE_DIR/docker/.env" ]; then
  echo "==> Atualizando Supabase SITE_URL / API URLs"
  sed -i 's|^SITE_URL=.*|SITE_URL=https://www.virachat.com.br|' "$SUPABASE_DIR/docker/.env"
  sed -i 's|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://api.virachat.com.br|' "$SUPABASE_DIR/docker/.env"
  sed -i 's|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://api.virachat.com.br|' "$SUPABASE_DIR/docker/.env"
  (cd "$SUPABASE_DIR/docker" && docker compose up -d)
else
  echo "Aviso: $SUPABASE_DIR/docker/.env não encontrado — pulei Supabase"
fi

# Rede Kong
VIRA_NET="$(docker network ls --format '{{.Name}}' | grep -E '^docker_default$' | head -1 || true)"
KONG_ID="$(docker ps -qf name=kong | head -1 || true)"
if [ -n "${VIRA_NET:-}" ] && [ -n "${KONG_ID:-}" ]; then
  docker network connect "$VIRA_NET" "$KONG_ID" 2>/dev/null || true
  echo "==> Kong na rede $VIRA_NET"
fi

echo "==> Trocando compose IP -> produção (Caddy)"
cd "$VIRA_DOCKER"
docker compose -f docker-compose.ip.yml down || true
docker compose -f docker-compose.prod.yml up -d --build

echo
echo "==> Status"
docker compose -f docker-compose.prod.yml ps
echo
echo "Teste:"
echo "  https://app.virachat.com.br"
echo "  https://www.virachat.com.br"
echo
echo "Se certificado falhar:"
echo "  docker compose -f docker-compose.prod.yml logs caddy --tail 50"
echo
echo "Lembre: liberar portas 80 e 443 no firewall KingHost."
