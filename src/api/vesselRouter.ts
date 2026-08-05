import { Router, type Request, type Response, type NextFunction } from "express";
import { VesselReportService } from "../services/vesselReportService";

export function createVesselRouter(service: VesselReportService) {
  const router = Router();

  router.get("/vessels", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.listVessels());
    } catch (error) {
      next(error);
    }
  });

  router.post("/vessels", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await service.createVessel(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.get("/vessels/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_vessel_id" });
        return;
      }
      const vessel = await service.getVessel(id);
      if (!vessel) {
        res.status(404).json({ error: "vessel_not_found" });
        return;
      }
      res.json(vessel);
    } catch (error) {
      next(error);
    }
  });

  router.post("/vessels/:id/mobilizations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_vessel_id" });
        return;
      }
      res.status(201).json(await service.createMobilization({ vesselId: id, ...req.body }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/mobilizations/:id/evidences", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_mobilization_id" });
        return;
      }
      res.status(201).json(await service.addEvidence(id, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/mobilizations/:id/evidences/upload", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_mobilization_id" });
        return;
      }
      res.status(201).json(await service.uploadEvidence(id, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/mobilizations/:id/pending-issues", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_mobilization_id" });
        return;
      }
      res.status(201).json(await service.addPendingIssue(id, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/mobilizations/:id/equipment", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_mobilization_id" });
        return;
      }
      res.status(201).json(await service.addEquipment(id, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/mobilizations/:id/generate-report", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_mobilization_id" });
        return;
      }
      res.status(201).json(await service.generateReport(id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
