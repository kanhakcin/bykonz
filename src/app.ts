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
