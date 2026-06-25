import { describe, expect, it } from "vitest";
import { PdfReportGenerator } from "../src/lib/pdfGenerator";
import type { ObjectStorage, ReportInput } from "../src/services/conversationService";

function makeStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    uploadPrivateObject: async () => {},
    downloadPrivateObject: async () => Buffer.from("fake-image"),
    ...overrides
  };
}

const BASE_INPUT: ReportInput = {
  categoria: "Inspecao de servico",
  empresaNome: "Obra Centro",
  reportDate: "22/06/2026",
  generatedAt: new Date("2026-06-22T15:00:00Z"),
  entradas: []
};

describe("PdfReportGenerator", () => {
  it("returns a buffer starting with %PDF", async () => {
    const generator = new PdfReportGenerator(makeStorage());

    const result = await generator.generateReport({
      ...BASE_INPUT,
      entradas: [
        {
          id: 1n,
          description: "Parede concretada",
          createdAt: new Date("2026-06-22T10:00:00Z"),
          tipo: "Inspecao de servico",
          tipoServico: "Concretagem",
          numeroProcedimento: "PROC-45/2026",
          empresaNome: "Obra Centro",
          usuarioNome: "Joao",
          mediaUrls: []
        }
      ]
    });

    expect(result).toBeInstanceOf(Buffer);
    expect(result.slice(0, 4).toString()).toBe("%PDF");
  });

  it("generates a PDF when training metadata is present", async () => {
    const generator = new PdfReportGenerator(makeStorage());

    const result = await generator.generateReport({
      ...BASE_INPUT,
      categoria: "Treinamento",
      entradas: [
        {
          id: 1n,
          description: "",
          createdAt: new Date("2026-06-22T10:00:00Z"),
          tipo: "Treinamento",
          tipoServico: null,
          numeroProcedimento: null,
          treinamentoTema: "NR-35 Trabalho em altura",
          treinamentoParticipantes: "Ana Silva - 123.456.789-00",
          treinamentoInicio: new Date("2026-06-22T11:00:00Z"),
          treinamentoFim: new Date("2026-06-22T13:00:00Z"),
          empresaNome: "Obra Centro",
          usuarioNome: "Joao",
          mediaUrls: []
        }
      ]
    });

    expect(result.slice(0, 4).toString()).toBe("%PDF");
  });

  it("calls downloadPrivateObject for each JPEG and PNG media path", async () => {
    const downloaded: string[] = [];
    const storage = makeStorage({
      downloadPrivateObject: async (path) => {
        downloaded.push(path);
        // Minimal 1x1 white JPEG bytes
        return Buffer.from(
          "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b08000100010101001100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda00080101000005021a00ffd9",
          "hex"
        );
      }
    });

    const generator = new PdfReportGenerator(storage);

    await generator.generateReport({
      ...BASE_INPUT,
      entradas: [
        {
          id: 1n,
          description: null,
          createdAt: new Date(),
          tipo: null,
          tipoServico: null,
          numeroProcedimento: null,
          empresaNome: null,
          usuarioNome: null,
          mediaUrls: ["entradas/10/7/2026-06-22/photo.jpg", "entradas/10/7/2026-06-22/other.png"]
        }
      ]
    });

    expect(downloaded).toEqual([
      "entradas/10/7/2026-06-22/photo.jpg",
      "entradas/10/7/2026-06-22/other.png"
    ]);
  });

  it("skips unsupported image formats without downloading and without failing", async () => {
    const downloaded: string[] = [];
    const storage = makeStorage({
      downloadPrivateObject: async (path) => {
        downloaded.push(path);
        return Buffer.from("data");
      }
    });

    const generator = new PdfReportGenerator(storage);

    const result = await generator.generateReport({
      ...BASE_INPUT,
      entradas: [
        {
          id: 1n,
          description: "test",
          createdAt: new Date(),
          tipo: null,
          tipoServico: null,
          numeroProcedimento: null,
          empresaNome: null,
          usuarioNome: null,
          mediaUrls: ["photo.webp", "photo.gif", "photo.jpg"]
        }
      ]
    });

    // Only the .jpg should be downloaded; webp and gif are skipped
    expect(downloaded).toEqual(["photo.jpg"]);
    expect(result.slice(0, 4).toString()).toBe("%PDF");
  });

  it("adds a note instead of crashing when an image download fails", async () => {
    const storage = makeStorage({
      downloadPrivateObject: async () => {
        throw new Error("network error");
      }
    });

    const generator = new PdfReportGenerator(storage);

    // Should not throw even though the download fails
    const result = await generator.generateReport({
      ...BASE_INPUT,
      entradas: [
        {
          id: 1n,
          description: null,
          createdAt: new Date(),
          tipo: null,
          tipoServico: null,
          numeroProcedimento: null,
          empresaNome: null,
          usuarioNome: null,
          mediaUrls: ["entradas/10/7/2026-06-22/photo.jpg"]
        }
      ]
    });

    expect(result.slice(0, 4).toString()).toBe("%PDF");
  });

  it("generates a valid PDF with no entries", async () => {
    const generator = new PdfReportGenerator(makeStorage());
    const result = await generator.generateReport(BASE_INPUT);
    expect(result.slice(0, 4).toString()).toBe("%PDF");
  });
});
