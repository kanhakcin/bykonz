# Security Criticals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver os 3 findings críticos de segurança antes do deploy em produção: autenticação do webhook, mutex por chatId, e hardening do servidor Express.

**Architecture:** Três mudanças independentes e sequenciais: (1) autenticação por `WEBHOOK_SECRET` no header `x-webhook-secret`; (2) mutex em memória por `chatId` no `ConversationService`; (3) `helmet` + `express-rate-limit` no servidor Express. Cada task produz código testável de forma independente.

**Tech Stack:** TypeScript, Express 4, Vitest, Supertest, helmet, express-rate-limit

## Global Constraints

- Não modificar a interface `WebhookHandler` em `src/app.ts`
- Não modificar a interface `ConversationServiceDeps` em `src/flows/types.ts`
- Não modificar migrations em `prisma/migrations/`
- `npm test` deve passar após cada task
- Commitar após cada task

---

## File Map

| Arquivo | Ação |
|---|---|
| `src/config/env.ts` | Modify — adicionar `webhookSecret` opcional |
| `src/app.ts` | Modify — adicionar middleware de auth, helmet, rate limit |
| `src/services/conversationService.ts` | Modify — adicionar mutex por chatId |
| `tests/app.test.ts` | Modify — adicionar testes de autenticação |
| `tests/conversationService.test.ts` | Modify — adicionar teste de serialização |
| `.env` | Modify — adicionar WEBHOOK_SECRET |
| `.env.example` | Modify — documentar WEBHOOK_SECRET |

---

## Task 1: Autenticação do webhook (C1)

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/app.ts`
- Modify: `tests/app.test.ts`
- Modify: `.env`
- Modify: `.env.example`

**Interfaces:**
- Produces: `AppConfig.webhookSecret: string | undefined`; `createApp(handler, config)` com segundo parâmetro opcional

- [ ] **Step 1: Escrever testes que falham**

Substituir o conteúdo de `tests/app.test.ts` por:

```typescript
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type WebhookHandler } from "../src/app";
import type { WahaWebhook } from "../src/types/waha";

class FakeWebhookHandler implements WebhookHandler {
  calls: WahaWebhook[] = [];

  async handleWebhook(webhook: WahaWebhook): Promise<void> {
    this.calls.push(webhook);
  }
}

const PAYLOAD: WahaWebhook = {
  event: "message",
  session: "default",
  payload: {
    from: "5511999999999@c.us",
    body: "oi",
    hasMedia: false
  }
};

describe("Express app", () => {
  it("responds to health checks", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    await request(app).get("/health").expect(200, { ok: true });
  });

  it("passes WAHA webhook payloads to the handler when no secret configured", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    await request(app).post("/webhooks/waha").send(PAYLOAD).expect(200, { ok: true });

    expect(handler.calls).toEqual([PAYLOAD]);
  });

  it("rejects webhook without secret when secret is configured", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, "my-secret");

    await request(app).post("/webhooks/waha").send(PAYLOAD).expect(401);

    expect(handler.calls).toHaveLength(0);
  });

  it("rejects webhook with wrong secret", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, "my-secret");

    await request(app)
      .post("/webhooks/waha")
      .set("x-webhook-secret", "wrong-secret")
      .send(PAYLOAD)
      .expect(401);

    expect(handler.calls).toHaveLength(0);
  });

  it("accepts webhook with correct secret", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, "my-secret");

    await request(app)
      .post("/webhooks/waha")
      .set("x-webhook-secret", "my-secret")
      .send(PAYLOAD)
      .expect(200, { ok: true });

    expect(handler.calls).toEqual([PAYLOAD]);
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
npm test -- tests/app.test.ts
```

Expected: falha com `Expected: 401, Received: 200` nos novos testes.

- [ ] **Step 3: Adicionar `webhookSecret` ao `AppConfig` em `src/config/env.ts`**

Adicionar `webhookSecret: string | undefined` à interface e ao return de `loadConfig`:

```typescript
import "dotenv/config";

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  s3Endpoint: string | undefined;
  s3Region: string | undefined;
  s3AccessKeyId: string | undefined;
  s3SecretAccessKey: string | undefined;
  s3Bucket: string | undefined;
  webhookSecret: string | undefined;
  wahaBaseUrl: string;
  wahaApiKey: string;
  wahaSession: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = [
    "DATABASE_URL",
    "WAHA_BASE_URL",
    "WAHA_API_KEY",
    "WAHA_SESSION"
  ] as const;

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return {
    nodeEnv: env.NODE_ENV ?? "development",
    port,
    databaseUrl: env.DATABASE_URL!,
    s3Endpoint: env.ENDPOINT ? normalizeUrlOriginAndPath(env.ENDPOINT, "ENDPOINT") : undefined,
    s3Region: env.REGION,
    s3AccessKeyId: env.ACCESS_KEY_ID,
    s3SecretAccessKey: env.SECRET_ACCESS_KEY,
    s3Bucket: env.S3_BUCKET,
    webhookSecret: env.WEBHOOK_SECRET,
    wahaBaseUrl: env.WAHA_BASE_URL!.replace(/\/+$/, ""),
    wahaApiKey: env.WAHA_API_KEY!,
    wahaSession: env.WAHA_SESSION!
  };
}

export function normalizeUrlOriginAndPath(value: string, name: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}
```

- [ ] **Step 4: Atualizar `src/app.ts` com middleware de autenticação**

```typescript
import express, { type NextFunction, type Request, type Response } from "express";
import type { WahaWebhook } from "./types/waha";

export interface WebhookHandler {
  handleWebhook(webhook: WahaWebhook): Promise<void>;
}

export function createApp(webhookHandler: WebhookHandler, webhookSecret?: string): express.Express {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  app.post("/webhooks/waha", async (req: Request, res: Response, next: NextFunction) => {
    if (webhookSecret) {
      const token = req.headers["x-webhook-secret"];
      if (token !== webhookSecret) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }
    }

    try {
      await webhookHandler.handleWebhook(req.body as WahaWebhook);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  return app;
}
```

- [ ] **Step 5: Atualizar `src/index.ts` para passar o secret**

```typescript
import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { createConversationService } from "./container";
import { prisma } from "./lib/prisma";

const config = loadConfig();
const app = createApp(createConversationService(config), config.webhookSecret);
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
```

- [ ] **Step 6: Adicionar `WEBHOOK_SECRET` ao `.env` e `.env.example`**

Em `.env`, adicionar após `DATABASE_URL`:
```
WEBHOOK_SECRET="dev-secret-local"
```

Em `.env.example`, adicionar após `DATABASE_URL`:
```
# Webhook authentication — gerar com: openssl rand -hex 32
WEBHOOK_SECRET="[gerar com: openssl rand -hex 32]"
```

- [ ] **Step 7: Rodar todos os testes**

```bash
npm test
```

Expected: 72 testes passando (67 anteriores + 5 novos de app).

- [ ] **Step 8: Commit**

```bash
git add src/config/env.ts src/app.ts src/index.ts tests/app.test.ts .env.example
git commit -m "feat: authenticate webhook with x-webhook-secret header (C1)"
```

---

## Task 2: Mutex por chatId no ConversationService (C2)

**Files:**
- Modify: `src/services/conversationService.ts`
- Modify: `tests/conversationService.test.ts`

**Interfaces:**
- Consumes: `ConversationService` existente
- Produces: `ConversationService` com mutex interno — interface pública inalterada

- [ ] **Step 1: Ler o final do arquivo `tests/conversationService.test.ts` para entender a estrutura**

```bash
wc -l tests/conversationService.test.ts
```

Depois ler as últimas 30 linhas para ver como os testes estão estruturados e onde adicionar o novo.

- [ ] **Step 2: Adicionar teste de serialização ao `tests/conversationService.test.ts`**

Adicionar antes do último `});` que fecha o `describe` principal:

```typescript
  it("serializes concurrent messages for the same chatId", async () => {
    const store = new FakeStore();
    const messaging = new FakeMessagingClient();
    const service = new ConversationService(makeDeps(store, messaging));

    const user: UserRecord = {
      id: 1,
      phoneE164: PHONE,
      nome: "Test",
      cargo: null,
      empresas: [{ id: BigInt(1), nome: "Empresa" }]
    };
    store.users.set(PHONE, user);

    const order: number[] = [];
    const originalGetState = store.getState.bind(store);
    let callCount = 0;
    store.getState = async (chatId: string) => {
      const n = ++callCount;
      order.push(n);
      await new Promise((resolve) => setTimeout(resolve, n === 1 ? 20 : 0));
      return originalGetState(chatId);
    };

    const webhook = (body: string): WahaWebhook => ({
      event: "message",
      session: "default",
      payload: { from: `${PHONE}@c.us`, body, hasMedia: false }
    });

    await Promise.all([
      service.handleWebhook(webhook("msg1")),
      service.handleWebhook(webhook("msg2"))
    ]);

    // msg1 iniciou primeiro (callCount=1, delay=20ms) e msg2 esperou
    // então msg2 só chamou getState depois que msg1 terminou
    expect(order[0]).toBe(1);
    expect(order[1]).toBe(2);
  });
```

**Nota:** esse teste verifica que quando duas mensagens chegam simultaneamente, a segunda espera a primeira terminar. Para que funcione, você precisa encontrar uma função auxiliar `makeDeps` no arquivo de teste existente (ou criar uma). Leia o arquivo todo antes de adicionar para entender como instanciar o `ConversationService` nos testes existentes.

- [ ] **Step 3: Rodar o teste para confirmar que falha (sem mutex ainda)**

```bash
npm test -- tests/conversationService.test.ts
```

Expected: o teste de serialização pode passar ou falhar aleatoriamente sem mutex — confirmar comportamento atual.

- [ ] **Step 4: Adicionar mutex ao `src/services/conversationService.ts`**

Adicionar os campos e métodos privados à classe `ConversationService`, logo após a declaração de `flowRegistry`:

```typescript
export class ConversationService {
  private readonly flowRegistry: FlowRegistry;
  private readonly chatLocks = new Map<string, Promise<void>>();

  constructor(private readonly deps: ConversationServiceDeps) {
    this.flowRegistry = createFlowRegistry(deps);
  }

  async handleWebhook(webhook: WahaWebhook): Promise<void> {
    if (!this.isSupportedWebhook(webhook)) {
      return;
    }

    const payload = webhook.payload;
    const chatId = payload.from ?? payload.chatId;
    if (!chatId) {
      return;
    }

    await this.withChatLock(chatId, () => this.processWebhook(chatId, webhook));
  }

  private async withChatLock<T>(chatId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chatLocks.get(chatId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.chatLocks.set(chatId, prev.then(() => next));
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.chatLocks.get(chatId) === next) {
        this.chatLocks.delete(chatId);
      }
    }
  }

  private async processWebhook(chatId: string, webhook: WahaWebhook): Promise<void> {
    // mover todo o conteúdo atual de handleWebhook (após as verificações iniciais) para cá
    // começando em: const wahaPhoneDigits = extractPhoneFromWahaPayload(payload);
  }
  // ... restante do código existente
```

**Atenção:** o conteúdo do `handleWebhook` atual (a partir da linha `const wahaPhoneDigits = ...`) deve ser movido para `processWebhook`. O `handleWebhook` fica só com as verificações iniciais + chamada ao `withChatLock`.

O `processWebhook` precisa de acesso a `payload` — passe como parâmetro ou releia de `webhook.payload` no início do método. Use a segunda opção para simplicidade:

```typescript
private async processWebhook(chatId: string, webhook: WahaWebhook): Promise<void> {
  const payload = webhook.payload;
  // ... todo o código que estava em handleWebhook após "if (!chatId) return;"
}
```

- [ ] **Step 5: Rodar todos os testes**

```bash
npm test
```

Expected: todos os testes passam incluindo o novo de serialização.

- [ ] **Step 6: Commit**

```bash
git add src/services/conversationService.ts tests/conversationService.test.ts
git commit -m "feat: serialize concurrent webhook processing per chatId with mutex (C2)"
```

---

## Task 3: helmet + rate limiting no Express (C3)

**Files:**
- Modify: `src/app.ts`
- Modify: `tests/app.test.ts`
- Modify: `package.json` (via npm install)

**Interfaces:**
- Consumes: `createApp` da Task 1
- Produces: `createApp` com helmet e rate limiting — interface pública inalterada

- [ ] **Step 1: Instalar dependências**

```bash
npm install helmet express-rate-limit
npm install --save-dev @types/express-rate-limit
```

Verificar se `@types/express-rate-limit` é necessário (versões recentes incluem tipos):

```bash
npm ls express-rate-limit
```

- [ ] **Step 2: Adicionar testes de headers de segurança ao `tests/app.test.ts`**

Adicionar ao final do `describe`:

```typescript
  it("includes security headers from helmet", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    const res = await request(app).get("/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("rate limits excessive webhook requests", async () => {
    const handler = new FakeWebhookHandler();
    // limite baixo para teste
    const app = createApp(handler, undefined, { webhookRateLimit: 3 });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post("/webhooks/waha").send(PAYLOAD)
      )
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 3: Rodar testes para confirmar falha**

```bash
npm test -- tests/app.test.ts
```

Expected: falha nos novos testes (sem helmet nem rate limit ainda).

- [ ] **Step 4: Atualizar `src/app.ts` com helmet e rate limiting**

```typescript
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { WahaWebhook } from "./types/waha";

export interface WebhookHandler {
  handleWebhook(webhook: WahaWebhook): Promise<void>;
}

interface AppOptions {
  webhookRateLimit?: number;
}

export function createApp(
  webhookHandler: WebhookHandler,
  webhookSecret?: string,
  options: AppOptions = {}
): express.Express {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "10mb" }));

  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: options.webhookRateLimit ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  app.post("/webhooks/waha", webhookLimiter, async (req: Request, res: Response, next: NextFunction) => {
    if (webhookSecret) {
      const token = req.headers["x-webhook-secret"];
      if (token !== webhookSecret) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }
    }

    try {
      await webhookHandler.handleWebhook(req.body as WahaWebhook);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  return app;
}
```

- [ ] **Step 5: Rodar todos os testes**

```bash
npm test
```

Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/app.ts tests/app.test.ts package.json package-lock.json
git commit -m "feat: add helmet security headers and rate limiting to webhook endpoint (C3)"
```
