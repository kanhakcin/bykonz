import { Router, type NextFunction, type Request, type Response } from "express";
import { VesselService, VesselNameRequiredError, VesselNotFoundError } from "../service";
import {
  toCreateMobilizationInput,
  toCreateVesselInput,
  toUpdateVesselInput,
  validateCreateMobilization,
  validateCreateVessel,
  validateUpdateVessel
} from "../validation";

/**
 * Router do módulo de embarcações.
 * Camada de HTTP — parse de entrada, validação, status codes.
 * Delega regras de negócio ao Service.
 */
export function createVesselModuleRouter(service: VesselService): Router {
  const router = Router();

  // GET /vessels?search=&page=&size=
  router.get("/vessels", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const page = parsePositiveInt(req.query.page, 0);
      const size = parsePositiveInt(req.query.size, 20);

      if (page === null || size === null || size < 1 || size > 100) {
        res.status(400).json({ error: "invalid_pagination" });
        return;
      }

      const result = await service.list({ search, page, size });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // GET /vessels/:id
  router.get("/vessels/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_vessel_id" });
        return;
      }
      const vessel = await service.getById(id);
      res.json(vessel);
    } catch (error) {
      handleVesselError(error, res, next);
    }
  });

  // POST /vessels
  router.post("/vessels", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = validateCreateVessel(req.body);
      if (!validation.valid) {
        res.status(400).json({ error: validation.errors ?? "invalid_payload" });
        return;
      }
      const vessel = await service.create(toCreateVesselInput((req.body ?? {}) as Record<string, unknown>));
      res.status(201).json(vessel);
    } catch (error) {
      handleVesselError(error, res, next);
    }
  });

  // PUT /vessels/:id
  router.put("/vessels/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_vessel_id" });
        return;
      }
      const validation = validateUpdateVessel(req.body);
      if (!validation.valid) {
        res.status(400).json({ error: validation.errors ?? "invalid_payload" });
        return;
      }
      const vessel = await service.update(id, toUpdateVesselInput((req.body ?? {}) as Record<string, unknown>));
      res.json(vessel);
    } catch (error) {
      handleVesselError(error, res, next);
    }
  });

  // POST /vessels/:id/mobilizations
  router.post("/vessels/:id/mobilizations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: "invalid_vessel_id" });
        return;
      }
      const validation = validateCreateMobilization(req.body);
      if (!validation.valid) {
        res.status(400).json({ error: validation.errors ?? "invalid_payload" });
        return;
      }
      const mobilization = await service.createMobilization(
        id,
        toCreateMobilizationInput((req.body ?? {}) as Record<string, unknown>)
      );
      res.status(201).json(mobilization);
    } catch (error) {
      handleVesselError(error, res, next);
    }
  });

  return router;
}

function handleVesselError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof VesselNotFoundError) {
    res.status(404).json({ error: "vessel_not_found" });
    return;
  }
  if (error instanceof VesselNameRequiredError) {
    res.status(400).json({ error: "vessel_name_required" });
    return;
  }
  next(error);
}

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parsePositiveInt(raw: unknown, fallback: number): number | null {
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
