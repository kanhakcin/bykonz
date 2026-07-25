# Deploy em produção

Ambiente: VM em `~/bykonz-services`, com **Docker Compose** (backend + WAHA) e
**nginx** servindo o painel (frontend). O backend usa **npm**; o frontend usa
**pnpm**. O Dockerfile builda **apenas o backend** — o frontend é publicado à
parte (build local + nginx).

> Regra de ouro: **rode a migration ANTES de subir o container novo.** Se o app
> subir antes de aplicar migrations pendentes, quebra com `column ... does not exist`.

---

## 1. Backend (API + cron do relatório diário)

No servidor, em `~/bykonz-services`:

```bash
# 1.1 Puxar o master. O package-lock.json costuma divergir por versão de npm —
#     a versão do repo é a fonte da verdade, então descarte a local antes.
git checkout -- package-lock.json
git pull origin master

# 1.2 Instalar deps no host (traz o prisma CLI, necessário pro migrate deploy).
#     Use `npm install`, NÃO `npm ci`: o lock pode dessincronizar com o npm do
#     servidor (ex.: pacotes @emnapi/* "faltando") e o `ci` aborta.
npm install

# 1.3 Aplicar migrations no banco de produção (ANTES de subir o container).
npm run prisma:migrate:deploy
npx prisma migrate status          # deve dizer "Database schema is up to date!"

# 1.4 Rebuild da imagem e subir. SEM `build`, o compose reusa a imagem antiga
#     (código velho). O `npm run build` roda dentro da imagem (prisma generate + tsc).
docker compose build
docker compose up -d
```

Serviços do compose: `app` (API na porta 8080) e `waha`. Não há serviço de
frontend.

---

## 2. Frontend (painel do gestor)

O painel **não** está no Dockerfile. É buildado com **pnpm** e servido pelo
**nginx** a partir de `frontend/dist`.

```bash
cd ~/bykonz-services/frontend

# Se o pnpm não estiver instalado (vem via corepack no Node 20):
#   corepack enable && corepack prepare pnpm@10.28.2 --activate

pnpm install --frozen-lockfile     # equivalente ao `npm ci` (usa pnpm-lock.yaml)
pnpm run build                     # gera frontend/dist com a UI nova
```

O nginx aponta para essa pasta `dist`, então a nova versão do painel já reflete
no ar após o build (recarregue a página; se necessário, `sudo nginx -s reload`).

---

## 3. Variáveis de ambiente

Vivem no `.env` do host (backend) e no compose (container `app`). O `.env` **não**
é versionado — ver `.env.example` para a lista completa.

Para conferir o que chega no container:

```bash
docker compose exec app printenv | grep -iE "smtp|waha|telegram|database"
```

### SMTP (e-mail do relatório) — opcional
Sem SMTP configurado, o canal de e-mail fica desligado (não quebra nada). Para
ligar, defina no ambiente do `app`:

```
SMTP_HOST=...        SMTP_PORT=465        SMTP_SECURE=true   # 465=TLS; 587=STARTTLS (secure=false)
SMTP_USER=...        SMTP_PASS=...
SMTP_FROM="Diário de Obra <endereco@dominio>"   # DEVE pertencer à conta SMTP_USER,
                                                 # senão o servidor recusa: 553 Sender rejected
```

Após alterar envs do `app`: `docker compose up -d app` (recria o container).

---

## 4. Verificação pós-deploy

```bash
docker compose ps                              # containers Up
docker compose logs --tail=50 app | grep -iE "listen|error|prisma|column"
#   deve mostrar "Server listening on port 8080" e nenhum erro de coluna

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/webhooks/telegram
#   404/405 = servidor no ar (a rota só aceita POST)
```

No painel: abrir um cadastro de obra e conferir que as seções/campos novos
aparecem (prova que backend + migration + frontend estão alinhados). Para e-mail,
usar o botão **"Testar e-mail"** na seção E-mail da obra.

---

## 5. Disparar o relatório diário manualmente (opcional)

O cron roda às 18h (America/Sao_Paulo). Para testar sob demanda uma data
específica (envia WhatsApp e/ou e-mail conforme a config de cada obra; dia sem
registros não envia e-mail):

```bash
# no host (tsx é devDependency; precisa do `npm install` do passo 1.2)
npm run daily-report:run -- 2026-07-10        # AAAA-MM-DD; sem data = hoje
```

---

## Resumo rápido

```bash
# backend
git checkout -- package-lock.json && git pull origin master
npm install
npm run prisma:migrate:deploy
docker compose build && docker compose up -d

# frontend
cd frontend && pnpm install --frozen-lockfile && pnpm run build
```
