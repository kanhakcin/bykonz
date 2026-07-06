import cors from "cors";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { createPanelAuth, safeEquals } from "./panelAuth";
import {
  DuplicateProjectCodeError,
  DuplicateStandardCodeError,
  InvalidDateError,
  ProjectInUseError,
  StandardInUseError,
  type PanelService,
  type ProjectInput,
  type StandardInput
} from "../services/panelService";

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
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

  // ---- Standards registry (CRUD) -------------------------------------------

  router.get("/standards", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" && req.query.search.trim() !== ""
        ? req.query.search.trim()
        : undefined;
      const page = parsePositiveInt(req.query.page, 0);
      const size = parsePositiveInt(req.query.size, 20);

      if (page === null || size === null || size < 1 || size > 100) {
        res.status(400).json({ error: "invalid_pagination" });
        return;
      }

      res.json(await service.listStandards({ search, page, size }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/standards/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const standard = await service.getStandard(id);
      if (!standard) {
        res.status(404).json({ error: "standard_not_found" });
        return;
      }

      res.json(standard);
    } catch (error) {
      next(error);
    }
  });

  router.post("/standards", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseStandardInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      res.status(201).json(await service.createStandard(input));
    } catch (error) {
      handleStandardError(error, res, next);
    }
  });

  router.put("/standards/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const input = parseStandardInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      const standard = await service.updateStandard(id, input);
      if (!standard) {
        res.status(404).json({ error: "standard_not_found" });
        return;
      }

      res.json(standard);
    } catch (error) {
      handleStandardError(error, res, next);
    }
  });

  router.delete("/standards/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const found = await service.deleteStandard(id);
      if (!found) {
        res.status(404).json({ error: "standard_not_found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      handleStandardError(error, res, next);
    }
  });

  // ---- Projects/obras registry (CRUD) ---------------------------------------

  router.get("/projects", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" && req.query.search.trim() !== ""
        ? req.query.search.trim()
        : undefined;
      const page = parsePositiveInt(req.query.page, 0);
      const size = parsePositiveInt(req.query.size, 20);
      const activeOnly = req.query.active === "true";

      if (page === null || size === null || size < 1 || size > 100) {
        res.status(400).json({ error: "invalid_pagination" });
        return;
      }

      res.json(await service.listProjects({ search, page, size, activeOnly }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/projects/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const project = await service.getProjectItem(id);
      if (!project) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }

      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  router.post("/projects", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseProjectInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      res.status(201).json(await service.createProject(input));
    } catch (error) {
      handleProjectError(error, res, next);
    }
  });

  router.put("/projects/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const input = parseProjectInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      const project = await service.updateProject(id, input);
      if (!project) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }

      res.json(project);
    } catch (error) {
      handleProjectError(error, res, next);
    }
  });

  router.delete("/projects/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const found = await service.deleteProject(id);
      if (!found) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      handleProjectError(error, res, next);
    }
  });

  return router;
}

/** O campo `code` nas respostas de erro é a chave i18n exibida pelo frontend. */
function handleStandardError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DuplicateStandardCodeError) {
    res.status(409).json({ error: "duplicate_code", code: "standard.duplicated" });
    return;
  }
  if (error instanceof StandardInUseError) {
    res.status(409).json({ error: "standard_in_use", code: "standard.inUse" });
    return;
  }
  next(error);
}

function handleProjectError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DuplicateProjectCodeError) {
    res.status(409).json({ error: "duplicate_code", code: "project.duplicated" });
    return;
  }
  if (error instanceof ProjectInUseError) {
    res.status(409).json({ error: "project_in_use", code: "project.inUse" });
    return;
  }
  next(error);
}

function parseProjectInput(body: unknown): ProjectInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { code, name, context, active } = body as Record<string, unknown>;
  if (typeof code !== "string" || code.trim() === "" || code.length > 30) {
    return null;
  }
  if (typeof name !== "string" || name.trim() === "" || name.length > 200) {
    return null;
  }
  if (!isOptionalString(context, 200)) {
    return null;
  }
  if (active !== undefined && typeof active !== "boolean") {
    return null;
  }

  return {
    code: code.trim(),
    name: name.trim(),
    context: normalizeOptional(context),
    active: active ?? true
  };
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

function parseStandardInput(body: unknown): StandardInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { code, title, description, version, active } = body as Record<string, unknown>;
  if (typeof code !== "string" || code.trim() === "" || code.length > 60) {
    return null;
  }
  if (typeof title !== "string" || title.trim() === "" || title.length > 200) {
    return null;
  }
  if (!isOptionalString(description, 2000) || !isOptionalString(version, 40)) {
    return null;
  }
  if (active !== undefined && typeof active !== "boolean") {
    return null;
  }

  return {
    code: code.trim(),
    title: title.trim(),
    description: normalizeOptional(description),
    version: normalizeOptional(version),
    active: active ?? true
  };
}

function isOptionalString(value: unknown, maxLength: number): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maxLength);
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "G";
}
