import { describe, expect, it } from "vitest";
import { VesselService, VesselNotFoundError, VesselNameRequiredError } from "../src/modules/vessels";

describe("VesselService (módulo vessels)", () => {
  it("lança VesselNameRequiredError ao tentar criar embarcação sem nome", async () => {
    const db = createMockDb();
    const service = new VesselService(db as never);

    await expect(service.create({ name: " " } as never)).rejects.toThrow(VesselNameRequiredError);
  });

  it("lança VesselNotFoundError ao tentar buscar embarcação inexistente", async () => {
    const db = createMockDb();
    const service = new VesselService(db as never);

    await expect(service.getById(999)).rejects.toThrow(VesselNotFoundError);
  });

it("cria uma embarcação com sucesso", async () => {
    const db = createMockDb();
    const service = new VesselService(db as never);

    const vessel = await service.create({ name: "MV Bykonz" });
    expect(vessel).toBeDefined();
    expect(db.vessel.create).toHaveBeenCalled();
  });
});

function createMockDb() {
  return {
    vessel: {
      findMany: () => Promise.resolve([]),
      count: () => Promise.resolve(0),
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
      create: () => Promise.resolve({ created: true }),
      update: () => Promise.resolve({ updated: true }),
    },
    vesselMobilization: {
      create: () => Promise.resolve({ created: true }),
      count: () => Promise.resolve(0),
    },
  };
}
