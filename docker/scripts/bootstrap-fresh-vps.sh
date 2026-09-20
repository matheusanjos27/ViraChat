#!/usr/bin/env bash
# Bootstrap do zero na VPS: schema do repo + (instruções) seed do admin.
# NÃO importa dados do Supabase Cloud — banco limpo.
#
# Pré: setup-supabase-vps.sh já rodou e /opt/ViraChat/docker/.env tem
#   NEXT_PUBLIC_SUPABASE_URL, ANON, SERVICE_ROLE, PLATFORM_ADMIN_*
#
# Uso:
#   bash /opt/ViraChat/docker/scripts/bootstrap-fresh-vps.sh
set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
VIRA_ROOT="${VIRA_ROOT:-/opt/ViraChat}"
VIRA_DOCKER="${VIRA_DOCKER:-$VIRA_ROOT/docker}"

if [ -f "$SUPABASE_DIR/docker/.env" ]; then
  POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$SUPABASE_DIR/docker/.env" | cut -d= -f2-)"
fi
LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres}"

if ! command -v psql >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y postgresql-client
fi

echo "==> Aplicando migrations (banco limpo / schema app)"
for f in "$VIRA_ROOT"/supabase/migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "  -> $(basename "$f")"
  psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo
echo "==> Schema OK."
echo
echo "Próximos passos:"
echo "  1. Confira em $VIRA_DOCKER/.env:"
echo "       NEXT_PUBLIC_SUPABASE_URL=http://SEU_IP:8000"
echo "       NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # de $SUPABASE_DIR/docker/.env"
echo "       SUPABASE_SERVICE_ROLE_KEY=..."
echo "       PLATFORM_ADMIN_EMAILS=seu@gmail.com"
echo "       PLATFORM_ADMIN_PASSWORD=senha-forte"
echo
echo "  2. Rebuild do app:"
echo "       cd $VIRA_DOCKER"
echo "       docker compose -f docker-compose.ip.yml build --no-cache virachat"
echo "       docker compose -f docker-compose.ip.yml up -d virachat"
echo
echo "  3. Seed do super admin (só Gmail + senha):"
echo "       docker run --rm --env-file $VIRA_DOCKER/.env \\"
echo "         -v $VIRA_ROOT/scripts/seed-platform-admin.mjs:/seed.mjs:ro \\"
echo "         -w /tmp node:22-alpine \\"
echo "         sh -c 'npm init -y >/dev/null 2>&1 && npm i @supabase/supabase-js@2 --silent && node /seed.mjs'"
echo
echo "  4. Login em http://SEU_IP:3000/login → /platform → criar tenant e convidar usuários."
echo "  5. Pode pausar/apagar o projeto no Supabase Cloud Free."
