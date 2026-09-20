# Deploy enxuto: Evolution (Baileys) no VPS + ViraChat (Vercel ou mesmo VPS)

## O que sobe aqui

| Serviço | Porta | Função |
|---|---|---|
| `evolution-api` | 8080 | WhatsApp via Baileys (N instâncias / QR) |
| `evolution-postgres` | interna | Sessões Evolution |
| `evolution-redis` | interna | Cache Evolution |

O **ViraChat** (Next.js) continua falando com Supabase + chama a Evolution por HTTP.

Custo típico: 1 VPS ~US$8–15 (Hetzner/Contabo) + Supabase (Free ou Pro) + tokens de IA.

## 1. Subir Evolution

```bash
cd docker
cp .env.example .env
# edite EVOLUTION_API_KEY, EVOLUTION_DB_PASSWORD, EVOLUTION_SERVER_URL
docker compose up -d
docker compose logs -f evolution-api
```

Teste: `curl -H "apikey: SUA_CHAVE" http://localhost:8080/`

Abra a porta **8080** no firewall (ou coloque Nginx/Caddy na frente com HTTPS).

## 2. Ligar o ViraChat

No `.env` / Vercel do app:

```env
EVOLUTION_API_URL=https://wa.seudominio.com
EVOLUTION_API_KEY=mesma-chave-do-docker
EVOLUTION_WEBHOOK_SECRET=opcional-mas-recomendado
NEXT_PUBLIC_APP_URL=https://app.seudominio.com
```

Webhook que a Evolution chama:

`{NEXT_PUBLIC_APP_URL}/api/webhooks/evolution`

## 3. Migration

```bash
npx supabase db push
```

(ou aplique `20260920180000_baileys_evolution.sql`)

## 4. Uso no produto

1. Login → **Canais**
2. **Gerar QR Code**
3. No celular: WhatsApp → Aparelhos conectados → escanear
4. Repita para N números do mesmo tenant
5. Mensagens entram no inbox; IA responde em todos os canais

## 5. (Opcional) Next no mesmo VPS

Para cortar o Vercel Pro (~US$20):

```bash
npm run build
NODE_ENV=production npm start
# ou PM2 / Caddy proxy para :3000
```

Mantenha Supabase na nuvem no começo (Auth + Realtime). Migrar Postgres self-host é passo separado.

## Segurança

- Não exponha Postgres/Redis
- Use HTTPS (Caddy) na frente da Evolution
- Defina `EVOLUTION_WEBHOOK_SECRET` e confira o Bearer no webhook
- Troque as senhas do `.env` do docker

## Limites

- Não é API oficial Meta → risco de ban se abusar
- Celular precisa reconectar se a sessão cair (UI mostra “aguardando QR” / “desconectado”)
- RAM do VPS sobe com o número de sessões simultâneas
