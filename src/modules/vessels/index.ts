/**
 * Módulo de embarcações (vessels) — ponto de entrada público.
 * Exporta os artefatos da camada de domínio e uma factory de router.
 */
import type { PrismaClient } from "@prisma/client";
import { VesselService } from "./service";
import { createVesselModuleRouter } from "./routes";

export { VesselService } from "./service";
export { VesselNotFoundError, VesselNameRequiredError } from "./service";
export { VesselRepository } from "./repository";
export type * from "./types";

/**
 * Factory do módulo: recebe o PrismaClient (injeção de dependência) e
 * devolve o router Express pronto para montagem.
 */
export function createVesselsModule(db: PrismaClient) {
  const service = new VesselService(db);
  return {
    service,
    router: createVesselModuleRouter(service)
  };
}
