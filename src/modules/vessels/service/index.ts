import type { PrismaClient } from "@prisma/client";
import { VesselRepository } from "../repository";
import type {
  CreateMobilizationForVesselInput,
  CreateVesselInput,
  ListVesselsParams,
  PaginatedVessels,
  UpdateVesselInput,
  VesselDetail
} from "../types";

/** Erro de domínio: embarcação não encontrada. */
export class VesselNotFoundError extends Error {
  constructor() {
    super("vessel_not_found");
    this.name = "VesselNotFoundError";
  }
}

/** Erro de domínio: nome da embarcação é obrigatório. */
export class VesselNameRequiredError extends Error {
  constructor() {
    super("vessel_name_required");
    this.name = "VesselNameRequiredError";
  }
}

/**
 * Service do módulo de embarcações.
 * Camada de regras de negócio — orquestra o repository e aplica validações.
 * Não conhece HTTP nem detalhes de banco.
 */
export class VesselService {
  private readonly repository: VesselRepository;
  private readonly db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
    this.repository = new VesselRepository(db);
  }

  async list(params: ListVesselsParams): Promise<PaginatedVessels> {
    return this.repository.list(params);
  }

  async getById(id: number): Promise<VesselDetail> {
    const vessel = await this.repository.findById(id);
    if (!vessel) {
      throw new VesselNotFoundError();
    }
    return vessel;
  }

  async create(input: CreateVesselInput) {
    if (!input.name?.trim()) {
      throw new VesselNameRequiredError();
    }
    return this.repository.create({ ...input, name: input.name.trim() });
  }

  async update(id: number, input: UpdateVesselInput) {
    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new VesselNotFoundError();
    }
    return this.repository.update(id, input);
  }

  async createMobilization(vesselId: number, input: CreateMobilizationForVesselInput) {
    const exists = await this.repository.exists(vesselId);
    if (!exists) {
      throw new VesselNotFoundError();
    }
    const reportCode = await this.generateReportCode();
    return this.db.vesselMobilization.create({
      data: {
        vesselId,
        reportCode,
        title: input.title ?? `Mobilização ${new Date().toISOString().slice(0, 10)}`,
        serviceType: input.serviceType,
        objective: input.objective,
        location: input.location,
        technicianName: input.technicianName,
        mobilizationDate: input.mobilizationDate ? new Date(input.mobilizationDate) : undefined
      }
    });
  }

  private async generateReportCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const count = await this.db.vesselMobilization.count();
    return `RT-${year}-${String(count + 1).padStart(6, "0")}`;
  }
}
