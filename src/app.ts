import { timingSafeEqual } from "crypto";
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
      if (
        typeof token !== "string" ||
        token.length !== webhookSecret.length ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(webhookSecret))
      ) {
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
