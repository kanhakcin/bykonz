# Design: Migrar Supabase para PostgreSQL + AWS S3

## Contexto

O projeto usa Supabase como provider de banco de dados (via Prisma) e como object storage (via API S3-compatible). Em produção será usado PostgreSQL direto + AWS S3. Este documento descreve as mudanças necessárias para remover o acoplamento ao Supabase.

## Escopo

Apenas renomear, limpar e redirecionar — sem mudanças de comportamento ou lógica de negócio.

## 1. Banco de dados

O `schema.prisma` já usa `provider = "postgresql"`. A única particularidade do Supabase é o uso de duas URLs:

- `DATABASE_URL` — aponta para o connection pooler (PgBouncer) do Supabase
- `DIRECT_URL` — aponta para a conexão direta, exigida pelo Prisma para migrations

Com Postgres puro, há uma única URL de conexão. Remover `directUrl` do datasource e `DIRECT_URL` de todo o config.

**Mudanças:**
- `prisma/schema.prisma`: remove campo `directUrl = env("DIRECT_URL")`
- `src/config/env.ts`: remove `directUrl` da interface `AppConfig`, remove `"DIRECT_URL"` da lista de required, remove mapeamento `directUrl: env.DIRECT_URL!`

## 2. Object Storage

A classe `SupabaseObjectStorage` usa `@aws-sdk/client-s3` com `forcePathStyle: true` (necessário para o endpoint S3-compatible do Supabase/MinIO). Com AWS S3 real, `forcePathStyle` deve ser removido.

**Mudanças:**
- `src/lib/supabaseStorage.ts` → renomear para `src/lib/s3Storage.ts`
- Classe `SupabaseObjectStorage` → `S3ObjectStorage`
- Remover `forcePathStyle: true` do `S3Client`
- Mensagens de erro: "Supabase S3 upload failed" → "S3 upload failed", etc.
- Variável de env `SUPABASE_STORAGE_BUCKET` → `S3_BUCKET`
- Campo de config `supabaseStorageBucket` → `s3Bucket`

## 3. Container e testes

- `src/container.ts`: atualizar import de `SupabaseObjectStorage` → `S3ObjectStorage`, atualizar `config.supabaseStorageBucket` → `config.s3Bucket`
- `tests/supabaseStorage.test.ts` → renomear para `tests/s3Storage.test.ts`, atualizar imports e referências de classe

## 4. O que NÃO muda

- Interface `ObjectStorage` em `src/flows/types.ts` — não tem referência ao Supabase
- Migrations do Prisma — continuam válidas, o schema PostgreSQL é idêntico
- Toda a lógica de flows, conversationService, pdfGenerator
- Dependência `@aws-sdk/client-s3` no `package.json` — já é o SDK correto para AWS S3

## Variáveis de ambiente após a migração

| Variável | Antes | Depois |
|---|---|---|
| `DATABASE_URL` | URL do pooler Supabase | URL direta do Postgres |
| `DIRECT_URL` | URL direta Supabase | **removida** |
| `ENDPOINT` | Endpoint S3 Supabase | Endpoint AWS S3 (ou vazio para default) |
| `REGION` | Região Supabase | Região AWS |
| `ACCESS_KEY_ID` | Credencial Supabase | Credencial AWS |
| `SECRET_ACCESS_KEY` | Credencial Supabase | Credencial AWS |
| `SUPABASE_STORAGE_BUCKET` | Nome do bucket | **removida** |
| `S3_BUCKET` | — | Nome do bucket AWS |
