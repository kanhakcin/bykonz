import { Router, type NextFunction, type Request, type Response } from "express";
import { createPanelAuth, type AuthenticatedRequest } from "./panelAuth";
import { createAIService, type AIService } from "../services/aiService";

export interface AiAssistantRouterOptions {
  jwtSecret: string;
}

/**
 * REST API do assistente de IA, montada em /api/v1/assistant.
 *
 * Reutiliza a autenticação JWT do painel (createPanelAuth) e o novo AIService
 * (camada agnóstica de provedor). Todos os endpoints são seguros: quando a IA
 * não está configurada ou falha, o AIService devolve respostas determinísticas
 * locais — o sistema continua funcionando normalmente.
 */
export function createAiAssistantRouter(service: AIService, options: AiAssistantRouterOptions): Router {
  const router = Router();

  router.use(createPanelAuth(options.jwtSecret));

  // Status da IA (configurada? provedor) — útil para o painel exibir o estado.
  router.get("/status", (_req: Request, res: Response) => {
    res.json({
      configured: service.isConfigured,
      provider: optionsProvider()
    });
  });

  // Analisa um rascunho do relatório em tempo real (sugestões, ausentes,
  // inconsistências, causas, diagnósticos, recomendações e resumo).
  router.post("/analyze", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const context = typeof body.context === "string" ? body.context.trim() : undefined;

      if (!text) {
        res.status(400).json({ error: "invalid_payload", code: "assistant.emptyText" });
        return;
      }
      if (text.length > 40000) {
        res.status(400).json({ error: "invalid_payload", code: "assistant.textTooLong" });
        return;
      }

      const result = await service.analyzeDraft({ text, context });
      res.json({ ...result, configured: service.isConfigured });
    } catch (error) {
      next(error);
    }
  });

  // Gera um resumo profissional a partir do texto fornecido.
  router.post("/summarize", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const text = typeof body.text === "string" ? body.text.trim() : "";

      if (!text) {
        res.status(400).json({ error: "invalid_payload", code: "assistant.emptyText" });
        return;
      }
      if (text.length > 40000) {
        res.status(400).json({ error: "invalid_payload", code: "assistant.textTooLong" });
        return;
      }

      const result = await service.generateSummary({ text });
      res.json({ ...result, configured: service.isConfigured });
    } catch (error) {
      next(error);
    }
  });

  // Registra a decisão do usuário sobre uma sugestão da IA (best-effort).
  // Não altera nenhum dado — apenas loga para futura auditoria/telemetria.
  router.post("/feedback", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const decision = body.decision;
      const title = typeof body.title === "string" ? body.title.slice(0, 300) : "";
      const kind = typeof body.kind === "string" ? body.kind : "";

      if (decision !== "accepted" && decision !== "rejected") {
        res.status(400).json({ error: "invalid_payload", code: "assistant.invalidDecision" });
        return;
      }

      console.info("[assistant] feedback", {
        decision,
        title,
        kind,
        actor: req.panelUser?.email ?? null
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function optionsProvider(): string {
  // Mantido simples: o provedor atual é sempre "openai" (ver createAIService).
  return "openai";
}
