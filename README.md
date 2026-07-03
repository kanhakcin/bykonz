# Diário das Obras — Backend

Express and TypeScript backend for the Diário das Obras platform: a
WAHA-powered WhatsApp diary flow plus the manager-panel REST API
(`/api/v1`) consumed by the React frontend in [`frontend/`](frontend/).
Data lives in Postgres through Prisma; WhatsApp photos are uploaded to
private S3-compatible storage.

## Database

The schema follows the v1 multi-sector data architecture
(`docs/arquitetura-dados-nova-versao-v1.md`) with **English snake_case plural
table names** (`sectors`, `projects`, `assets`, `standards`, `people`,
`machines`, `entries`, `entry_mentions`, `alerts`, …). Prisma models are
PascalCase singular mapped via `@@map`/`@map`.

This is a **fresh database**: there is a single `init` migration. The legacy
Supabase instance (previous developer) is not migrated automatically — a data
import will be planned when a dump becomes available.

```bash
npm run prisma:migrate:deploy   # apply migrations (production)
npm run db:seed                 # demo/dev seed (re-runnable)
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the Postgres, WAHA, storage and
   panel values (`PANEL_API_TOKEN` enables the manager-panel API).

3. Generate the Prisma client and apply migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate     # dev
   npm run db:seed            # optional demo data
   ```

4. Start the API:

   ```bash
   npm run dev
   ```

Configure WAHA to send `message` webhooks to:

```text
POST http://localhost:8080/webhooks/waha
```

## Manager-panel API (`/api/v1`)

Enabled when `PANEL_API_TOKEN` is set. English contract; auth is a static
bearer token in v1 (RBAC is a future card).

- `POST /api/v1/auth/login` — `{ email, password }`; the password is the panel
  token. Returns `{ token, user }`.
- `GET /api/v1/diary?date=YYYY-MM-DD&projectId=` — aggregated day: project,
  KPIs, entries (with mentions + provenance), open alerts, AI triage.
- `POST /api/v1/alerts/:id/resolve` · `POST /api/v1/alerts/:id/acknowledge`
- `POST /api/v1/mentions/:id/confirm` · `POST /api/v1/mentions/:id/reject`

CORS origin is `PANEL_CORS_ORIGIN` (default `http://localhost:5173`). Day
boundaries use `PANEL_TZ_OFFSET` (default `-03:00`).

## Commands

```bash
npm test
npm run build
npm start
npm run db:seed
```

## Render deployment

Use these commands in Render:

```bash
# Build command
npm run build

# Start command
npm start
```

Before the new code serves traffic, apply production migrations:

```bash
npm run prisma:migrate:deploy
```

`npm run build` runs `prisma generate` before TypeScript compiles so Render uses
Prisma types generated from the checked-in schema.

## Flow

The active WhatsApp workflow is implemented as the modular
`DiarioDasObras` flow under `src/flows/DiarioDasObras`. `ConversationService`
handles WAHA/user/state plumbing and delegates conversation steps to that flow.

- First message: replies with seven options:
  `Inspecao de servico`, `Abrir nao conformidade`, `Recebimento de material`,
  `Plano de manutencao`, `Programa sol`, `Treinamento`, and
  `Gerar diario de obra`.
- `Inspecao de servico`: asks only for `Incluir`.
- Categories 2 through 5 ask for `Consulta` or `Incluir`.
- `Incluir`: asks for company when needed, service type, procedure number, and
  photo. The photo is saved to object storage through the S3-compatible API,
  `entries` and `entry_media` rows are created, then the user is asked for the
  description.
- `Treinamento`: asks for company when needed, training theme, participant names
  and CPFs, start/end date and time, one or more training photos, and a final
  training PDF or photo. The training media is saved to storage and
  `entry_media`, with training metadata saved in `trainings`.
- `Gerar diario de obra`: generates the `Inspecao de servico` PDF report by
  company and date.
- `0`, `menu`, and `cancelar` reset the conversation.
