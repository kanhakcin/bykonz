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
  /**
   * Nome do arquivo PDF no padrão "{código} - DO {sequência} - {DD-MM-AA}.pdf"
   * (ex.: "MRH - DO 133 - 14-07-26.pdf"). É `null` quando o dia não tem
   * registros — nesse caso nenhum PDF é enviado e nenhum número é consumido.
   */
  filename: string | null;
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

    const buffer = await this.pdfGenerator.generateDailyReport({
      obraNome: obra.nome,
      obraCodigo: obra.codigo ?? null,
      construtoraNome: obra.construtoraNome ?? null,
      reportDate: input.date,
      generatedAt: new Date(),
      entradas
    });

    // Dia sem registros não gera PDF nos canais; não consome número de sequência.
    if (entradas.length === 0) {
      return { buffer, totalEntradas: 0, filename: null };
    }

    const sequence = await this.store.assignDailyReportNumber({ obraId: obra.id, date: input.date });
    const filename = buildDailyReportFilename(obra.codigo, obra.id, sequence, input.date);

    return { buffer, totalEntradas: entradas.length, filename };
  }
}

/**
 * Monta o nome do arquivo do diário: "{código} - DO {sequência} - {DD-MM-AA}.pdf".
 * Sem código cadastrado, usa o id da obra como identificador (fallback).
 */
export function buildDailyReportFilename(
  code: string | null | undefined,
  obraId: number,
  sequence: number,
  isoDate: string
): string {
  const identifier = code?.trim() ? code.trim() : String(obraId);
  const [year, month, day] = isoDate.split("-");
  const shortDate = `${day}-${month}-${year.slice(2)}`;
  return `${identifier} - DO ${sequence} - ${shortDate}.pdf`;
}
