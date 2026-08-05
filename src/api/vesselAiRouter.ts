import { Router, type Request, type Response, type NextFunction } from "express";
import { analyzeEvidenceContent } from "../services/vesselAiService";

export function createVesselAiRouter() {
  const router = Router();

  router.post("/ai/analyze-evidence", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = analyzeEvidenceContent(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
