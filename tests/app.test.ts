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
