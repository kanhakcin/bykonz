# Backup nightly do banco (Postgres nativo)

Backup automático do Postgres de produção: `pg_dump` (formato custom) →
criptografia (gpg) → upload para um bucket S3 **dedicado a backup** (off-site) →
retenção → ping de healthcheck. Segue a regra **3-2-1**: cópia local + cópia off-site,
fora da VPS.

> **Escopo:** cobre o **banco**. Mídia (fotos) já vive no S3 da app — ative
> *versioning + lifecycle* naquele bucket separadamente. Segredos (`.env`) devem ser
> guardados num cofre à parte; sem eles o restore não sobe a aplicação.

> **Onde rodar (topologia de 2 servidores: `server DB` + `server APP`):**
> instale e agende no **`server DB`**. Motivos: a versão do `pg_dump` casa com o
> servidor sem esforço, o dump é local (não trafega a base pela rede toda noite) e não
> exige abrir acesso remoto de nível pg_dump. Nesse caso a `DATABASE_URL` do
> `backup.env` aponta para **`localhost`** (e não para o host remoto que o app usa), e o
> `server DB` precisa de **saída HTTPS para o S3**. Só rode no `server APP` se o
> `server DB` não tiver rota para o S3 — aí você paga versão de client + tráfego de rede.

## Arquivos

| Arquivo | O quê |
|---|---|
| `backup-db.sh` | Script do backup (roda via cron). |
| `backup.env.example` | Modelo de config. Copie para `backup.env` e preencha. |
| `backup.env` | **Não versionado** (segredos). |

## Deploy no `server DB` (sem clonar o repositório)

O `server DB` só tem o Postgres — **não precisa do repositório**. O `backup-db.sh` é
autossuficiente (só depende de `pg_dump`/`aws`/`gpg`/`curl` + do `backup.env` ao lado).
Copie apenas os 2 arquivos para uma pasta própria:

```bash
# da máquina que tem o repo (dev / server APP):
scp ops/backup/backup-db.sh usuario@server-db:/tmp/

# no server DB:
sudo mkdir -p /opt/diario-backup
sudo mv /tmp/backup-db.sh /opt/diario-backup/ && sudo chmod +x /opt/diario-backup/backup-db.sh
# crie o backup.env a partir do backup.env.example do repo, preenchido, e proteja:
sudo chmod 600 /opt/diario-backup/backup.env
```
O restante do setup abaixo roda a partir de `/opt/diario-backup/`.
**Drift:** ao alterar `backup-db.sh` no repo, re-copie para o `server DB`.

## Setup (uma vez, no `server DB`)

### 1. Dependências
```bash
# Debian/Ubuntu
sudo apt-get update && sudo apt-get install -y postgresql-client gnupg curl awscli
# confira que a versão do pg_dump é >= a do servidor:
pg_dump --version && psql -c 'show server_version;'
```
> Se o `pg_dump` do sistema for mais antigo que o servidor, aponte `PG_DUMP_BIN` para o
> binário da versão certa (ex.: `/usr/lib/postgresql/16/bin/pg_dump`).

### 2. Bucket de backup (SEPARADO do de mídia)
Crie um bucket só para backup, de preferência em **outra região** (ou outra conta):
```bash
aws s3api create-bucket --bucket meu-bucket-backup-diario \
  --region us-east-1
# bloquear acesso público:
aws s3api put-public-access-block --bucket meu-bucket-backup-diario \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

**Retenção de longo prazo via lifecycle** (em vez de script de limpeza próprio):
`lifecycle.json` —
```json
{ "Rules": [
  { "ID": "expira-backups-antigos", "Status": "Enabled",
    "Filter": { "Prefix": "db/" },
    "Expiration": { "Days": 180 } }
] }
```
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket meu-bucket-backup-diario \
  --lifecycle-configuration file://lifecycle.json
```
Ative também **versioning** no bucket (protege contra sobrescrita/exclusão acidental).

### 3. IAM least-privilege
Credenciais do backup só precisam de `PutObject` (e opcionalmente `ListBucket`) **no
bucket de backup** — nunca reuse as chaves de admin. Política mínima:
```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["s3:PutObject"],
    "Resource": "arn:aws:s3:::meu-bucket-backup-diario/*" }
] }
```

### 4. Criptografia
**Recomendado — assimétrico (`gpg-recipient`):** a VPS carrega só a chave *pública*,
então nem o servidor comprometido consegue ler backups antigos. Guarde a chave privada
**fora da VPS**.
```bash
# numa máquina segura (NÃO a VPS): gere o par e exporte a pública
gpg --quick-generate-key "backup@empresa.com.br"
gpg --export --armor backup@empresa.com.br > backup-pub.asc
# na VPS: importe só a pública
gpg --import backup-pub.asc
# backup.env: ENCRYPTION_MODE="gpg-recipient"  GPG_RECIPIENT="backup@empresa.com.br"
```
**Alternativa simples — simétrico (`gpg-passphrase`):** uma senha forte num arquivo.
Guarde a senha **fora da VPS** (sem ela o backup é irrecuperável).
```bash
openssl rand -base64 48 > /root/.diario-backup-pass
chmod 600 /root/.diario-backup-pass
# e salve essa senha no seu cofre/gerenciador de senhas, off-site.
```

### 5. Config e permissões
```bash
cd ops/backup
cp backup.env.example backup.env
chmod 600 backup.env
chmod +x backup-db.sh
# edite backup.env com DATABASE_URL, bucket, credenciais, criptografia, healthcheck
```

### 6. Monitorar falha (dead man's switch)
Crie um check em https://healthchecks.io (ou similar), período diário + grace de algumas
horas, e cole a URL em `HEALTHCHECK_URL`. O script pinga no sucesso e em `/fail` na
falha — se o ping **sumir**, você é alertado (pega o caso do cron quebrar em silêncio).

### 7. Teste manual antes de agendar
```bash
./backup-db.sh
aws s3 ls s3://meu-bucket-backup-diario/db/ --recursive | tail
```

### 8. Agendar (cron às 3h)
```bash
sudo crontab -e
```
```
0 3 * * * /opt/diario-backup/backup-db.sh >> /var/log/diario-backup.log 2>&1
```

## Restore (runbook)

> Teste isto **antes** de precisar de verdade. Faça um restore de teste ~mensal.

```bash
# 1. Baixe o backup desejado
aws s3 cp s3://meu-bucket-backup-diario/db/2026/07/diario-XXXX.dump.gpg .

# 2. Descriptografe
#    gpg-passphrase:
gpg --batch --passphrase-file /root/.diario-backup-pass \
    -o diario.dump -d diario-XXXX.dump.gpg
#    gpg-recipient (precisa da chave PRIVADA, guardada off-site):
gpg -o diario.dump -d diario-XXXX.dump.gpg

# 3a. Restore num banco de TESTE (validação — recomendado periodicamente)
createdb diario_restore_test
pg_restore -d diario_restore_test --clean --if-exists --no-owner diario.dump
psql -d diario_restore_test -c 'SELECT count(*) FROM entries;'
dropdb diario_restore_test

# 3b. Restore de DESASTRE sobre o banco real (CUIDADO: sobrescreve dados)
#     Pare a aplicação antes. --clean derruba objetos existentes.
pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner diario.dump
```

## Checklist de "pronto"
- [ ] `backup-db.sh` roda manualmente com sucesso e o arquivo aparece no S3
- [ ] bucket de backup separado, privado, com **versioning + lifecycle**
- [ ] credenciais IAM least-privilege (só PutObject no bucket de backup)
- [ ] backups **criptografados**; chave/senha guardada **fora da VPS**
- [ ] `HEALTHCHECK_URL` configurado e alertando
- [ ] **1 restore de teste** concluído com sucesso
- [ ] cron às 3h ativo
- [ ] (à parte) versioning no bucket de mídia + `.env` num cofre off-site

## Próximo degrau (se 24h de perda for demais)
Nightly = até ~24h de dados em risco. Para recuperação ao-minuto, migre para **PITR**
com WAL archiving — o caminho mais simples é o **pgBackRest**, que empacota dump full +
incremental + WAL + retenção + verificação de integridade num único tooling.
