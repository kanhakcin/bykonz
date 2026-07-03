import cors from "cors";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { createPanelAuth, safeEquals } from "./panelAuth";
import { InvalidDateError, type PanelService } from "../services/panelService";

export interface PanelRouterOptions {
  token: string;
  corsOrigins?: string[];
  user?: { name?: string; role?: string; };
}

/**
 * REST API do painel do gestor, montada em /api/v1.
 * Contrato em inglês; ver frontend/src/api/types.ts (espelho no cliente).
 */
export function createPanelRouter(service: PanelService, options: PanelRouterOptions): Router {
  const router = Router();

  router.use(
    cors({
      origin: options.corsOrigins ?? ["http://localhost:5173"],
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"]
    })
  );
  router.use(express.json());

  const userName = options.user?.name ?? "Gestor";
  const userRole = options.user?.role ?? "Gestor de obra";

  router.post("/auth/login", (req: Request, res: Response) => {
    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

    if (typeof email !== "string" || typeof password !== "string" || !safeEquals(password, options.token)) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    res.json({
      token: options.token,
      user: {
        name: userName,
        initials: initialsOf(userName),
        role: userRole,
        email
      }
    });
  });

  router.use(createPanelAuth(options.token));

  router.get("/diary", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const projectIdRaw = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
      const projectId = projectIdRaw ? Number(projectIdRaw) : undefined;

      if (projectIdRaw && (!Number.isInteger(projectId) || projectId! <= 0)) {
        res.status(400).json({ error: "invalid_project_id" });
        return;
      }

      const day = await service.getDiaryDay({ date, projectId });
      if (!day) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }

      res.json(day);
    } catch (error) {
      if (error instanceof InvalidDateError) {
        res.status(400).json({ error: "invalid_date" });
        return;
      }
      next(error);
    }
  });

  router.get("/media/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!/^\d+$/.test(req.params.id)) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const media = await service.getMedia(BigInt(req.params.id));
      if (!media) {
        res.status(404).json({ error: "media_not_found" });
        return;
      }

      res.setHeader("Content-Type", media.contentType);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(media.body);
    } catch (error) {
      next(error);
    }
  });

  const actions: Array<[path: string, run: (service: PanelService, id: number) => Promise<boolean>]> = [
    ["/alerts/:id/resolve", (s, id) => s.resolveAlert(id)],
    ["/alerts/:id/acknowledge", (s, id) => s.acknowledgeAlert(id)],
    ["/mentions/:id/confirm", (s, id) => s.confirmMention(id)],
    ["/mentions/:id/reject", (s, id) => s.rejectMention(id)]
  ];

  for (const [path, run] of actions) {
    router.post(path, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          res.status(400).json({ error: "invalid_id" });
          return;
        }

        const found = await run(service, id);
        if (!found) {
          res.status(404).json({ error: "not_found" });
          return;
        }

        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    });
  }

  return router;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "G";
}
