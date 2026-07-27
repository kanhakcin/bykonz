# Deploy em produção

Ambiente: VM em `~/bykonz-services`, com **Docker Compose** (backend + WAHA) e
**nginx** servindo o painel (frontend). O backend usa **npm**; o frontend usa
**pnpm**. O Dockerfile builda **apenas o backend** — o frontend é publicado à
parte (build local + nginx).

> Regra de ouro: **rode a migration ANTES de subir o container novo.** Se o app
> subir antes de aplicar migrations pendentes, quebra com `column ... does not exist`.

> **Atalho:** `./scripts/deploy.sh` (no server, de dentro de `~/bykonz-services`)
> automatiza todos os passos deste runbook na ordem certa. Dá pra disparar sem
> abrir SSH pelo GitHub Actions — ver a seção *"Disparar o deploy pelo GitHub
> (CI/CD)"* no fim do arquivo. As seções abaixo documentam o que o script faz (e servem de
> referência quando algo precisa ser feito à mão).

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
# tudo de uma vez (equivale aos blocos abaixo, na ordem certa)
cd ~/bykonz-services && ./scripts/deploy.sh

# ...ou à mão:
# backend
git checkout -- package-lock.json && git pull origin master
npm install
npm run prisma:migrate:deploy
docker compose build && docker compose up -d

# frontend
cd frontend && pnpm install --frozen-lockfile && pnpm run build
```

---

## `scripts/deploy.sh`

Roda **no servidor**, de dentro de `~/bykonz-services`. Faz, em ordem:
`git pull` → `npm install` → `prisma migrate deploy` → `docker compose build && up -d`
→ espera o `/health` → `pnpm run build` do painel.

```bash
./scripts/deploy.sh                     # completo (backend + migrations + painel)
./scripts/deploy.sh --no-frontend       # só o backend (pula o build do painel)
./scripts/deploy.sh --no-pull           # deploy do código já presente (sem git pull)
./scripts/deploy.sh --skip-migrations   # não aplica migrations (aplicar à mão depois)
./scripts/deploy.sh --help
```

Detalhes que o script já trata:

- **Migrations antes do container** — a regra de ouro do topo deste arquivo.
- **Lockfiles divergentes** — descarta alterações locais em `package-lock.json` e
  `frontend/pnpm-lock.yaml` antes do pull (a versão do repo é a fonte da verdade).
  Outras alterações locais só geram aviso; o script não descarta trabalho seu.
- **`npm install`, não `npm ci`** — o `ci` aborta quando o lock dessincroniza com
  o npm do servidor.
- **Aborta se o backend não ficar saudável** — espera `/health` responder (~60s);
  se não responder, mostra os logs do container e **não** builda o painel.
- **Sem `sudo`** — o nginx serve `frontend/dist` no lugar, não há cópia p/ `/var/www`.
- **`pnpm` via `corepack`** quando o binário não está no PATH.

> O `vite build` limpa o `frontend/dist` antes de gerar, então há uma janela de
> poucos segundos em que o painel pode devolver 404. Recarregar a página resolve.

O `.env` **não é versionado** — vive só no servidor, e é justamente ele que o
script usa como marcador de "estou no servidor de verdade". Se você rodar o
script de um clone sem `.env` (e sem `DATABASE_URL` no ambiente), ele falha cedo
com mensagem clara, antes de tocar em qualquer coisa.

---

## Arquivos de build (versionados a partir de julho/2026)

`Dockerfile`, `docker-compose.yml`, `.dockerignore` e `prisma/seedProd.ts` viviam
**apenas** no disco da VM — se ela se perdesse, o *como* buildar e subir se perdia
com ela. Agora estão no repo. O `.env` continua fora: o compose lê os valores dele
via `env_file`, e o `.env.example` documenta todas as variáveis necessárias.

### Passo de transição (fazer UMA vez, na VM)

Antes do primeiro `git pull` que traz esses arquivos, é preciso remover as cópias
não-rastreadas que já existem lá — senão o pull aborta com
`error: Untracked working tree files would be overwritten by merge` e o deploy
quebra.

```bash
cd ~/bykonz-services

# 1. backup das versões atuais (as que estão rodando hoje em produção)
mkdir -p ~/backup-prod-files
cp Dockerfile docker-compose.yml ~/backup-prod-files/

# 2. remover as cópias locais para o pull poder trazer as versionadas
rm -f Dockerfile docker-compose.yml

# 3. trazer as versionadas
git pull origin master

# 4. PROVAR que são equivalentes — as duas saídas devem ser VAZIAS
diff ~/backup-prod-files/Dockerfile         Dockerfile
diff ~/backup-prod-files/docker-compose.yml docker-compose.yml
```

Se algum `diff` mostrar diferença, **pare**: restaure do backup
(`cp ~/backup-prod-files/* .`) e investigue antes de deployar. Se as duas saídas
vierem vazias, o build versionado é byte a byte o que já rodava.

Guarde o `~/backup-prod-files` até o deploy seguinte passar.

### `.dockerignore` — por que ele existe

Sem ele, o `COPY . .` do Dockerfile arrastava o `node_modules` do host (~400 MB)
para dentro da imagem e **sobrescrevia o resultado do `RUN npm ci` da própria
imagem** — o build passava a compilar contra as dependências do host. Custava
~120 s por deploy (45% do total) e era frágil: qualquer divergência de
arquitetura ou versão de Node entre host e container quebraria de forma confusa.

O build precisa apenas de `src/`, `prisma/`, `package*.json` e `tsconfig.json`.
Verificado que `npm run build` (`prisma generate && tsc`) roda **sem `.env` e sem
`DATABASE_URL`**, então nenhum segredo precisa entrar em camada de imagem — as
variáveis chegam em runtime via `env_file`.

### Seed de produção

```bash
npm run seed:prod        # setores, hierarquias de ativo, prefixos, empresa base
```

Idempotente (tudo `upsert` por chave natural): rodar de novo não duplica nem
apaga nada. Não cria dados de demonstração — para isso existe o `npm run db:seed`.

---

## Disparar o deploy pelo GitHub (CI/CD) ☁️

`.github/workflows/deploy.yml` deixa você deployar **sem abrir SSH**: aba
**Actions → "Deploy (produção)" → Run workflow** (ou `gh workflow run "Deploy (produção)"`).
O runner do GitHub conecta por SSH na VM e roda o `scripts/deploy.sh` lá — o build
acontece no server, igual ao manual. É `workflow_dispatch` (só manual, **não**
dispara em push).

Inputs do formulário: **O que publicar** (completo / só backend) e **Pular
migrations**. Um `concurrency` global impede dois deploys simultâneos.

**Configurar uma vez:**

1. **Bootstrap no server** — o script precisa existir lá. Uma vez, na VM:
   ```bash
   cd ~/bykonz-services && git pull origin master && chmod +x scripts/deploy.sh
   ```

2. **Deploy key** — gerar um par SÓ para o CI (na sua máquina):
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions-deploy"
   ```
   Copiar a **pública** para o server (autoriza o runner a entrar):
   ```bash
   ssh-copy-id -i deploy_key.pub USUARIO@HOST   # ou colar em ~/.ssh/authorized_keys
   ```
   Essa chave é só p/ o SSH na VM — o `git pull` do server usa as credenciais
   que ele já tem.

3. **Secrets do repo** — GitHub → Settings → Secrets and variables → Actions:
   | Secret | Valor |
   |---|---|
   | `SSH_HOST` | host ou IPv4 da VM |
   | `SSH_USER` | usuário de deploy na VM |
   | `SSH_PORT` | `22` (opcional) |
   | `SSH_PRIVATE_KEY` | conteúdo do arquivo `deploy_key` (a **privada**) |

   Apague o `deploy_key` local depois de colar. **Nunca** commitar as chaves.

4. **(Opcional) Aprovação manual** — o job usa `environment: production`. Em
   Settings → Environments → `production` dá pra exigir que alguém aprove antes
   de cada deploy (segundo par de olhos).

Diferente do CareDesk, aqui **não precisa de sudoers/NOPASSWD**: nenhum passo do
script usa `sudo`.

### Troubleshooting do CI

- **Job trava/expira** (timeout de 20 min) → algum comando pediu input na VM.
  Confira se o `sudo` não voltou ao script e se o `corepack` não está pedindo
  confirmação p/ baixar o pnpm.
- **`Host key verification failed`** → o `ssh-keyscan` não resolveu o `SSH_HOST`;
  use o IPv4.
- **`Permission denied (publickey)`** → a pública não está no `authorized_keys`
  do `SSH_USER`, ou o secret `SSH_PRIVATE_KEY` foi colado sem a linha final.
- **Falhou no `/health`** → o job traz os logs do container no output; o deploy
  para antes do painel, então backend velho e painel velho seguem no ar.
