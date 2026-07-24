import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type WebhookHandler } from "../src/app";
import type { WahaWebhook } from "../src/types/waha";
import type { TelegramUpdate } from "../src/types/telegram";
import type { IncomingMessage } from "../src/types/message";

class FakeWebhookHandler implements WebhookHandler {
  calls: IncomingMessage[] = [];

  async handleWebhook(message: IncomingMessage): Promise<void> {
    this.calls.push(message);
  }
}

const WAHA_PAYLOAD: WahaWebhook = {
  event: "message",
  session: "default",
  payload: {
    id: "msg-1",
    from: "5511999999999@c.us",
    body: "oi",
    hasMedia: false
  }
};

const TELEGRAM_UPDATE: TelegramUpdate = {
  update_id: 1,
  message: {
    message_id: 10,
    chat: { id: 42, type: "private" },
    from: { id: 42, first_name: "Op" },
    date: 0,
    text: "oi"
  }
};

describe("Express app", () => {
  it("responds to health checks", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    await request(app).get("/health").expect(200, { ok: true });
  });

  it("adapts WAHA webhook payloads to IncomingMessage when no secret configured", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    await request(app).post("/webhooks/waha").send(WAHA_PAYLOAD).expect(200, { ok: true });

    expect(handler.calls).toHaveLength(1);
    expect(handler.calls[0]).toMatchObject({
      channel: "whatsapp",
      chatId: "5511999999999@c.us",
      text: "oi",
      identity: { kind: "phone", value: "5511999999999" }
    });
  });

  it("ignores unsupported WAHA events without calling the handler", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    await request(app)
      .post("/webhooks/waha")
      .send({ event: "message", session: "default", payload: { from: "x@c.us", body: "hi", fromMe: true } })
      .expect(200, { ok: true });

    expect(handler.calls).toHaveLength(0);
  });

  it("rejects webhook without secret when secret is configured", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, "my-secret");

    await request(app).post("/webhooks/waha").send(WAHA_PAYLOAD).expect(401);

    expect(handler.calls).toHaveLength(0);
  });

  it("rejects webhook with wrong secret", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, "my-secret");

    await request(app)
      .post("/webhooks/waha")
      .set("x-webhook-secret", "wrong-secret")
      .send(WAHA_PAYLOAD)
      .expect(401);

    expect(handler.calls).toHaveLength(0);
  });

  it("accepts webhook with correct secret", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, "my-secret");

    await request(app)
      .post("/webhooks/waha")
      .set("x-webhook-secret", "my-secret")
      .send(WAHA_PAYLOAD)
      .expect(200, { ok: true });

    expect(handler.calls).toHaveLength(1);
    expect(handler.calls[0]).toMatchObject({ channel: "whatsapp", text: "oi" });
  });

  it("adapts Telegram updates to IncomingMessage when no secret configured", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    await request(app).post("/webhooks/telegram").send(TELEGRAM_UPDATE).expect(200, { ok: true });

    expect(handler.calls).toHaveLength(1);
    expect(handler.calls[0]).toMatchObject({
      channel: "telegram",
      chatId: "tg:42",
      text: "oi",
      identity: { kind: "telegram", value: "42" }
    });
  });

  it("rejects Telegram webhook with wrong secret token", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, undefined, { telegramWebhookSecret: "tg-secret" });

    await request(app)
      .post("/webhooks/telegram")
      .set("x-telegram-bot-api-secret-token", "nope")
      .send(TELEGRAM_UPDATE)
      .expect(401);

    expect(handler.calls).toHaveLength(0);
  });

  it("accepts Telegram webhook with correct secret token", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler, undefined, { telegramWebhookSecret: "tg-secret" });

    await request(app)
      .post("/webhooks/telegram")
      .set("x-telegram-bot-api-secret-token", "tg-secret")
      .send(TELEGRAM_UPDATE)
      .expect(200, { ok: true });

    expect(handler.calls).toHaveLength(1);
  });

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
        request(app).post("/webhooks/waha").send(WAHA_PAYLOAD)
      )
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
