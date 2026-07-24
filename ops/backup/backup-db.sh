#!/usr/bin/env bash
#
# Backup nightly do Postgres do "diário de obra".
#
# Faz: pg_dump (formato custom, comprimido) -> criptografia (gpg) -> upload S3
#      (bucket de backup, off-site) -> retenção local -> ping de healthcheck.
#
# Projetado para Postgres NATIVO no host de produção (não container).
# A versão do pg_dump do host deve ser >= a versão do servidor Postgres.
#
# Uso:   ./backup-db.sh
# Config: variáveis lidas de ./backup.env (veja backup.env.example).
#         Sobrescreva o caminho com BACKUP_CONFIG=/caminho/backup.env
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${BACKUP_CONFIG:-$SCRIPT_DIR/backup.env}"

log()  { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
die()  { log "ERROR: $*"; exit 1; }

# ---------------------------------------------------------------------------
# Carrega config (exporta tudo p/ aws-cli/gpg herdarem credenciais)
# ---------------------------------------------------------------------------
if [[ -f "$CONFIG_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
  set +a
else
  die "arquivo de config não encontrado: $CONFIG_FILE (copie backup.env.example)"
fi

# Defaults
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
LOCAL_DIR="${LOCAL_BACKUP_DIR:-/var/backups/diario-db}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-7}"
ENCRYPTION_MODE="${ENCRYPTION_MODE:-gpg-passphrase}"   # gpg-passphrase | gpg-recipient | none
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-5000}"
S3_PREFIX="${S3_PREFIX:-db}"

# Obrigatórias
: "${DATABASE_URL:?DATABASE_URL é obrigatório em backup.env}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET é obrigatório em backup.env}"

TMP=""
# ---------------------------------------------------------------------------
# Tratamento de erro: limpa parcial + avisa healthcheck de falha
# ---------------------------------------------------------------------------
on_error() {
  local ec=$?
  [[ -n "$TMP" && -f "$TMP" ]] && rm -f "$TMP"
  log "backup FALHOU (exit $ec)"
  if [[ -n "${HEALTHCHECK_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 "${HEALTHCHECK_URL%/}/fail" \
      --data-raw "backup failed exit=$ec" >/dev/null 2>&1 || true
  fi
  exit "$ec"
}
trap on_error ERR

# ---------------------------------------------------------------------------
# Pré-checagens de dependências
# ---------------------------------------------------------------------------
command -v "$PG_DUMP_BIN" >/dev/null || die "$PG_DUMP_BIN não encontrado no PATH"
command -v aws            >/dev/null || die "aws-cli não encontrado no PATH"
if [[ "$ENCRYPTION_MODE" != "none" ]]; then
  command -v gpg          >/dev/null || die "gpg não encontrado (necessário p/ ENCRYPTION_MODE=$ENCRYPTION_MODE)"
fi

mkdir -p "$LOCAL_DIR"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$LOCAL_DIR/diario-${TS}.dump"
[[ "$ENCRYPTION_MODE" != "none" ]] && OUT="${OUT}.gpg"
TMP="${OUT}.partial"

log "iniciando dump (formato custom) -> $OUT"

# ---------------------------------------------------------------------------
# Dump + (criptografia) para arquivo temporário.
# pipefail garante que uma falha no pg_dump aborta mesmo com o pipe do gpg.
# ---------------------------------------------------------------------------
case "$ENCRYPTION_MODE" in
  gpg-passphrase)
    : "${GPG_PASSPHRASE_FILE:?GPG_PASSPHRASE_FILE obrigatório p/ gpg-passphrase}"
    [[ -f "$GPG_PASSPHRASE_FILE" ]] || die "GPG_PASSPHRASE_FILE não existe: $GPG_PASSPHRASE_FILE"
    "$PG_DUMP_BIN" "$DATABASE_URL" -Fc \
      | gpg --batch --yes --symmetric --cipher-algo AES256 \
            --passphrase-file "$GPG_PASSPHRASE_FILE" -o "$TMP"
    ;;
  gpg-recipient)
    : "${GPG_RECIPIENT:?GPG_RECIPIENT obrigatório p/ gpg-recipient}"
    "$PG_DUMP_BIN" "$DATABASE_URL" -Fc \
      | gpg --batch --yes --encrypt --trust-model always \
            --recipient "$GPG_RECIPIENT" -o "$TMP"
    ;;
  none)
    "$PG_DUMP_BIN" "$DATABASE_URL" -Fc -f "$TMP"
    ;;
  *)
    die "ENCRYPTION_MODE inválido: $ENCRYPTION_MODE"
    ;;
esac

# ---------------------------------------------------------------------------
# Sanidade: dump não pode estar (quase) vazio
# ---------------------------------------------------------------------------
SIZE="$(stat -c%s "$TMP" 2>/dev/null || stat -f%z "$TMP")"
(( SIZE >= MIN_DUMP_BYTES )) || die "dump pequeno demais ($SIZE bytes < $MIN_DUMP_BYTES) — abortando"

mv "$TMP" "$OUT"
TMP=""
log "dump concluído: $OUT ($SIZE bytes)"

# ---------------------------------------------------------------------------
# Upload off-site (S3). Bucket de backup SEPARADO do de mídia.
# ---------------------------------------------------------------------------
KEY="${S3_PREFIX%/}/$(date -u +%Y/%m)/$(basename "$OUT")"
AWS_ARGS=(--only-show-errors)
[[ -n "${AWS_S3_ENDPOINT:-}" ]] && AWS_ARGS+=(--endpoint-url "$AWS_S3_ENDPOINT")
[[ -n "${AWS_REGION:-}" ]]      && AWS_ARGS+=(--region "$AWS_REGION")

log "enviando para s3://$BACKUP_S3_BUCKET/$KEY"
aws s3 cp "$OUT" "s3://$BACKUP_S3_BUCKET/$KEY" "${AWS_ARGS[@]}"

# ---------------------------------------------------------------------------
# Retenção local (a retenção de longo prazo fica no S3 via lifecycle — ver README)
# ---------------------------------------------------------------------------
find "$LOCAL_DIR" -type f -name 'diario-*.dump*' -mtime +"$LOCAL_RETENTION_DAYS" -print -delete \
  | while read -r f; do log "removido backup local antigo: $f"; done || true

# ---------------------------------------------------------------------------
# Sucesso: pinga healthcheck
# ---------------------------------------------------------------------------
if [[ -n "${HEALTHCHECK_URL:-}" ]]; then
  curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL" >/dev/null 2>&1 || log "aviso: ping de healthcheck falhou"
fi

log "backup OK -> s3://$BACKUP_S3_BUCKET/$KEY ($SIZE bytes)"
