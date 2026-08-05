import type { PrismaClient } from "@prisma/client";
import type {
  CreateVesselInput,
  ListVesselsParams,
  PaginatedVessels,
  UpdateVesselInput,
  VesselDetail,
  VesselSummary
} from "../types";

/**
 * Repository do módulo de embarcações.
 * Camada de acesso ao banco — única responsabilidade: queries Prisma.
 * Não contém regras de negócio.
 */
export class VesselRepository {
  constructor(private readonly db: Pick<PrismaClient, "vessel">) {}

  async list(params: ListVesselsParams): Promise<PaginatedVessels> {
    const page = params.page ?? 0;
    const size = params.size ?? 20;
    const search = params.search?.trim();

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
            { imo: { contains: search, mode: "insensitive" as const } },
            { mmsi: { contains: search, mode: "insensitive" as const } },
            { vesselType: { contains: search, mode: "insensitive" as const } }
          ]
        }
      : {};

    const [items, total] = await Promise.all([
      this.db.vessel.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: page * size,
        take: size,
        include: {
          _count: { select: { mobilizations: true, reports: true } }
        }
      }),
      this.db.vessel.count({ where })
    ]);

    return {
      items: items.map((v) => toSummary(v)),
      total,
      page,
      size,
      pages: Math.ceil(total / size)
    };
  }

  async findById(id: number): Promise<VesselDetail | null> {
    const vessel = await this.db.vessel.findUnique({
      where: { id },
      include: {
        _count: { select: { mobilizations: true, reports: true } },
        mobilizations: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            reportCode: true,
            title: true,
            serviceType: true,
            technicianName: true,
            mobilizationDate: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!vessel) return null;
    return toDetail(vessel);
  }

  async create(input: CreateVesselInput) {
    return this.db.vessel.create({
      data: {
        companyId: input.companyId ? BigInt(String(input.companyId)) : null,
        name: input.name,
        code: input.code,
        imo: input.imo,
        mmsi: input.mmsi,
        vesselType: input.vesselType,
        vesselClass: input.vesselClass,
        flag: input.flag,
        port: input.port,
        location: input.location,
        model: input.model,
        manufacturer: input.manufacturer,
        observations: input.observations
      }
    });
  }

  async update(id: number, input: UpdateVesselInput) {
    return this.db.vessel.update({
      where: { id },
      data: {
        name: input.name,
        code: input.code,
        imo: input.imo,
        mmsi: input.mmsi,
        vesselType: input.vesselType,
        vesselClass: input.vesselClass,
        flag: input.flag,
        port: input.port,
        location: input.location,
        model: input.model,
        manufacturer: input.manufacturer,
        observations: input.observations
      }
    });
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.db.vessel.count({ where: { id } });
    return count > 0;
  }
}

function toSummary(v: {
  id: number;
  name: string;
  code: string | null;
  imo: string | null;
  mmsi: string | null;
  vesselType: string | null;
  vesselClass: string | null;
  flag: string | null;
  port: string | null;
  location: string | null;
  model: string | null;
  manufacturer: string | null;
  observations: string | null;
  companyId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { mobilizations: number; reports: number };
}): VesselSummary {
  return {
    id: v.id,
    name: v.name,
    code: v.code,
    imo: v.imo,
    mmsi: v.mmsi,
    vesselType: v.vesselType,
    vesselClass: v.vesselClass,
    flag: v.flag,
    port: v.port,
    location: v.location,
    model: v.model,
    manufacturer: v.manufacturer,
    observations: v.observations,
    companyId: v.companyId,
    active: true,
    mobilizationsCount: v._count.mobilizations,
    reportsCount: v._count.reports,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt
  };
}

function toDetail(v: {
  id: number;
  name: string;
  code: string | null;
  imo: string | null;
  mmsi: string | null;
  vesselType: string | null;
  vesselClass: string | null;
  flag: string | null;
  port: string | null;
  location: string | null;
  model: string | null;
  manufacturer: string | null;
  observations: string | null;
  companyId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { mobilizations: number; reports: number };
  mobilizations: Array<{
    id: number;
    reportCode: string;
    title: string | null;
    serviceType: string | null;
    technicianName: string | null;
    mobilizationDate: Date | null;
    status: string;
    createdAt: Date;
  }>;
}): VesselDetail {
  return {
    id: v.id,
    name: v.name,
    code: v.code,
    imo: v.imo,
    mmsi: v.mmsi,
    vesselType: v.vesselType,
    vesselClass: v.vesselClass,
    flag: v.flag,
    port: v.port,
    location: v.location,
    model: v.model,
    manufacturer: v.manufacturer,
    observations: v.observations,
    companyId: v.companyId,
    active: true,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    mobilizations: v.mobilizations
  };
}
