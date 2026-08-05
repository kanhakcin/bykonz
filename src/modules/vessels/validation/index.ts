import type {
  CreateMobilizationForVesselInput,
  CreateVesselInput,
  UpdateVesselInput
} from "../types";

/**
 * Validação de entrada do módulo de embarcações.
 * Validação manual (sem dependência externa) para manter baixo acoplamento.
 * Retorna um objeto de erro ou `null` se válido.
 */

export interface ValidationResult {
  valid: boolean;
  errors?: Record<string, string>;
}

export function validateCreateVessel(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: { payload: "invalid_payload" } };
  }
  const body = input as Record<string, unknown>;

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return { valid: false, errors: { name: "vessel_name_required" } };
  }
  if (typeof body.name === "string" && body.name.length > 200) {
    return { valid: false, errors: { name: "vessel_name_too_long" } };
  }

  for (const field of ["code", "imo", "mmsi", "vesselType", "vesselClass", "flag", "port", "location", "model", "manufacturer", "observations"]) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return { valid: false, errors: { [field]: "invalid_type" } };
    }
  }

  return { valid: true };
}

export function validateUpdateVessel(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: { payload: "invalid_payload" } };
  }
  const body = input as Record<string, unknown>;

  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
    return { valid: false, errors: { name: "vessel_name_required" } };
  }

  for (const field of ["code", "imo", "mmsi", "vesselType", "vesselClass", "flag", "port", "location", "model", "manufacturer", "observations"]) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return { valid: false, errors: { [field]: "invalid_type" } };
    }
  }

  return { valid: true };
}

export function validateCreateMobilization(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: { payload: "invalid_payload" } };
  }
  const body = input as Record<string, unknown>;

  for (const field of ["title", "serviceType", "objective", "location", "technicianName"]) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return { valid: false, errors: { [field]: "invalid_type" } };
    }
  }
  if (body.mobilizationDate !== undefined && body.mobilizationDate !== null && typeof body.mobilizationDate !== "string") {
    return { valid: false, errors: { mobilizationDate: "invalid_type" } };
  }

  return { valid: true };
}

/** Normaliza o corpo recebido no formato de entrada tipado. */
export function toCreateVesselInput(body: Record<string, unknown>): CreateVesselInput {
  return {
    companyId: body.companyId as number | bigint | undefined,
    name: body.name as string,
    code: nullableString(body.code),
    imo: nullableString(body.imo),
    mmsi: nullableString(body.mmsi),
    vesselType: nullableString(body.vesselType),
    vesselClass: nullableString(body.vesselClass),
    flag: nullableString(body.flag),
    port: nullableString(body.port),
    location: nullableString(body.location),
    model: nullableString(body.model),
    manufacturer: nullableString(body.manufacturer),
    observations: nullableString(body.observations)
  };
}

export function toUpdateVesselInput(body: Record<string, unknown>): UpdateVesselInput {
  const input: UpdateVesselInput = {};
  if (body.name !== undefined) input.name = body.name as string;
  if (body.code !== undefined) input.code = nullableString(body.code);
  if (body.imo !== undefined) input.imo = nullableString(body.imo);
  if (body.mmsi !== undefined) input.mmsi = nullableString(body.mmsi);
  if (body.vesselType !== undefined) input.vesselType = nullableString(body.vesselType);
  if (body.vesselClass !== undefined) input.vesselClass = nullableString(body.vesselClass);
  if (body.flag !== undefined) input.flag = nullableString(body.flag);
  if (body.port !== undefined) input.port = nullableString(body.port);
  if (body.location !== undefined) input.location = nullableString(body.location);
  if (body.model !== undefined) input.model = nullableString(body.model);
  if (body.manufacturer !== undefined) input.manufacturer = nullableString(body.manufacturer);
  if (body.observations !== undefined) input.observations = nullableString(body.observations);
  return input;
}

export function toCreateMobilizationInput(body: Record<string, unknown>): CreateMobilizationForVesselInput {
  return {
    title: nullableString(body.title),
    serviceType: nullableString(body.serviceType),
    objective: nullableString(body.objective),
    location: nullableString(body.location),
    technicianName: nullableString(body.technicianName),
    mobilizationDate: typeof body.mobilizationDate === "string" ? body.mobilizationDate : undefined
  };
}

function nullableString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}
