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

## Flow

- First message: replies with seven categories:
  `Diario de obra`, `Abrir nao conformidade`, `Inspecao de servico`,
  `Recebimento de material`, `Plano de manutencao`, `Programa sol`, and
  `Treinamento`.
- Then asks for `Consulta` or `Incluir`.
- `Incluir`: asks for company when needed, service type, procedure number, and
  photo. The photo is saved to Supabase Storage through the S3-compatible API,
  `Entrada` and `_EntradaMedia` are created, then the user is asked for the
  description.
- `Consulta`: returns the v1 relatorio placeholder.
- `0`, `menu`, and `cancelar` reset the conversation.
