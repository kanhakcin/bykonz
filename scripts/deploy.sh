#!/usr/bin/env bash
#
# deploy.sh — Atualiza o Diário das Obras em produção (VM ~/bykonz-services).
#
# Automatiza o runbook do docs/deploy.md:
#   git pull → npm install → migrations (Prisma) → build+up do backend (docker)
#   → build do painel (pnpm) → publica o painel no WEB_ROOT que o Nginx serve.
#
# REGRA DE OURO (respeitada pela ordem dos passos): as migrations rodam ANTES de
# subir o container novo. Se o app subir antes, quebra com "column ... does not exist".
#
# RODAR DE DENTRO DE ~/bykonz-services, no servidor:
#   ./scripts/deploy.sh                     # completo (backend + migrations + painel)
#   ./scripts/deploy.sh --no-frontend       # só o backend (pula build do painel)
#   ./scripts/deploy.sh --no-pull           # não faz git pull (deploy do código já presente)
#   ./scripts/deploy.sh --skip-migrations   # não aplica migrations (aplicar à mão depois)
#
# Requisitos no server: git, docker (com compose plugin), npm e pnpm (ou corepack).
# O docker-compose.yml e o .env NÃO são versionados — vivem só no servidor.
#
# Rodando via CI/CD (GitHub Actions, sessão SSH não-interativa): nenhum passo usa
# `sudo`. A publicação do painel escreve em $WEB_ROOT, que pertence ao usuário de
# deploy (setup de uma vez). Em CI, `sudo` pediria senha e travaria o job.
# Ver docs/deploy.md, seções "Publicação do painel" e CI/CD.

set -Eeuo pipefail

# --- Configuração ------------------------------------------------------------
BRANCH="${BRANCH:-master}"
COMPOSE_FILE="docker-compose.yml"   # não versionado; existe só no servidor
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/health}"

# Onde o painel buildado é publicado (o `root` do server block do Nginx).
# Fica FORA do repositório de propósito: o que o Nginx expõe é um artefato
# publicado, não a árvore de trabalho do git (que tem .env, .git, src/...).
# Precisa ser gravável pelo usuário de deploy — ver docs/deploy.md.
WEB_ROOT="${WEB_ROOT:-/var/www/bykonz-services-painel}"

DO_PULL=1
DO_FRONTEND=1
DO_MIGRATIONS=1

for arg in "$@"; do
  case "$arg" in
    --no-pull)         DO_PULL=0 ;;
    --no-frontend)     DO_FRONTEND=0 ;;
    --skip-migrations) DO_MIGRATIONS=0 ;;
    -h|--help)
      sed -n '2,23p' "$0"
      exit 0 ;;
    *)
      echo "Argumento desconhecido: $arg (use --help)" >&2
      exit 2 ;;
  esac
done

# --- Helpers -----------------------------------------------------------------
BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
step() { echo; echo "${BOLD}==> $*${RESET}"; }
ok()   { echo "${GREEN}✓${RESET} $*"; }
warn() { echo "${YELLOW}⚠${RESET}  $*"; }
die()  { echo "${RED}✗ $*${RESET}" >&2; exit 1; }

on_error() {
  local code=$?
  echo >&2
  echo "${RED}✗ Deploy FALHOU (exit $code) na linha $1.${RESET}" >&2
  echo "${DIM}Os passos anteriores que já concluíram continuam aplicados. Corrija e rode de novo.${RESET}" >&2
  exit "$code"
}
trap 'on_error $LINENO' ERR

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' não encontrado no PATH."; }

# --- Sanidade ----------------------------------------------------------------
step "Checando pré-requisitos"
[ -f "package.json" ] || die "rode de dentro de ~/bykonz-services (não achei package.json)."
[ -f "$COMPOSE_FILE" ] || die "não achei $COMPOSE_FILE — rode da raiz do repositório."
# O .env é o único arquivo do deploy que NÃO é versionado: é ele que marca
# "estamos no servidor de verdade". Sem ele o compose (env_file) e as migrations
# (DATABASE_URL) falhariam mais adiante — melhor parar aqui, com mensagem clara.
if [ ! -f .env ] && [ -z "${DATABASE_URL:-}" ]; then
  die "não achei .env (não versionado) nem DATABASE_URL no ambiente. Rode no servidor, em ~/bykonz-services."
fi

need git; need docker; need npm
docker compose version >/dev/null 2>&1 || die "'docker compose' (plugin) não disponível."

# Resolve o comando pnpm (só o painel precisa): binário direto ou via corepack
# (não exige install global / sudo — ideal p/ CI).
PNPM=""
if [ "$DO_FRONTEND" -eq 1 ]; then
  if command -v pnpm >/dev/null 2>&1; then
    PNPM="pnpm"
  elif command -v corepack >/dev/null 2>&1; then
    PNPM="corepack pnpm"
    # não perguntar p/ baixar o pnpm (travaria em sessão não-interativa/CI)
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  else
    die "pnpm não encontrado (nem via corepack). Rode 'corepack enable' ou use --no-frontend."
  fi
fi
ok "Ferramentas presentes."

# --- 1. git pull -------------------------------------------------------------
if [ "$DO_PULL" -eq 1 ]; then
  step "Atualizando código (git pull origin/$BRANCH)"

  # Os lockfiles divergem no servidor por diferença de versão do npm/pnpm — a
  # versão do repo é a fonte da verdade. Descartamos a local p/ o pull não travar.
  for lock in package-lock.json frontend/pnpm-lock.yaml; do
    if [ -n "$(git status --porcelain -- "$lock")" ]; then
      git checkout -- "$lock"
      ok "descartada alteração local em $lock"
    fi
  done

  if [ -n "$(git status --porcelain)" ]; then
    warn "Há outras alterações locais não commitadas — git pull pode falhar/conflitar:"
    git status --short
  fi

  BEFORE="$(git rev-parse HEAD)"
  git pull --ff-only origin "$BRANCH"
  AFTER="$(git rev-parse HEAD)"
  if [ "$BEFORE" = "$AFTER" ]; then
    ok "Já estava atualizado ($AFTER)."
  else
    ok "Atualizado: $BEFORE → $AFTER"
    echo "${DIM}Mudanças:${RESET}"
    git --no-pager log --oneline "$BEFORE..$AFTER"
  fi
else
  warn "Pulando git pull (--no-pull)."
fi

# --- 2. Dependências do backend no host --------------------------------------
# Precisa rodar no host (não só na imagem) porque o Prisma CLI das migrations
# vem daqui. `npm install`, NÃO `npm ci`: o lock dessincroniza com o npm do
# servidor (ex.: pacotes @emnapi/* "faltando") e o `ci` aborta.
step "Instalando dependências do backend (npm install)"
npm install
ok "Dependências instaladas."

# --- 3. Migrations (ANTES de subir o container) -------------------------------
if [ "$DO_MIGRATIONS" -eq 1 ]; then
  step "Aplicando migrations no banco de produção (prisma migrate deploy)"
  # DATABASE_URL vem do .env do host (o Prisma carrega sozinho); uma env já
  # definida no ambiente tem precedência.
  npm run prisma:migrate:deploy
  npx prisma migrate status
  ok "Migrations aplicadas (status acima deve dizer 'up to date')."
else
  warn "Pulando migrations (--skip-migrations). Aplique à mão antes de o app servir tráfego:"
  echo "${DIM}   npm run prisma:migrate:deploy${RESET}"
fi

# --- 4. Backend (container) --------------------------------------------------
# SEM `build`, o compose reusaria a imagem antiga (código velho). O `npm run
# build` (prisma generate + tsc) roda dentro da imagem.
step "Rebuild + restart do backend (docker compose)"
docker compose build
docker compose up -d
ok "Container no ar. Aguardando /health..."

# espera o /health responder (até ~60s)
health_ok=0
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    health_ok=1; break
  fi
  sleep 2
done
if [ "$health_ok" -eq 1 ]; then
  ok "Backend saudável ($HEALTH_URL respondeu)."
else
  warn "/health não respondeu em ~60s. Últimos logs:"
  docker compose logs --tail=30 app || true
  die "backend não ficou saudável — abortando antes de buildar o painel."
fi

# --- 5. Painel (frontend estático servido pelo nginx) ------------------------
if [ "$DO_FRONTEND" -eq 1 ]; then
  step "Build do painel (pnpm)"
  pushd frontend >/dev/null
  $PNPM install --frozen-lockfile || $PNPM install
  $PNPM run build            # vite build + tsc --noEmit (falha em erro de tipo)
  popd >/dev/null

  [ -d frontend/dist ] || die "frontend/dist não foi gerado — build do painel falhou?"

  step "Publicando o painel em $WEB_ROOT"
  # O `vite build` limpa o frontend/dist antes de gerar. Por isso publicamos em
  # outro lugar: o Nginx serve $WEB_ROOT, que só é tocado aqui — com conteúdo já
  # pronto —, sem a janela de 404 que existia ao servir o dist direto.
  #
  # SEM sudo por design: $WEB_ROOT deve pertencer ao usuário de deploy (setup de
  # uma vez, ver docs/deploy.md). Em CI, `sudo` pediria senha e travaria o job.
  if [ ! -d "$WEB_ROOT" ]; then
    die "$WEB_ROOT não existe. Setup de uma vez (ver docs/deploy.md):
     sudo mkdir -p $WEB_ROOT && sudo chown -R \$USER:\$USER $WEB_ROOT"
  fi
  [ -w "$WEB_ROOT" ] || die "$WEB_ROOT não é gravável por $(whoami). Rode:
     sudo chown -R \$USER:\$USER $WEB_ROOT"

  if command -v rsync >/dev/null 2>&1; then
    # --delete remove o que sobrou da versão anterior (hashes de chunk mudam)
    rsync -a --delete frontend/dist/ "$WEB_ROOT/"
  else
    warn "rsync ausente — usando cp. Limpando $WEB_ROOT antes para não deixar órfãos."
    find "$WEB_ROOT" -mindepth 1 -delete
    cp -a frontend/dist/. "$WEB_ROOT/"
  fi
  [ -f "$WEB_ROOT/index.html" ] || die "publicação falhou: não achei $WEB_ROOT/index.html."
  ok "Painel publicado em $WEB_ROOT."
else
  warn "Pulando build do painel (--no-frontend)."
fi

# --- Fim ---------------------------------------------------------------------
step "Deploy concluído ${GREEN}✓${RESET}"
echo "Verifique: ${DIM}docker compose ps${RESET} e ${DIM}curl -s $HEALTH_URL${RESET} → {\"ok\":true}"
