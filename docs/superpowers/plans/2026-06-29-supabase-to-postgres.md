# Migrar Supabase para PostgreSQL + AWS S3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Supabase-specific configuration and rename storage abstractions so the app connects directly to a plain PostgreSQL database and AWS S3.

**Architecture:** Three independent changes: (1) drop `DIRECT_URL` from Prisma schema and config, (2) rename the S3 storage class/file and update its config field + env var, (3) update the test file for the storage class. No business logic changes.

**Tech Stack:** TypeScript, Prisma 6, `@aws-sdk/client-s3`, Vitest

## Global Constraints

- Do NOT change the `ObjectStorage` interface in `src/flows/types.ts`
- Do NOT touch any migration files under `prisma/migrations/`
- Do NOT modify `package.json` dependencies — `@aws-sdk/client-s3` stays as-is
- Run `npm test` after each task to confirm no regressions
- Commit after each task

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Modify — remove `directUrl` line |
| `src/config/env.ts` | Modify — remove `directUrl`/`DIRECT_URL`, rename `supabaseStorageBucket`→`s3Bucket` / `SUPABASE_STORAGE_BUCKET`→`S3_BUCKET` |
| `src/lib/supabaseStorage.ts` | Delete (replaced by `s3Storage.ts`) |
| `src/lib/s3Storage.ts` | Create — same content, renamed class, removed `forcePathStyle`, updated error messages |
| `src/container.ts` | Modify — update import and config field |
| `tests/supabaseStorage.test.ts` | Delete (replaced by `s3Storage.test.ts`) |
| `tests/s3Storage.test.ts` | Create — same tests, updated imports and class name |
| `tests/configEnv.test.ts` | Modify — remove `DIRECT_URL` from test env, rename `SUPABASE_STORAGE_BUCKET`→`S3_BUCKET`, update assertions |

---

## Task 1: Remove `directUrl` from Prisma schema and env config

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/config/env.ts`
- Modify: `tests/configEnv.test.ts`

**Interfaces:**
- Produces: `AppConfig` without `directUrl` field; `loadConfig()` no longer requires `DIRECT_URL`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Remove the `directUrl` line. Result:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Update `src/config/env.ts`**

Remove `directUrl: string` from the interface, `"DIRECT_URL"` from the required array, and `directUrl: env.DIRECT_URL!` from the return object. Result:

```typescript
import "dotenv/config";

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  s3Endpoint: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  supabaseStorageBucket: string;
  wahaBaseUrl: string;
  wahaApiKey: string;
  wahaSession: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = [
    "DATABASE_URL",
    "ENDPOINT",
    "REGION",
    "ACCESS_KEY_ID",
    "SECRET_ACCESS_KEY",
    "SUPABASE_STORAGE_BUCKET",
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
    s3Endpoint: normalizeUrlOriginAndPath(env.ENDPOINT!, "ENDPOINT"),
    s3Region: env.REGION!,
    s3AccessKeyId: env.ACCESS_KEY_ID!,
    s3SecretAccessKey: env.SECRET_ACCESS_KEY!,
    supabaseStorageBucket: env.SUPABASE_STORAGE_BUCKET!,
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

- [ ] **Step 3: Update `tests/configEnv.test.ts`**

Remove `DIRECT_URL` from the test env object passed to `loadConfig`. Result:

```typescript
import { describe, expect, it } from "vitest";
import { loadConfig, normalizeUrlOriginAndPath } from "../src/config/env";

describe("env config", () => {
  it("normalizes URLs while preserving path", () => {
    expect(
      normalizeUrlOriginAndPath("https://project-ref.storage.supabase.co/storage/v1/s3/", "ENDPOINT")
    ).toBe(
      "https://project-ref.storage.supabase.co/storage/v1/s3"
    );
  });

  it("loads S3 storage config", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://user:pass@example.com:5432/postgres",
      ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3/",
      REGION: "sa-east-1",
      ACCESS_KEY_ID: "access-key",
      SECRET_ACCESS_KEY: "secret-key",
      SUPABASE_STORAGE_BUCKET: "tatacon",
      WAHA_BASE_URL: "http://localhost:3000/",
      WAHA_API_KEY: "waha-key",
      WAHA_SESSION: "default"
    });

    expect(config.s3Endpoint).toBe("https://project-ref.storage.supabase.co/storage/v1/s3");
    expect(config.s3Region).toBe("sa-east-1");
    expect(config.s3AccessKeyId).toBe("access-key");
    expect(config.s3SecretAccessKey).toBe("secret-key");
    expect(config.wahaBaseUrl).toBe("http://localhost:3000");
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass (the `configEnv` suite especially).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/config/env.ts tests/configEnv.test.ts
git commit -m "feat: remove DIRECT_URL — connect directly to PostgreSQL"
```

---

## Task 2: Rename S3 storage class and env var

**Files:**
- Create: `src/lib/s3Storage.ts`
- Delete: `src/lib/supabaseStorage.ts`
- Modify: `src/config/env.ts`
- Modify: `src/container.ts`

**Interfaces:**
- Consumes: `AppConfig` from Task 1 (without `directUrl`)
- Produces: `S3ObjectStorage` class with same `uploadPrivateObject` / `downloadPrivateObject` signatures; `AppConfig.s3Bucket: string`

- [ ] **Step 1: Create `src/lib/s3Storage.ts`**

```typescript
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppConfig } from "../config/env";
import type { ObjectStorage } from "../services/conversationService";

interface S3Sender {
  send(command: PutObjectCommand | GetObjectCommand): Promise<unknown>;
}

export class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3Sender,
    private readonly bucket: string
  ) {}

  static fromConfig(config: AppConfig): S3ObjectStorage {
    const client = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey
      }
    });

    return new S3ObjectStorage(client, config.s3Bucket);
  }

  async uploadPrivateObject(input: {
    path: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.path,
          Body: input.body,
          ContentType: input.contentType
        })
      );
    } catch (error) {
      throw new Error(`S3 upload failed: ${formatStorageError(error)}`);
    }
  }

  async downloadPrivateObject(path: string): Promise<Buffer> {
    let response: unknown;
    try {
      response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: path
        })
      );
    } catch (error) {
      throw new Error(`S3 download failed: ${formatStorageError(error)}`);
    }

    const body = (response as { Body?: unknown }).Body;
    if (!body) {
      throw new Error(`S3 download returned empty body for key: ${path}`);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

function formatStorageError(error: unknown): string {
  if (!isRecord(error)) {
    return String(error);
  }

  const fields = [
    ["name", error.name],
    ["code", error.Code],
    ["bucket", error.BucketName],
    ["key", error.Key],
    ["status", error.status],
    ["statusCode", error.statusCode],
    ["httpStatusCode", isRecord(error.$metadata) ? error.$metadata.httpStatusCode : undefined],
    ["error", error.error],
    ["message", error.message]
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`);

  return fields.length > 0 ? fields.join(" ") : JSON.stringify(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 2: Update `src/config/env.ts` — rename `supabaseStorageBucket` → `s3Bucket` e `SUPABASE_STORAGE_BUCKET` → `S3_BUCKET`**

```typescript
import "dotenv/config";

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  s3Endpoint: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Bucket: string;
  wahaBaseUrl: string;
  wahaApiKey: string;
  wahaSession: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = [
    "DATABASE_URL",
    "ENDPOINT",
    "REGION",
    "ACCESS_KEY_ID",
    "SECRET_ACCESS_KEY",
    "S3_BUCKET",
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
    s3Endpoint: normalizeUrlOriginAndPath(env.ENDPOINT!, "ENDPOINT"),
    s3Region: env.REGION!,
    s3AccessKeyId: env.ACCESS_KEY_ID!,
    s3SecretAccessKey: env.SECRET_ACCESS_KEY!,
    s3Bucket: env.S3_BUCKET!,
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

- [ ] **Step 3: Update `src/container.ts`**

```typescript
import type { AppConfig } from "./config/env";
import { WahaClient } from "./lib/wahaClient";
import { prisma } from "./lib/prisma";
import { S3ObjectStorage } from "./lib/s3Storage";
import { PdfReportGenerator } from "./lib/pdfGenerator";
import { ConversationService } from "./services/conversationService";
import { PrismaConversationStore } from "./services/prismaConversationStore";

export function createConversationService(config: AppConfig): ConversationService {
  const wahaClient = WahaClient.fromConfig(config);
  const objectStorage = S3ObjectStorage.fromConfig(config);

  return new ConversationService({
    store: new PrismaConversationStore(prisma),
    messaging: wahaClient,
    mediaDownloader: wahaClient,
    objectStorage,
    pdfGenerator: new PdfReportGenerator(objectStorage)
  });
}
```

- [ ] **Step 4: Delete `src/lib/supabaseStorage.ts`**

```bash
git rm src/lib/supabaseStorage.ts
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: todos os testes passam. Se falhar em `configEnv` com `Missing required environment variables: S3_BUCKET`, confirme que `tests/configEnv.test.ts` também foi atualizado no próximo passo.

- [ ] **Step 6: Commit**

```bash
git add src/lib/s3Storage.ts src/config/env.ts src/container.ts
git commit -m "feat: rename SupabaseObjectStorage to S3ObjectStorage, use S3_BUCKET env var"
```

---

## Task 3: Update storage test file

**Files:**
- Create: `tests/s3Storage.test.ts`
- Delete: `tests/supabaseStorage.test.ts`
- Modify: `tests/configEnv.test.ts`

**Interfaces:**
- Consumes: `S3ObjectStorage` from Task 2; `AppConfig.s3Bucket` from Task 2

- [ ] **Step 1: Create `tests/s3Storage.test.ts`**

```typescript
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { S3ObjectStorage } from "../src/lib/s3Storage";

describe("S3ObjectStorage", () => {
  it("uploads objects with S3 PutObjectCommand", async () => {
    const sent: Array<PutObjectCommand | GetObjectCommand> = [];
    const storage = new S3ObjectStorage(
      {
        send: async (command: PutObjectCommand | GetObjectCommand) => {
          sent.push(command);
          return {};
        }
      },
      "tatacon"
    );

    await storage.uploadPrivateObject({
      path: "entradas/10/7/2026-06-04/photo.jpg",
      body: Buffer.from("image-bytes"),
      contentType: "image/jpeg"
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].input).toMatchObject({
      Bucket: "tatacon",
      Key: "entradas/10/7/2026-06-04/photo.jpg",
      ContentType: "image/jpeg"
    });
    expect((sent[0] as PutObjectCommand).input.Body).toEqual(Buffer.from("image-bytes"));
  });

  it("downloads objects with S3 GetObjectCommand", async () => {
    const imageData = Buffer.from("image-bytes");
    const sent: Array<PutObjectCommand | GetObjectCommand> = [];

    const storage = new S3ObjectStorage(
      {
        send: async (command: PutObjectCommand | GetObjectCommand) => {
          sent.push(command);
          if (command instanceof GetObjectCommand) {
            return {
              Body: (async function* () {
                yield imageData;
              })()
            };
          }
          return {};
        }
      },
      "tatacon"
    );

    const result = await storage.downloadPrivateObject("entradas/10/7/2026-06-04/photo.jpg");

    expect(result).toEqual(imageData);
    expect(sent).toHaveLength(1);
    expect(sent[0].input).toMatchObject({
      Bucket: "tatacon",
      Key: "entradas/10/7/2026-06-04/photo.jpg"
    });
  });

  it("throws when download returns no body", async () => {
    const storage = new S3ObjectStorage(
      {
        send: async () => ({ Body: undefined })
      },
      "tatacon"
    );

    await expect(storage.downloadPrivateObject("some/path.jpg")).rejects.toThrow("empty body");
  });
});
```

- [ ] **Step 2: Update `tests/configEnv.test.ts` — rename `SUPABASE_STORAGE_BUCKET` → `S3_BUCKET`**

```typescript
import { describe, expect, it } from "vitest";
import { loadConfig, normalizeUrlOriginAndPath } from "../src/config/env";

describe("env config", () => {
  it("normalizes URLs while preserving path", () => {
    expect(
      normalizeUrlOriginAndPath("https://project-ref.storage.supabase.co/storage/v1/s3/", "ENDPOINT")
    ).toBe(
      "https://project-ref.storage.supabase.co/storage/v1/s3"
    );
  });

  it("loads S3 storage config", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://user:pass@example.com:5432/postgres",
      ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3/",
      REGION: "sa-east-1",
      ACCESS_KEY_ID: "access-key",
      SECRET_ACCESS_KEY: "secret-key",
      S3_BUCKET: "tatacon",
      WAHA_BASE_URL: "http://localhost:3000/",
      WAHA_API_KEY: "waha-key",
      WAHA_SESSION: "default"
    });

    expect(config.s3Endpoint).toBe("https://project-ref.storage.supabase.co/storage/v1/s3");
    expect(config.s3Region).toBe("sa-east-1");
    expect(config.s3AccessKeyId).toBe("access-key");
    expect(config.s3SecretAccessKey).toBe("secret-key");
    expect(config.wahaBaseUrl).toBe("http://localhost:3000");
  });
});
```

- [ ] **Step 3: Delete `tests/supabaseStorage.test.ts`**

```bash
git rm tests/supabaseStorage.test.ts
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: todos os testes passam. Não deve haver referência a `SupabaseObjectStorage` ou `SUPABASE_STORAGE_BUCKET` em nenhum arquivo.

- [ ] **Step 5: Verify no remaining Supabase references in source**

```bash
grep -rn "supabase\|SUPABASE\|DIRECT_URL\|directUrl" src/ tests/ prisma/schema.prisma --include="*.ts" -i
```

Expected: zero linhas de output (referências em `tests/configEnv.test.ts` ao URL do Supabase são strings de teste válidas — aceitável se aparecerem).

- [ ] **Step 6: Commit**

```bash
git add tests/s3Storage.test.ts tests/configEnv.test.ts
git commit -m "feat: rename supabaseStorage test to s3Storage, update env var to S3_BUCKET"
```

---

## Notas de deploy

Ao fazer deploy em produção, as variáveis de ambiente que precisam ser atualizadas:

- `DATABASE_URL` — apontar para o Postgres de produção (remover pooler path se houver)
- `DIRECT_URL` — **remover** (não é mais usada)
- `SUPABASE_STORAGE_BUCKET` — **remover**
- `S3_BUCKET` — adicionar com o nome do bucket AWS
- `ENDPOINT` — pode ser removida se usar o endpoint padrão da AWS (o SDK usa o padrão por região automaticamente quando omitido); manter se usar endpoint customizado
- `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` — atualizar para credenciais AWS
