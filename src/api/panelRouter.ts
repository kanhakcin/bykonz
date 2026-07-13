import cors from "cors";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { createPanelAuth, requirePanelRole, signPanelToken, type AuthenticatedRequest } from "./panelAuth";
import {
  AssetInUseError,
  DuplicateAssetCodeError,
  DuplicatePanelUserEmailError,
  DuplicatePersonCodeError,
  DuplicateProjectCodeError,
  DuplicateStandardCodeError,
  DuplicateWhatsappUserPhoneError,
  InvalidDateError,
  InvalidWhatsappPhoneError,
  LastActivePanelUserError,
  PanelUserPasswordRequiredError,
  PersonInUseError,
  ProjectInUseError,
  StandardInUseError,
  WhatsappUserHasEntriesError,
  type AssetInput,
  type PanelService,
  type PanelUserInput,
  type PanelUserRole,
  type PersonInput,
  type PersonStatus,
  type ProjectInput,
  type StandardInput,
  type WhatsappUserInput
} from "../services/panelService";
import { InvalidReportDateError } from "../services/dailyReportService";

export interface PanelRouterOptions {
  jwtSecret: string;
  corsOrigins?: string[];
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

  router.post("/auth/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

      if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
      }

      const user = await service.verifyPanelUserCredentials(email, password);
      if (!user) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
      }

      const token = signPanelToken({ sub: user.id, email: user.email, name: user.name, role: user.role }, options.jwtSecret);

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          initials: initialsOf(user.name),
          role: user.role,
          email: user.email
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.use(createPanelAuth(options.jwtSecret));

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

  router.get("/projects/:id/report", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      if (!date) {
        res.status(400).json({ error: "missing_date" });
        return;
      }

      const result = await service.getDailyReportPdf({ projectId: id, date });
      if (!result) {
        res.status(404).json({ error: "project_not_found" });
        return;
      }

      const filename = `diario-obra-${id}-${date}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(result.buffer);
    } catch (error) {
      if (error instanceof InvalidReportDateError) {
        res.status(400).json({ error: "invalid_date" });
        return;
      }
      next(error);
    }
  });

  // Download autenticado da capa da obra (espelha GET /media/:id).
  router.get("/projects/:id/cover", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const cover = await service.getProjectCover(id);
      if (!cover) {
        res.status(404).json({ error: "cover_not_found" });
        return;
      }

      res.setHeader("Content-Type", cover.contentType);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(cover.body);
    } catch (error) {
      next(error);
    }
  });

  // Upload da capa como JSON base64 (evita dependência de multipart/multer).
  // O campo é grande, então usa um parser com limite próprio, só nesta rota.
  router.post(
    "/projects/:id/cover",
    express.json({ limit: "10mb" }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = parseId(req.params.id);
        if (id === null) {
          res.status(400).json({ error: "invalid_id" });
          return;
        }

        const cover = parseCoverUpload(req.body);
        if (!cover) {
          res.status(400).json({ error: "invalid_payload" });
          return;
        }

        const key = `panel/projects/${id}/cover-${Date.now()}.${cover.ext}`;
        const updated = await service.uploadProjectCover(id, { key, body: cover.body, contentType: cover.contentType });
        if (!updated) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }

        res.json({ coverImage: `/projects/${id}/cover` });
      } catch (error) {
        next(error);
      }
    }
  );

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

  // ---- Assets registry (CRUD) ----------------------------------------------

  router.get("/asset-types", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.listAssetTypes());
    } catch (error) {
      next(error);
    }
  });

  router.get("/assets", async (req: Request, res: Response, next: NextFunction) => {
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

      res.json(await service.listAssets({ search, page, size }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/assets/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const asset = await service.getAsset(id);
      if (!asset) {
        res.status(404).json({ error: "asset_not_found" });
        return;
      }

      res.json(asset);
    } catch (error) {
      next(error);
    }
  });

  router.post("/assets", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseAssetInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      res.status(201).json(await service.createAsset(input));
    } catch (error) {
      handleAssetError(error, res, next);
    }
  });

  router.put("/assets/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const input = parseAssetInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      const asset = await service.updateAsset(id, input);
      if (!asset) {
        res.status(404).json({ error: "asset_not_found" });
        return;
      }

      res.json(asset);
    } catch (error) {
      handleAssetError(error, res, next);
    }
  });

  router.delete("/assets/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const found = await service.deleteAsset(id);
      if (!found) {
        res.status(404).json({ error: "asset_not_found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      handleAssetError(error, res, next);
    }
  });

  // ---- People registry (CRUD) ----------------------------------------------

  router.get("/people", async (req: Request, res: Response, next: NextFunction) => {
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

      res.json(await service.listPeople({ search, page, size }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/people/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const person = await service.getPerson(id);
      if (!person) {
        res.status(404).json({ error: "person_not_found" });
        return;
      }

      res.json(person);
    } catch (error) {
      next(error);
    }
  });

  router.post("/people", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parsePersonInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      res.status(201).json(await service.createPerson(input));
    } catch (error) {
      handlePersonError(error, res, next);
    }
  });

  router.put("/people/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const input = parsePersonInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      const person = await service.updatePerson(id, input);
      if (!person) {
        res.status(404).json({ error: "person_not_found" });
        return;
      }

      res.json(person);
    } catch (error) {
      handlePersonError(error, res, next);
    }
  });

  router.delete("/people/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const found = await service.deletePerson(id);
      if (!found) {
        res.status(404).json({ error: "person_not_found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      handlePersonError(error, res, next);
    }
  });

  // ---- Panel users (accounts) registry (CRUD, admin only) -------------------

  router.use("/users", requirePanelRole("ADMIN"));

  router.get("/users", async (req: Request, res: Response, next: NextFunction) => {
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

      res.json(await service.listPanelUsers({ search, page, size }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const user = await service.getPanelUser(id);
      if (!user) {
        res.status(404).json({ error: "panel_user_not_found" });
        return;
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  router.post("/users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parsePanelUserInput(req.body, { requirePassword: true });
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      res.status(201).json(await service.createPanelUser(input));
    } catch (error) {
      handlePanelUserError(error, res, next);
    }
  });

  router.put("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const input = parsePanelUserInput(req.body, { requirePassword: false });
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      const user = await service.updatePanelUser(id, input);
      if (!user) {
        res.status(404).json({ error: "panel_user_not_found" });
        return;
      }

      res.json(user);
    } catch (error) {
      handlePanelUserError(error, res, next);
    }
  });

  router.delete("/users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const found = await service.deletePanelUser(id);
      if (!found) {
        res.status(404).json({ error: "panel_user_not_found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      handlePanelUserError(error, res, next);
    }
  });

  // ---- WhatsApp users (bot access) registry (CRUD, admin only) --------------

  router.use("/whatsapp-users", requirePanelRole("ADMIN"));

  router.get("/whatsapp-users", async (req: Request, res: Response, next: NextFunction) => {
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

      res.json(await service.listWhatsappUsers({ search, page, size }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/whatsapp-users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const user = await service.getWhatsappUser(id);
      if (!user) {
        res.status(404).json({ error: "whatsapp_user_not_found" });
        return;
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  router.post("/whatsapp-users", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseWhatsappUserInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      res.status(201).json(await service.createWhatsappUser(input));
    } catch (error) {
      handleWhatsappUserError(error, res, next);
    }
  });

  router.put("/whatsapp-users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const input = parseWhatsappUserInput(req.body);
      if (!input) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      const user = await service.updateWhatsappUser(id, input);
      if (!user) {
        res.status(404).json({ error: "whatsapp_user_not_found" });
        return;
      }

      res.json(user);
    } catch (error) {
      handleWhatsappUserError(error, res, next);
    }
  });

  router.delete("/whatsapp-users/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_id" });
        return;
      }

      const found = await service.deleteWhatsappUser(id);
      if (!found) {
        res.status(404).json({ error: "whatsapp_user_not_found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      handleWhatsappUserError(error, res, next);
    }
  });

  // Lista de empresas para o multi-select de vínculos do usuário WhatsApp.
  router.get("/companies", requirePanelRole("ADMIN"), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.listCompanies());
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", (req: AuthenticatedRequest, res: Response) => {
    const user = req.panelUser!;
    res.json({ id: user.sub, email: user.email, name: user.name, role: user.role, initials: initialsOf(user.name) });
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

function handleAssetError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DuplicateAssetCodeError) {
    res.status(409).json({ error: "duplicate_code", code: "asset.duplicated" });
    return;
  }
  if (error instanceof AssetInUseError) {
    res.status(409).json({ error: "asset_in_use", code: "asset.inUse" });
    return;
  }
  next(error);
}

function handlePersonError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DuplicatePersonCodeError) {
    res.status(409).json({ error: "duplicate_code", code: "person.duplicated" });
    return;
  }
  if (error instanceof PersonInUseError) {
    res.status(409).json({ error: "person_in_use", code: "person.inUse" });
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

function handlePanelUserError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DuplicatePanelUserEmailError) {
    res.status(409).json({ error: "duplicate_email", code: "panelUser.duplicated" });
    return;
  }
  if (error instanceof PanelUserPasswordRequiredError) {
    res.status(400).json({ error: "password_required", code: "panelUser.passwordRequired" });
    return;
  }
  if (error instanceof LastActivePanelUserError) {
    res.status(409).json({ error: "last_active_user", code: "panelUser.lastActive" });
    return;
  }
  next(error);
}

function handleWhatsappUserError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DuplicateWhatsappUserPhoneError) {
    res.status(409).json({ error: "duplicate_phone", code: "whatsappUser.duplicated" });
    return;
  }
  if (error instanceof InvalidWhatsappPhoneError) {
    res.status(400).json({ error: "invalid_phone", code: "whatsappUser.invalidPhone" });
    return;
  }
  if (error instanceof WhatsappUserHasEntriesError) {
    res.status(409).json({ error: "user_has_entries", code: "whatsappUser.hasEntries" });
    return;
  }
  next(error);
}

function parseWhatsappUserInput(body: unknown): WhatsappUserInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { name, phone, role, active, companyIds } = body as Record<string, unknown>;
  if (typeof name !== "string" || name.trim() === "" || name.length > 200) {
    return null;
  }
  if (typeof phone !== "string" || phone.trim() === "" || phone.length > 30) {
    return null;
  }
  if (role !== undefined && role !== null && (typeof role !== "string" || role.length > 100)) {
    return null;
  }
  if (active !== undefined && typeof active !== "boolean") {
    return null;
  }
  if (
    !Array.isArray(companyIds) ||
    !companyIds.every((id) => (typeof id === "string" && /^\d+$/.test(id)) || (typeof id === "number" && Number.isInteger(id)))
  ) {
    return null;
  }

  return {
    name: name.trim(),
    phone: phone.trim(),
    role: typeof role === "string" ? role : null,
    active: active ?? true,
    companyIds: companyIds.map((id) => String(id))
  };
}

const PANEL_USER_ROLES: PanelUserRole[] = ["ADMIN", "MANAGER"];

function parsePanelUserInput(body: unknown, options: { requirePassword: boolean }): PanelUserInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { email, name, role, active, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || email.trim() === "" || email.length > 200) {
    return null;
  }
  if (typeof name !== "string" || name.trim() === "" || name.length > 200) {
    return null;
  }
  if (typeof role !== "string" || !PANEL_USER_ROLES.includes(role as PanelUserRole)) {
    return null;
  }
  if (active !== undefined && typeof active !== "boolean") {
    return null;
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
    return null;
  }
  if (options.requirePassword && !password) {
    return null;
  }

  return {
    email: email.trim(),
    name: name.trim(),
    role: role as PanelUserRole,
    active: active ?? true,
    password: password as string | undefined
  };
}

function parseProjectInput(body: unknown): ProjectInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { code, name, context, active, whatsappGroupId, whatsappAutoReportEnabled } = body as Record<string, unknown>;
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
  if (!isOptionalString(whatsappGroupId, 100)) {
    return null;
  }
  if (whatsappAutoReportEnabled !== undefined && typeof whatsappAutoReportEnabled !== "boolean") {
    return null;
  }

  return {
    code: code.trim(),
    name: name.trim(),
    context: normalizeOptional(context),
    active: active ?? true,
    whatsappGroupId: normalizeOptional(whatsappGroupId as string | null | undefined),
    whatsappAutoReportEnabled: whatsappAutoReportEnabled ?? false
  };
}

const COVER_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const MAX_COVER_BYTES = 5 * 1024 * 1024;

function parseCoverUpload(body: unknown): { body: Buffer; contentType: string; ext: string } | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { contentType, dataBase64 } = body as Record<string, unknown>;
  if (typeof contentType !== "string" || typeof dataBase64 !== "string" || dataBase64 === "") {
    return null;
  }

  const ext = COVER_CONTENT_TYPES[contentType];
  if (!ext) {
    return null;
  }

  // Aceita tanto o base64 puro quanto uma data URL (data:image/...;base64,XXXX).
  const base64 = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > MAX_COVER_BYTES) {
    return null;
  }

  return { body: buffer, contentType, ext };
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

function parseAssetInput(body: unknown): AssetInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { code, name, assetTypeId, projectId, active } = body as Record<string, unknown>;
  if (typeof code !== "string" || code.trim() === "" || code.length > 60) {
    return null;
  }
  if (typeof name !== "string" || name.trim() === "" || name.length > 200) {
    return null;
  }
  if (!isPositiveInt(assetTypeId) || !isPositiveInt(projectId)) {
    return null;
  }
  if (active !== undefined && typeof active !== "boolean") {
    return null;
  }

  return {
    code: code.trim(),
    name: name.trim(),
    assetTypeId,
    projectId,
    active: active ?? true
  };
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

const PERSON_STATUSES: PersonStatus[] = ["ACTIVE", "ON_LEAVE", "TERMINATED"];

function parsePersonInput(body: unknown): PersonInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { name, registrationCode, role, status, projectId } = body as Record<string, unknown>;
  if (typeof name !== "string" || name.trim() === "" || name.length > 200) {
    return null;
  }
  if (!isOptionalString(registrationCode, 60) || !isOptionalString(role, 100)) {
    return null;
  }
  if (status !== undefined && (typeof status !== "string" || !PERSON_STATUSES.includes(status as PersonStatus))) {
    return null;
  }
  if (projectId !== undefined && projectId !== null && !isPositiveInt(projectId)) {
    return null;
  }

  return {
    name: name.trim(),
    registrationCode: normalizeOptional(registrationCode),
    role: normalizeOptional(role),
    status: (status as PersonStatus | undefined) ?? "ACTIVE",
    projectId: isPositiveInt(projectId) ? projectId : null
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
