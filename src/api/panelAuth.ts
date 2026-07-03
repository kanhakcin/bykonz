import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

/** Comparação em tempo constante (mesmo padrão do webhook secret). */
export function safeEquals(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Auth v1 do painel: bearer token estático (PANEL_API_TOKEN).
 * RBAC real por empresa/projeto/setor é uma entrega futura.
 */
export function createPanelAuth(token: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const provided = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!provided || !safeEquals(provided, token)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    next();
  };
}
