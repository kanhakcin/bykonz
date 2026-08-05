import { Router, type Request, type Response, type NextFunction } from "express";
import { TechnicalReportService } from "../services/technicalReportService";

export function createTechnicalReportRouter(service: TechnicalReportService) {
  const router = Router();

  router.get("/reports/:id/pdf", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_report_id" });
        return;
      }
      const pdf = await service.exportPdf(id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="relatorio-${id}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  router.get("/reports/:id/docx", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_report_id" });
        return;
      }
      const docx = await service.exportDocx(id);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="relatorio-${id}.docx"`);
      res.send(docx);
    } catch (error) {
      next(error);
    }
  });

  router.get("/projects/:projectId/mobilizations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = Number(req.params.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        res.status(400).json({ error: "invalid_project_id" });
        return;
      }
      const items = await service.listMobilizations(projectId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  router.post("/projects/:projectId/mobilizations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = Number(req.params.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        res.status(400).json({ error: "invalid_project_id" });
        return;
      }
      const mobilization = await service.createMobilization({
        projectId,
        ...req.body,
      });
      res.status(201).json(mobilization);
    } catch (error) {
      next(error);
    }
  });

  router.get("/mobilizations/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_mobilization_id" });
        return;
      }
      const mobilization = await service.getMobilization(id);
      if (!mobilization) {
        res.status(404).json({ error: "mobilization_not_found" });
        return;
      }
      res.json(mobilization);
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
      const evidence = await service.addEvidence(id, req.body);
      res.status(201).json(evidence);
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
      const evidence = await service.uploadEvidence(id, req.body);
      res.status(201).json(evidence);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/evidences/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_evidence_id" });
        return;
      }
      const evidence = await service.updateEvidence(id, req.body);
      res.json(evidence);
    } catch (error) {
      next(error);
    }
  });

  router.post("/mobilizations/:id/inventory", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_mobilization_id" });
        return;
      }
      const item = await service.addInventoryItem(id, req.body);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  router.post("/reports/:id/share", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_report_id" });
        return;
      }
      const expiresInDays = Number(req.body.expiresInDays ?? 30);
      const report = await service.createShareLink(id, expiresInDays);
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get("/reports/share/:token", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await service.getReportByShareToken(req.params.token);
      if (!report) {
        res.status(404).json({ error: "share_link_not_found_or_expired" });
        return;
      }
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get("/vessels/:id/history", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_vessel_id" });
        return;
      }
      const history = await service.listVesselHistory(id);
      res.json(history);
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
      const issue = await service.addPendingIssue(id, req.body);
      res.status(201).json(issue);
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
      const equipment = await service.addEquipment(id, req.body);
      res.status(201).json(equipment);
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
      const report = await service.generateReport(id);
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
