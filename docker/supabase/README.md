# Supabase self-host (VPS)

Mantém Auth + Postgres + API no mesmo servidor do ViraChat, saindo do **Supabase Cloud Free**.

## Arquivos

| Arquivo | Função |
|---|---|
| `docker-compose.override.yml` | Limites de RAM + porta Kong `8000` |
| `env.vps.snippet` | Exemplo de `SITE_URL` / `API_EXTERNAL_URL` |
| `../scripts/setup-supabase-vps.sh` | Clone + up + economiza RAM |
| `../scripts/migrate-supabase-cloud-to-vps.sh` | Dump Cloud → VPS (ou só migrations) |
| `../scripts/backup-supabase-pg.sh` | Backup diário `pg_dump` |

## Boot rápido (modo IP)

```bash
# 1) Stack
bash /opt/ViraChat/docker/scripts/setup-supabase-vps.sh \
  http://SEU_IP:3000 \
  http://SEU_IP:8000

# 2) Dados (Cloud → VPS)
export CLOUD_DATABASE_URL='postgresql://postgres....@db.xxx.supabase.co:5432/postgres'
bash /opt/ViraChat/docker/scripts/migrate-supabase-cloud-to-vps.sh

# OU banco novo só com migrations do repo:
# bash /opt/ViraChat/docker/scripts/migrate-supabase-cloud-to-vps.sh --migrations-only

# 3) Ligar o app
# Edite /opt/ViraChat/docker/.env:
#   NEXT_PUBLIC_SUPABASE_URL=http://SEU_IP:8000
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   DATABASE_URL=postgresql://postgres:SENHA@127.0.0.1:5432/postgres

cd /opt/ViraChat/docker
docker compose -f docker-compose.ip.yml build --no-cache virachat
docker compose -f docker-compose.ip.yml up -d virachat
```

## RAM (4 GB)

Depois do `up`, o setup **para** `studio`, `analytics` e `vector`.
Se a VPS travar: upgrade para 8 GB ou desligue Realtime no compose oficial.

## Backup

```bash
crontab -e
# 15 3 * * * /opt/ViraChat/docker/scripts/backup-supabase-pg.sh >> /var/log/vira-pg-backup.log 2>&1
```

Detalhes gerais: [`../DEPLOY-VPS.md`](../DEPLOY-VPS.md).
