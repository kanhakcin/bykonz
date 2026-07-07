import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { PanelUserRole } from "../services/panelService";

const TOKEN_TTL = "12h";

export interface PanelTokenPayload {
  sub: number;
  email: string;
  name: string;
  role: PanelUserRole;
}

export interface AuthenticatedRequest extends Request {
  panelUser?: PanelTokenPayload;
}

export function signPanelToken(payload: PanelTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL });
}

function verifyPanelToken(token: string, secret: string): PanelTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== "object" || decoded === null || typeof decoded.sub !== "number") {
      return null;
    }
    return decoded as unknown as PanelTokenPayload;
  } catch {
    return null;
  }
}

/** Auth do painel: JWT assinado no login, um por usuário do painel (PanelUser). */
export function createPanelAuth(secret: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const provided = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";

    const payload = provided ? verifyPanelToken(provided, secret) : null;
    if (!payload) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    req.panelUser = payload;
    next();
  };
}

/** Bloqueia rotas restritas a administradores do painel. */
export function requirePanelRole(...roles: PanelUserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.panelUser || !roles.includes(req.panelUser.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
