import { describe, expect, it } from "vitest";
import { DailyReportService, InvalidReportDateError } from "../src/services/dailyReportService";
import type { ConversationStore, EntradaForReport, ObraForReport, PdfGenerator, ReportInput } from "../src/services/conversationService";

function makeStore(overrides: Partial<ConversationStore> = {}): ConversationStore {
  return {
    findUserByPhone: async () => null,
    findEmpresasByUser: async () => [],
    findObrasAtivas: async () => [],
    getState: async () => null,
    saveState: async (input) => input,
    clearState: async () => {},
    createEntrada: async () => ({ id: 1n }),
    createTreinamento: async () => ({ entradaId: 1n, treinamentoId: 1 }),
    addEntradaMedia: async () => {},
    updateEntradaDescription: async () => {},
    findEntradasForReport: async () => [],
    findEntradasForObraDay: async () => [],
    findObraById: async () => null,
    findObrasForAutoReport: async () => [],
    ...overrides
  };
}

function makePdfGenerator(): PdfGenerator {
  return {
    generateReport: async () => Buffer.from("%PDF-fake")
  };
}

const OBRA: ObraForReport = {
  id: 1,
  nome: "Obra Residencial Aurora",
  whatsappGroupId: "1203630xxxxx@g.us",
  whatsappAutoReportEnabled: true,
  status: "ACTIVE"
};

describe("DailyReportService", () => {
  it("returns null when the obra does not exist", async () => {
    const service = new DailyReportService(makeStore({ findObraById: async () => null }), makePdfGenerator());

    const result = await service.generateForObraDay({ obraId: 999, date: "2026-06-22" });

    expect(result).toBeNull();
  });

  it("throws InvalidReportDateError for a malformed date", async () => {
    const service = new DailyReportService(makeStore(), makePdfGenerator());

    await expect(service.generateForObraDay({ obraId: 1, date: "22/06/2026" })).rejects.toThrow(InvalidReportDateError);
  });

  it("generates a PDF with zero entradas when the obra has no records that day", async () => {
    const service = new DailyReportService(
      makeStore({ findObraById: async () => OBRA, findEntradasForObraDay: async () => [] }),
      makePdfGenerator()
    );

    const result = await service.generateForObraDay({ obraId: 1, date: "2026-06-22" });

    expect(result).not.toBeNull();
    expect(result?.totalEntradas).toBe(0);
    expect(result?.buffer).toBeInstanceOf(Buffer);
  });

  it("generates a PDF aggregating entradas from multiple companies", async () => {
    const entradas: EntradaForReport[] = [
      {
        id: 1n,
        description: "Inspecao concluida",
        createdAt: new Date("2026-06-22T10:00:00Z"),
        tipo: "Inspecao de servico",
        tipoServico: "Concretagem",
        numeroProcedimento: null,
        empresaNome: "Empresa A",
        usuarioNome: "Joao",
        mediaUrls: []
      },
      {
        id: 2n,
        description: "Material recebido",
        createdAt: new Date("2026-06-22T11:00:00Z"),
        tipo: "Recebimento de material",
        tipoServico: null,
        numeroProcedimento: null,
        empresaNome: "Empresa B",
        usuarioNome: "Maria",
        mediaUrls: []
      }
    ];

    let receivedInput: ReportInput | undefined;
    const pdfGenerator: PdfGenerator = {
      generateReport: async (input) => {
        receivedInput = input;
        return Buffer.from("%PDF-fake");
      }
    };

    const service = new DailyReportService(
      makeStore({ findObraById: async () => OBRA, findEntradasForObraDay: async () => entradas }),
      pdfGenerator
    );

    const result = await service.generateForObraDay({ obraId: 1, date: "2026-06-22" });

    expect(result?.totalEntradas).toBe(2);
    expect(receivedInput?.entradas).toHaveLength(2);
    expect(receivedInput?.obraNome).toBe(OBRA.nome);
    expect(receivedInput?.empresaNome).toBeUndefined();
  });
});
