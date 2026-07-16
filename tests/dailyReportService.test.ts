import { describe, expect, it } from "vitest";
import { DailyReportService, InvalidReportDateError } from "../src/services/dailyReportService";
import type {
  ConversationStore,
  DailyReportInput,
  EntradaForReport,
  ObraForReport,
  PdfGenerator
} from "../src/services/conversationService";

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
    updateEntradaProcedureNumber: async () => {},
    hasProcedureCode: async () => true,
    findEntradasForReport: async () => [],
    findEntradasForObraDay: async () => [],
    findObraById: async () => null,
    findObrasForAutoReport: async () => [],
    assignDailyReportNumber: async () => 1,
    ...overrides
  };
}

function makePdfGenerator(): PdfGenerator {
  return {
    generateReport: async () => Buffer.from("%PDF-fake"),
    generateDailyReport: async () => Buffer.from("%PDF-fake")
  };
}

const OBRA: ObraForReport = {
  id: 1,
  nome: "Obra Residencial Aurora",
  codigo: "130",
  construtoraNome: "Construtora Tanen",
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
    let assignCalls = 0;
    const service = new DailyReportService(
      makeStore({
        findObraById: async () => OBRA,
        findEntradasForObraDay: async () => [],
        assignDailyReportNumber: async () => {
          assignCalls += 1;
          return 1;
        }
      }),
      makePdfGenerator()
    );

    const result = await service.generateForObraDay({ obraId: 1, date: "2026-06-22" });

    expect(result).not.toBeNull();
    expect(result?.totalEntradas).toBe(0);
    expect(result?.buffer).toBeInstanceOf(Buffer);
    // Dia sem registros não consome número de sequência nem gera nome de arquivo.
    expect(result?.filename).toBeNull();
    expect(assignCalls).toBe(0);
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

    let receivedInput: DailyReportInput | undefined;
    const pdfGenerator: PdfGenerator = {
      generateReport: async () => Buffer.from("%PDF-fake"),
      generateDailyReport: async (input) => {
        receivedInput = input;
        return Buffer.from("%PDF-fake");
      }
    };

    const service = new DailyReportService(
      makeStore({
        findObraById: async () => OBRA,
        findEntradasForObraDay: async () => entradas,
        assignDailyReportNumber: async () => 133
      }),
      pdfGenerator
    );

    const result = await service.generateForObraDay({ obraId: 1, date: "2026-06-22" });

    expect(result?.totalEntradas).toBe(2);
    expect(receivedInput?.entradas).toHaveLength(2);
    expect(receivedInput?.obraNome).toBe(OBRA.nome);
    expect(receivedInput?.obraCodigo).toBe("130");
    expect(receivedInput?.construtoraNome).toBe("Construtora Tanen");
    expect(receivedInput?.reportDate).toBe("2026-06-22");
    // Nome do arquivo no padrão "{código} - DO {sequência} - {DD-MM-AA}.pdf".
    expect(result?.filename).toBe("130 - DO 133 - 22-06-26.pdf");
  });

  it("reuses the assigned sequence for the same day and builds the filename from the project code", async () => {
    let calls = 0;
    const service = new DailyReportService(
      makeStore({
        findObraById: async () => OBRA,
        findEntradasForObraDay: async () => [
          {
            id: 1n,
            description: "Registro",
            createdAt: new Date("2026-07-14T10:00:00Z"),
            tipo: "Inspecao de servico",
            tipoServico: null,
            numeroProcedimento: null,
            empresaNome: "Empresa A",
            usuarioNome: "Joao",
            mediaUrls: []
          }
        ],
        assignDailyReportNumber: async () => {
          calls += 1;
          return 133;
        }
      }),
      makePdfGenerator()
    );

    const first = await service.generateForObraDay({ obraId: 1, date: "2026-07-14" });
    const second = await service.generateForObraDay({ obraId: 1, date: "2026-07-14" });

    expect(first?.filename).toBe("130 - DO 133 - 14-07-26.pdf");
    expect(second?.filename).toBe("130 - DO 133 - 14-07-26.pdf");
    expect(calls).toBe(2);
  });
});
