# WhatsApp Management Backend

Express and TypeScript backend for a WAHA-powered WhatsApp management flow.
It stores records in Supabase Postgres through Prisma and uploads WhatsApp
photos to private Supabase Storage.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the Supabase, Prisma, WAHA, and
   Supabase S3-compatible storage values.

3. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Apply the Prisma schema to Supabase when you are ready:

   ```bash
   npm run prisma:migrate
   ```

5. Start the API:

   ```bash
   npm run dev
   ```

Configure WAHA to send `message` webhooks to:

```text
POST http://localhost:8080/webhooks/waha
```

## Commands

```bash
npm test
npm run build
npm start
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

- First message: replies with seven options:
  `Inspecao de servico`, `Abrir nao conformidade`, `Recebimento de material`,
  `Plano de manutencao`, `Programa sol`, `Treinamento`, and
  `Gerar diario de obra`.
- `Inspecao de servico`: asks only for `Incluir`.
- Categories 2 through 5 ask for `Consulta` or `Incluir`.
- `Incluir`: asks for company when needed, service type, procedure number, and
  photo. The photo is saved to Supabase Storage through the S3-compatible API,
  `Entrada` and `_EntradaMedia` are created, then the user is asked for the
  description.
- `Treinamento`: asks for company when needed, training theme, participant names
  and CPFs, start/end date and time, one or more training photos, and a final
  training PDF or photo. The training media is saved to Supabase Storage and
  `_EntradaMedia`, with training metadata saved in `Treinamento`.
- `Gerar diario de obra`: generates the `Inspecao de servico` PDF report by
  company and date.
- `0`, `menu`, and `cancelar` reset the conversation.
