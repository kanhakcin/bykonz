import { Router, type NextFunction, type Request, type Response } from "express";
import { createPanelAuth, requirePanelRole, type AuthenticatedRequest } from "./panelAuth";
import { TelegramManagementService } from "../services/telegramManagementService";

export interface TelegramRouterOptions {
  jwtSecret: string;
}

/**
 * REST API de gerenciamento do Telegram, montada em /api/v1/telegram.
 *
 * Autenticado com o JWT do painel. O token do bot é sempre write-only: o
 * getter devolve apenas a versão mascarada e o frontend nunca recebe o token
 * completo.
 */
export function createTelegramRouter(service: TelegramManagementService, options: TelegramRouterOptions): Router {
  const router = Router();

  router.use(createPanelAuth(options.jwtSecret));

  // ---- Dashboard ------------------------------------------------------------
  router.get("/dashboard", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.getDashboard());
    } catch (error) {
      next(error);
    }
  });

  // ---- Configurações --------------------------------------------------------
  router.get("/settings", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.getSettings());
    } catch (error) {
      next(error);
    }
  });

  router.put("/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const token = typeof body.token === "string" ? body.token : undefined;
      const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
      res.json(await service.updateSettings({ token, enabled }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/settings/test", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.testConnection());
    } catch (error) {
      next(error);
    }
  });

  // ---- Conversas e mensagens ------------------------------------------------
  router.get("/conversations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const page = parsePositiveInt(req.query.page, 0);
      const size = parsePositiveInt(req.query.size, 20);
      if (page === null || size === null) {
        res.status(400).json({ error: "invalid_pagination" });
        return;
      }
      res.json(await service.listConversations({ search, page, size }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }
      const conversation = await service.getConversation(id);
      if (!conversation) {
        res.status(404).json({ error: "conversation_not_found" });
        return;
      }
      res.json(conversation);
    } catch (error) {
      next(error);
    }
  });

  router.get("/messages", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversationId = typeof req.query.conversationId === "string" ? Number(req.query.conversationId) : undefined;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const page = parsePositiveInt(req.query.page, 0);
      const size = parsePositiveInt(req.query.size, 20);
      if (page === null || size === null) {
        res.status(400).json({ error: "invalid_pagination" });
        return;
      }
      res.json(await service.listMessages({ conversationId, search, from, to, page, size }));
    } catch (error) {
      next(error);
    }
  });

  // ---- Canais / chats -------------------------------------------------------
  router.get("/chats", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.listChats());
    } catch (error) {
      next(error);
    }
  });

  // ---- Envio ----------------------------------------------------------------
  // Admin: enviar mensagem em nome do bot.
  router.post("/send", requirePanelRole("ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
      const text = typeof body.text === "string" ? body.text : undefined;
      const media = parseMedia(body.media);

      if (!chatId) {
        res.status(400).json({ error: "invalid_payload", code: "telegram.chatRequired" });
        return;
      }
      if (!text && !media) {
        res.status(400).json({ error: "invalid_payload", code: "telegram.contentRequired" });
        return;
      }

      const result = await service.sendMessage({ chatId, text, media });
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "telegram_not_configured") {
        res.status(503).json({ error: "telegram_not_configured", code: "telegram.notConfigured" });
        return;
      }
      next(error);
    }
  });

  // ---- Logs -----------------------------------------------------------------
  router.get("/logs", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = typeof req.query.type === "string" ? req.query.type : undefined;
      const page = parsePositiveInt(req.query.page, 0);
      const size = parsePositiveInt(req.query.size, 20);
      if (page === null || size === null) {
        res.status(400).json({ error: "invalid_pagination" });
        return;
      }
      res.json(await service.listLogs({ type, page, size }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function parseMedia(value: unknown): { type: string; mime: string; filename: string; data: string } | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const rec = value as Record<string, unknown>;
  if (
    typeof rec.type !== "string" ||
    typeof rec.mime !== "string" ||
    typeof rec.filename !== "string" ||
    typeof rec.data !== "string" ||
    !rec.data
  ) {
    return undefined;
  }
  return { type: rec.type, mime: rec.mime, filename: rec.filename, data: rec.data };
}

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parsePositiveInt(raw: unknown, fallback: number): number | null {
  if (raw === undefined) {
    return fallback;
  }
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
