# Docker — ViraChat + Evolution

| Arquivo | Uso |
|---|---|
| `docker-compose.yml` | Só Evolution (dev / Vercel + VPS) |
| `docker-compose.ip.yml` | Bootstrap por IP (`:3000` + Evolution `:8080`) |
| `docker-compose.prod.yml` | **Produção:** Caddy + ViraChat + Evolution |
| `supabase/` | Override RAM + docs self-host |
| `scripts/setup-supabase-vps.sh` | Sobe Supabase na VPS |
| `scripts/migrate-supabase-cloud-to-vps.sh` | Migra Cloud Free → VPS |
| `DEPLOY-VPS.md` | Passo a passo completo |
| `scripts/deploy.sh` | Pull + migration + rebuild (Actions / manual) |
| `.env.prod.example` | Modelo de env de produção |

## Produção (recomendado)

Siga **[DEPLOY-VPS.md](./DEPLOY-VPS.md)**.

```bash
cp .env.prod.example .env
# edite .env
docker compose -f docker-compose.prod.yml up -d --build
```

## Só Evolution (app ainda na Vercel)

```bash
cp .env.example .env
docker compose up -d
```
