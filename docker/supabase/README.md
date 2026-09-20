# Supabase self-host (VPS)

Mantém Auth + Postgres + API no mesmo servidor do ViraChat, saindo do **Supabase Cloud Free**.

**Recomendado:** banco **limpo** (migrations + seed do admin Gmail). Sem importar o Cloud.

## Arquivos

| Arquivo | Função |
|---|---|
| `docker-compose.override.yml` | Limites de RAM + porta Kong `8000` |
| `env.vps.snippet` | Exemplo de `SITE_URL` / `API_EXTERNAL_URL` |
| `../scripts/setup-supabase-vps.sh` | Clone + up + economiza RAM |
| `../scripts/bootstrap-fresh-vps.sh` | **Do zero:** migrations + instruções de seed |
| `../scripts/migrate-supabase-cloud-to-vps.sh` | Migrations (padrão) ou `--from-cloud` |
| `../scripts/backup-supabase-pg.sh` | Backup diário `pg_dump` |

## Boot rápido (modo IP) — começar do zero

```bash
# 1) Stack Supabase
bash /opt/ViraChat/docker/scripts/setup-supabase-vps.sh \
  http://SEU_IP:3000 \
  http://SEU_IP:8000

# 2) Schema limpo
bash /opt/ViraChat/docker/scripts/bootstrap-fresh-vps.sh

# 3) Em /opt/ViraChat/docker/.env (chaves de /opt/supabase/docker/.env):
#   NEXT_PUBLIC_SUPABASE_URL=http://SEU_IP:8000
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   PLATFORM_ADMIN_EMAILS=seu@gmail.com
#   PLATFORM_ADMIN_PASSWORD=senha-forte

cd /opt/ViraChat/docker
docker compose -f docker-compose.ip.yml build --no-cache virachat
docker compose -f docker-compose.ip.yml up -d virachat

# 4) Seed só do admin
docker run --rm --env-file /opt/ViraChat/docker/.env \
  -v /opt/ViraChat/scripts/seed-platform-admin.mjs:/seed.mjs:ro \
  -w /tmp node:22-alpine \
  sh -c 'npm init -y >/dev/null 2>&1 && npm i @supabase/supabase-js@2 --silent && node /seed.mjs'
```

Login: `http://SEU_IP:3000/login` → painel `/platform` → criar empresas e convites.

## RAM (4 GB)

O setup **para** `studio`, `analytics` e `vector`. Se travar: VPS 8 GB.

## Backup

```bash
# 15 3 * * * /opt/ViraChat/docker/scripts/backup-supabase-pg.sh >> /var/log/vira-pg-backup.log 2>&1
```

Detalhes: [`../DEPLOY-VPS.md`](../DEPLOY-VPS.md).
