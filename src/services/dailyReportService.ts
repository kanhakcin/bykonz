import type { ConversationStore, PdfGenerator } from "./conversationService";

export class InvalidReportDateError extends Error {
  constructor(value: string) {
    super(`Invalid date: ${value} (expected YYYY-MM-DD)`);
    this.name = "InvalidReportDateError";
  }
}

export interface DailyReportResult {
  buffer: Buffer;
  totalEntradas: number;
}

export class DailyReportService {
  constructor(
    private readonly store: ConversationStore,
    private readonly pdfGenerator: PdfGenerator,
    private readonly options: { timezoneOffset?: string } = {}
  ) {}

  private get tzOffset(): string {
    return this.options.timezoneOffset ?? "-03:00";
  }

  async generateForObraDay(input: { obraId: number; date: string }): Promise<DailyReportResult | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new InvalidReportDateError(input.date);
    }

    const obra = await this.store.findObraById(input.obraId);
    if (!obra) {
      return null;
    }

    const start = new Date(`${input.date}T00:00:00${this.tzOffset}`);
    if (Number.isNaN(start.getTime())) {
      throw new InvalidReportDateError(input.date);
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const entradas = await this.store.findEntradasForObraDay({ obraId: obra.id, dateStart: start, dateEnd: end });

    const buffer = await this.pdfGenerator.generateReport({
      categoria: "Diario de Obra",
      obraNome: obra.nome,
      reportDate: formatBR(input.date),
      generatedAt: new Date(),
      entradas
    });

    return { buffer, totalEntradas: entradas.length };
  }
}

function formatBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
