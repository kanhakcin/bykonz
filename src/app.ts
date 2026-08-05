import { timingSafeEqual } from "crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { WahaWebhook } from "./types/waha";
import type { TelegramUpdate } from "./types/telegram";
import type { IncomingMessage } from "./types/message";
import { wahaWebhookToIncomingMessage } from "./channels/waha/inbound";
import { telegramUpdateToIncomingMessage } from "./channels/telegram/inbound";

export interface WebhookHandler {
  /** Recebe a mensagem já normalizada (channel-agnóstica) pela borda do canal. */
  handleWebhook(message: IncomingMessage): Promise<void>;
}

interface AppOptions {
  webhookRateLimit?: number;
  /** Router da API do painel do gestor, montado em /api/v1. */
  panelRouter?: express.Router;
  /** Router extra para funcionalidades do painel. */
  panelRouterExtra?: express.Router;
  /** Router de embarcações e mobilizações. */
  vesselRouter?: express.Router;
  /** Router do assistente de IA para análise automática de evidências. */
  vesselAiRouter?: express.Router;
  /** Secret token que o Telegram devolve no header ao chamar o webhook. */
  telegramWebhookSecret?: string;
}

export function createApp(
  webhookHandler: WebhookHandler,
  webhookSecret?: string,
  options: AppOptions = {}
): express.Express {
  const app = express();

  // Atrás de um proxy (ngrok em dev, ingress/load balancer em prod) que injeta
  // X-Forwarded-For; sem isto o express-rate-limit não identifica o IP real e
  // lança ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. `1` confia só no primeiro hop.
  app.set("trust proxy", 1);

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
      if (!isSecretValid(typeof token === "string" ? token : "", webhookSecret)) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }
    }

    try {
      const message = wahaWebhookToIncomingMessage(req.body as WahaWebhook);
      if (message) {
        await webhookHandler.handleWebhook(message);
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/webhooks/telegram", webhookLimiter, async (req: Request, res: Response, next: NextFunction) => {
    if (options.telegramWebhookSecret) {
      // O Telegram envia o secret token que registramos no setWebhook.
      const token = req.headers["x-telegram-bot-api-secret-token"];
      if (!isSecretValid(typeof token === "string" ? token : "", options.telegramWebhookSecret)) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }
    }

    try {
      const message = telegramUpdateToIncomingMessage(req.body as TelegramUpdate);
      if (message) {
        await webhookHandler.handleWebhook(message);
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  if (options.panelRouter) {
    app.use("/api/v1", options.panelRouter);
  }

  if (options.panelRouterExtra) {
    app.use("/api/v1", options.panelRouterExtra);
  }

  if (options.vesselRouter) {
    app.use("/api/v1", options.vesselRouter);
  }

  if (options.vesselAiRouter) {
    app.use("/api/v1", options.vesselAiRouter);
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  return app;
}

function isSecretValid(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}
