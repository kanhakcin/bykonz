/**
 * Tipos do módulo de embarcações (vessels).
 * Camada de contratos desacoplada do banco e do HTTP.
 */

export interface VesselSummary {
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
  companyId: number | bigint | null;
  active: boolean;
  mobilizationsCount: number;
  reportsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VesselDetail extends Omit<VesselSummary, "mobilizationsCount" | "reportsCount"> {
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
}

export interface CreateVesselInput {
  companyId?: number | bigint;
  name: string;
  code?: string;
  imo?: string;
  mmsi?: string;
  vesselType?: string;
  vesselClass?: string;
  flag?: string;
  port?: string;
  location?: string;
  model?: string;
  manufacturer?: string;
  observations?: string;
}

export interface UpdateVesselInput {
  name?: string;
  code?: string;
  imo?: string;
  mmsi?: string;
  vesselType?: string;
  vesselClass?: string;
  flag?: string;
  port?: string;
  location?: string;
  model?: string;
  manufacturer?: string;
  observations?: string;
}

export interface ListVesselsParams {
  search?: string;
  page?: number;
  size?: number;
}

export interface PaginatedVessels {
  items: VesselSummary[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CreateMobilizationForVesselInput {
  title?: string;
  serviceType?: string;
  objective?: string;
  location?: string;
  technicianName?: string;
  mobilizationDate?: string;
}
