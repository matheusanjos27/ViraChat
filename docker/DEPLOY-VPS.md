# Deploy tudo numa VPS (Hostinger / KingHost / Hetzner)

Objetivo: **1 VM** com:

| Serviço | Onde |
|---|---|
| ViraChat (Next.js) | Docker neste repo |
| Evolution (WhatsApp) | Docker neste repo |
| HTTPS (Caddy) | Docker neste repo |
| Supabase (Auth + DB + Realtime) | Self-host oficial **ao lado** |

> **RAM:** em **4 GB** funciona com **swap** (script abaixo). Mais confortável: **8 GB** se for self-hostar Supabase + vários WhatsApps.

---

## 0. Contratar a VPS

1. Ubuntu **22.04 ou 24.04**
2. Acesso root / SSH
3. Anote o **IP**

DNS (recomendado):

| Subdomínio | Aponta para |
|---|---|
| `app.seudominio.com` | IP da VPS |
| `wa.seudominio.com` | IP da VPS |
| `api.seudominio.com` | IP da VPS (Supabase Kong/API) |

---

## 1. Preparar o servidor

```bash
ssh root@SEU_IP

curl -fsSL https://raw.githubusercontent.com/matheusanjos27/ViraChat/main/docker/scripts/setup-vps.sh | bash
# ou, com o repo já clonado:
bash docker/scripts/setup-vps.sh
```

## 2. Clonar o ViraChat

```bash
cd /opt
git clone https://github.com/matheusanjos27/ViraChat.git
cd ViraChat/docker
cp .env.prod.example .env
nano .env   # preencha TUDO (chaves, domínio, OpenAI, etc.)
```

Gere `TOKEN_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Subir app + Evolution

```bash
cd /opt/ViraChat/docker
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f virachat
```

- App: `https://app.seudominio.com`
- Evolution: `https://wa.seudominio.com` (header `apikey: SUA_CHAVE`)

Webhook Evolution (já usado pelo código ao criar instância):

`https://app.seudominio.com/api/webhooks/evolution`

---

## 4. Self-host Supabase (banco + Auth + Realtime)

### 4.1 Instalar

```bash
cd /opt
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
nano .env
```

Ajuste no `.env` do Supabase (mínimo):

- `SITE_URL` = `https://app.seudominio.com`
- `API_EXTERNAL_URL` = `https://api.seudominio.com`
- `SUPABASE_PUBLIC_URL` = `https://api.seudominio.com`
- senhas JWT / Postgres fortes

Suba:

```bash
docker compose up -d
```

Exponha a API no Caddy: adicione ao `ViraChat/docker/Caddyfile`:

```caddy
api.seudominio.com {
	reverse_proxy host.docker.internal:8000
}
```

Se `host.docker.internal` não existir no Linux, use o IP da bridge ou coloque o Kong do Supabase na mesma rede Docker:

```bash
# Exemplo: conectar Kong à rede do compose do Vira
docker network ls
docker network connect docker_default supabase-kong-1
```

Depois no Caddyfile:

```caddy
api.seudominio.com {
	reverse_proxy supabase-kong-1:8000
}
```

(Reinicie o Caddy: `docker compose -f docker-compose.prod.yml restart caddy`)

### 4.2 Migrar dados do Supabase Cloud → self-host

No PC (com link do projeto cloud):

```bash
# Dump (schema + dados)
supabase db dump -f backup.sql --linked
# ou pg_dump com a connection string do Dashboard → Database
```

Na VPS, restaure no Postgres do Supabase self-host (porta/credenciais do `supabase/docker/.env`):

```bash
psql "postgresql://postgres:SUA_SENHA@localhost:5432/postgres" -f backup.sql
```

Ou use as migrations do repo:

```bash
cd /opt/ViraChat
# aponte DATABASE_URL / supabase link para o self-host e:
npx supabase db push
```

### 4.3 Ligar o Vira ao Supabase novo

No `ViraChat/docker/.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://api.seudominio.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # do supabase/docker/.env (ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=...      # SERVICE_ROLE_KEY
```

Rebuild do app (NEXT_PUBLIC_* entram no build):

```bash
cd /opt/ViraChat/docker
docker compose -f docker-compose.prod.yml up -d --build virachat
```

---

## 5. Ordem se a RAM apertar (4 GB)

1. Swap ligado (passo 1)  
2. Suba **primeiro** Evolution + Vira  
3. Só então Supabase  
4. Desligue o **Studio** do Supabase se não usar (`docker compose stop studio` no projeto supabase)  
5. Se travar: upgrade para **8 GB**

---

## 6. Checklist final

- [ ] `https://app...` abre login  
- [ ] Seed admin (`PLATFORM_ADMIN_*`)  
- [ ] Canais → Gerar QR → WhatsApp conecta  
- [ ] Mensagem de teste → aparece no inbox → IA responde  
- [ ] Backup: snapshot da VPS na Hostinger/KingHost 1x/semana  

---

## Comandos úteis

```bash
cd /opt/ViraChat/docker
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart virachat
docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d --build

# Atualizar código
cd /opt/ViraChat && git pull
cd docker && docker compose -f docker-compose.prod.yml up -d --build
```

## Segurança

- Não abra 5432/6379 na internet  
- Só 80/443 (+ 22 SSH)  
- Troque todas as senhas do `.env`  
- Firewall: `ufw allow 22,80,443/tcp && ufw enable`

---

## 7. Deploy automático (push na `main`)

Quando algo sobe na `main`, o GitHub Actions:

1. Entra na VPS por SSH (chave)  
2. Roda `docker/scripts/deploy.sh`  
3. `git pull` → **migrations** (`DATABASE_URL`) → `docker compose up --build`

### 7.1 Chave SSH só para deploy

No seu PC:

```bash
ssh-keygen -t ed25519 -C "virachat-deploy" -f virachat-deploy -N ""
```

Na VPS:

```bash
mkdir -p ~/.ssh
cat >> ~/.ssh/authorized_keys   # cola o conteúdo de virachat-deploy.pub
chmod 600 ~/.ssh/authorized_keys
```

### 7.2 Secrets no GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `VPS_HOST` | `200.192.27.111` |
| `VPS_USER` | `root` (ou o user SSH) |
| `VPS_SSH_KEY` | conteúdo **completo** do arquivo privado `virachat-deploy` |
| `VPS_PORT` | `22` (opcional) |

### 7.3 DATABASE_URL na VPS

Em `/opt/ViraChat/docker/.env`:

```env
DATABASE_URL=postgresql://postgres:SENHA@127.0.0.1:5432/postgres
```

(Use a senha do Postgres do Supabase self-host.)

### 7.4 Testar

- Actions → **Deploy VPS** → **Run workflow**, ou  
- `git push origin main`

O job falha de propósito se `/opt/ViraChat` ainda não existir — faça o setup inicial uma vez (`DEPLOY-VPS.md` passos 1–3).
