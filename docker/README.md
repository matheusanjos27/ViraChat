# Docker — ViraChat + Evolution

| Arquivo | Uso |
|---|---|
| `docker-compose.yml` | Só Evolution (dev / Vercel + VPS) |
| `docker-compose.prod.yml` | **Produção:** Caddy + ViraChat + Evolution |
| `DEPLOY-VPS.md` | Passo a passo completo na VPS (inclui Supabase self-host + CI) |
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
