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

describe("Express app", () => {
  it("responds to health checks", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);

    await request(app).get("/health").expect(200, { ok: true });
  });

  it("passes WAHA webhook payloads to the handler", async () => {
    const handler = new FakeWebhookHandler();
    const app = createApp(handler);
    const payload: WahaWebhook = {
      event: "message",
      session: "default",
      payload: {
        from: "5511999999999@c.us",
        body: "oi",
        hasMedia: false
      }
    };

    await request(app).post("/webhooks/waha").send(payload).expect(200, { ok: true });

    expect(handler.calls).toEqual([payload]);
  });
});
