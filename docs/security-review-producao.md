# Revisão de Segurança — Preparação para Produção

**Projeto:** bykonz-diario-de-obra-chris  
**Data:** 2026-06-29  
**Resultado:** 13 findings — 3 Critical · 5 Important · 5 Minor

---

## Resumo Executivo

| Severidade | Qtd | Ação |
|---|---|---|
| Critical | 3 | Resolver **antes** de ir a produção |
| Important | 5 | Resolver antes ou logo após deploy |
| Minor | 5 | Resolver no próximo ciclo |

O que está bem: nenhum SQL raw (tudo via Prisma), sem path traversal no S3, error handler global não vaza stack traces, proteção anti-loop implementada (`fromMe`, `source === "api"`).

---

## Critical

### C1 — Webhook sem autenticação
**Arquivo:** `src/app.ts:17`  
**Impacto:** Qualquer pessoa na internet pode fazer `POST /webhooks/waha` injetando mensagens falsas em nome de qualquer usuário cadastrado. Não requer credenciais.

**Correção:** Validar um token secreto compartilhado no header, ou verificar HMAC-SHA256 do corpo assinado pelo WAHA.

```typescript
// src/app.ts — middleware de autenticação do webhook
function webhookAuthMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers["x-webhook-secret"];
    if (token !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}

// Aplicar na rota:
app.post("/webhooks/waha",
  webhookAuthMiddleware(config.webhookSecret),
  async (req, res, next) => { ... }
);
```

Adicionar `WEBHOOK_SECRET` ao `.env` e `AppConfig`.

---

### C2 — Race condition por chatId
**Arquivo:** `src/services/conversationService.ts:103–144`  
**Impacto:** Duas mensagens do mesmo número entregues simultaneamente leem o mesmo estado do banco e criam entradas duplicadas (duas `Entrada` para uma mesma foto, por exemplo). Causa corrupção silenciosa de dados.

**Correção:** Mutex em memória por `chatId` para instância única, ou advisory lock PostgreSQL para multi-instância.

```typescript
// src/services/conversationService.ts
private readonly locks = new Map<string, Promise<void>>();

private async withChatLock<T>(chatId: string, fn: () => Promise<T>): Promise<T> {
  const prev = this.locks.get(chatId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  this.locks.set(chatId, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (this.locks.get(chatId) === next) {
      this.locks.delete(chatId);
    }
  }
}

// Envolver o processamento principal:
async handleWebhook(webhook: WahaWebhook): Promise<void> {
  // ... validações iniciais ...
  await this.withChatLock(chatId, () => this.processWebhook(chatId, webhook));
}
```

---

### C3 — Sem helmet, sem rate limiting, Express expõe X-Powered-By
**Arquivo:** `src/app.ts`  
**Impacto:** Sem `helmet`, headers de segurança ausentes (CSP, HSTS, X-Frame-Options). Sem rate limiting, um atacante pode esgotar o pool de conexões do banco com rajadas antes de qualquer autenticação. `X-Powered-By: Express` expõe a stack.

**Correção:**

```bash
npm install helmet express-rate-limit
```

```typescript
// src/app.ts
import helmet from "helmet";
import rateLimit from "express-rate-limit";

app.use(helmet());
app.disable("x-powered-by"); // redundante com helmet, mas explícito

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minuto
  max: 100,              // 100 requisições por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/webhooks/waha", webhookLimiter, ...);
```

---

## Important

### I1 — Payload do webhook sem validação de schema em runtime
**Arquivo:** `src/app.ts:17`, `src/types/waha.ts`  
**Impacto:** O cast `req.body as WahaWebhook` não valida nada em runtime. Um payload malformado ou malicioso pode propagar dados inesperados por toda a lógica de negócio, causando comportamento indefinido.

**Correção:** Adicionar Zod para validar o schema na entrada.

```bash
npm install zod
```

```typescript
// src/types/waha.ts — adicionar schema Zod
import { z } from "zod";

export const WahaWebhookSchema = z.object({
  event: z.string(),
  session: z.string(),
  payload: z.object({
    from: z.string().optional(),
    chatId: z.string().optional(),
    body: z.string().optional(),
    hasMedia: z.boolean().optional(),
    fromMe: z.boolean().optional(),
    source: z.string().optional(),
    _data: z.record(z.unknown()).optional(),
  }),
});

// src/app.ts — validar antes de processar
const parsed = WahaWebhookSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ error: "Invalid payload" });
  return;
}
await webhookHandler.handleWebhook(parsed.data);
```

---

### I2 — Body parser com limite de 10 MB
**Arquivo:** `src/app.ts` (`express.json({ limit: "10mb" })`)  
**Impacto:** Payloads WAHA legítimos raramente excedem alguns KB. O limite de 10 MB permite que atacantes enviem requisições grandes para degradar performance antes mesmo de qualquer lógica ser executada.

**Correção:** Reduzir para 512 KB no webhook. Se uploads de mídia forem necessários via body (improvável — o WAHA envia URLs), criar rota separada com limite maior.

```typescript
app.use(express.json({ limit: "512kb" }));
```

---

### I3 — Sem limite de tamanho no download de mídia
**Arquivo:** `src/lib/wahaClient.ts` (método de download de mídia)  
**Impacto:** `Buffer.from(await response.arrayBuffer())` sem verificar `Content-Length` pode esgotar o heap do processo Node.js com um arquivo grande ou malicioso retornado pelo WAHA.

**Correção:** Verificar `Content-Length` antes de fazer o buffer, e aplicar um limite máximo (ex: 50 MB para vídeos, 10 MB para imagens).

```typescript
const MAX_MEDIA_SIZE = 50 * 1024 * 1024; // 50 MB

const contentLength = Number(response.headers.get("content-length") ?? 0);
if (contentLength > MAX_MEDIA_SIZE) {
  throw new Error(`Media file too large: ${contentLength} bytes`);
}
```

---

### I4 — Logs de debug expõem números de telefone completos
**Arquivo:** `src/services/conversationService.ts:54–63`  
**Impacto:** `wahaPhoneDigits` e `phoneLookupCandidates` com números completos aparecem nos logs. Em produção com agregador de logs (CloudWatch, Datadog), esses dados ficam acessíveis a qualquer um com acesso aos logs — potencial violação de LGPD.

**Correção:** Mascarar para os últimos 4 dígitos nos logs.

```typescript
function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `****${phone.slice(-4)}`;
}

this.logWahaDebug("WAHA webhook phone lookup started", {
  // ...
  wahaPhoneDigits: maskPhone(wahaPhoneDigits),
  phoneLookupCandidates: phoneLookupCandidates.map(maskPhone),
});
```

---

### I5 — Dependência com vulnerabilidade HIGH (form-data)
**Arquivo:** `package.json` (dependência transitiva via `@aws-sdk/client-s3`)  
**Impacto:** `form-data` tem vulnerabilidade CVSS 7.5 em versão desatualizada.

**Correção:**

```bash
npm audit fix
npm audit  # verificar se resolveu
```

Se não resolver automaticamente:

```bash
npm update form-data
```

---

## Minor

### M1 — Sem timeout nas chamadas ao WAHA
**Arquivo:** `src/lib/wahaClient.ts`  
**Impacto:** Se o WAHA travar ou demorar, as requisições ficam pendentes indefinidamente, travando o event loop do Node.js.

**Correção:** Adicionar timeout no fetch.

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000); // 10s
try {
  const response = await fetch(url, { signal: controller.signal, ... });
} finally {
  clearTimeout(timeout);
}
```

---

### M2 — Sem timeout nas operações S3
**Arquivo:** `src/lib/s3Storage.ts`  
**Correção:** Configurar `requestHandler` com timeout no `S3Client`.

```typescript
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";

new S3Client({
  requestHandler: new NodeHttpHandler({
    requestTimeout: 30_000,    // 30s
    connectionTimeout: 5_000,  // 5s
  }),
  // ...
});
```

---

### M3 — CORS não configurado explicitamente
**Arquivo:** `src/app.ts`  
**Impacto:** Express sem CORS usa o padrão permissivo em alguns cenários. Para uma API de webhook, não há necessidade de CORS (não é chamada de browser), mas é bom tornar isso explícito.

**Correção:**

```typescript
// Bloquear CORS completamente — essa API não é chamada de browsers
app.use((_req, res, next) => {
  res.removeHeader("Access-Control-Allow-Origin");
  next();
});
```

Ou se o dashboard admin precisar de CORS, restringir à origem específica.

---

### M4 — `NODE_ENV` não validado
**Arquivo:** `src/config/env.ts`  
**Impacto:** Um valor inválido em `NODE_ENV` pode causar comportamento inesperado em bibliotecas que dependem dele.

**Correção:**

```typescript
const validEnvs = ["development", "production", "test"] as const;
const nodeEnv = env.NODE_ENV ?? "development";
if (!validEnvs.includes(nodeEnv as typeof validEnvs[number])) {
  throw new Error(`NODE_ENV must be one of: ${validEnvs.join(", ")}`);
}
```

---

### M5 — Senha gerada aleatoriamente no WAHA não documentada
**Escopo:** Operacional (não código)  
**Impacto:** O WAHA gera senha aleatória do dashboard se `WAHA_DASHBOARD_PASSWORD` não for definida — risco de perda de acesso após restart.

**Correção:** Documentar no `.env.example` e sempre definir `WAHA_DASHBOARD_PASSWORD` e `WAHA_DASHBOARD_USERNAME` no ambiente de produção.

---

## Checklist para Produção

### Antes do deploy (Critical)
- [ ] **C1** — Implementar autenticação no webhook (`WEBHOOK_SECRET` + middleware)
- [ ] **C2** — Implementar mutex por `chatId` no `ConversationService`
- [ ] **C3** — Instalar `helmet` + `express-rate-limit`, remover `X-Powered-By`

### Antes ou logo após deploy (Important)
- [ ] **I1** — Validar payload do webhook com Zod
- [ ] **I2** — Reduzir body parser de 10 MB para 512 KB
- [ ] **I3** — Adicionar limite de tamanho no download de mídia do WAHA
- [ ] **I4** — Mascarar números de telefone nos logs
- [ ] **I5** — Rodar `npm audit fix` para corrigir vulnerabilidade do `form-data`

### Próximo ciclo (Minor)
- [ ] **M1** — Timeout nas chamadas HTTP ao WAHA (10s)
- [ ] **M2** — Timeout nas operações S3 (30s request, 5s connection)
- [ ] **M3** — Configurar CORS explicitamente (bloquear para API de webhook)
- [ ] **M4** — Validar valores permitidos de `NODE_ENV`
- [ ] **M5** — Definir `WAHA_DASHBOARD_PASSWORD` fixo no ambiente de produção

---

## Variáveis de ambiente a adicionar

```env
# Segurança do webhook
WEBHOOK_SECRET="[gerar com: openssl rand -hex 32]"

# WAHA dashboard (produção)
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD="[senha segura]"
```

Atualizar `AppConfig` e `loadConfig()` em `src/config/env.ts` para incluir `webhookSecret`.
