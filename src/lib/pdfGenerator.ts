import PDFDocument from "pdfkit";
import type { EntradaForReport, ObjectStorage, PdfGenerator, ReportInput } from "../services/conversationService";

export class PdfReportGenerator implements PdfGenerator {
  constructor(private readonly objectStorage: ObjectStorage) {}

  async generateReport(input: ReportInput): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const endPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const margin = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    doc.fontSize(16).font("Helvetica-Bold").text(input.categoria, { align: "center" });
    doc.fontSize(14).font("Helvetica-Bold").text("Relatorio", { align: "center" });
    doc.font("Helvetica").fontSize(10);
    doc.moveDown(0.5);
    doc.text(`Empresa: ${input.empresaNome}`);
    doc.text(`Data: ${input.reportDate}`);
    doc.text(`Gerado em: ${formatDateTime(input.generatedAt)}`);
    doc.text(`Total de registros: ${input.entradas.length}`);
    doc.moveDown(0.5);

    doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).stroke();
    doc.moveDown(1);

    // Entries
    for (const entrada of input.entradas) {
      const time = formatTime(entrada.createdAt);
      const author = entrada.usuarioNome ?? "Desconhecido";

      doc.fontSize(10).font("Helvetica-Bold").text(`${time} - ${author}`);

      if (entrada.treinamentoTema) {
        doc.font("Helvetica").text(`Tema do treinamento: ${entrada.treinamentoTema}`);
      }

      if (entrada.treinamentoParticipantes) {
        doc.font("Helvetica").text(`Participantes: ${entrada.treinamentoParticipantes}`);
      }

      if (entrada.treinamentoInicio && entrada.treinamentoFim) {
        doc
          .font("Helvetica")
          .text(`Inicio/Fim: ${formatDateTime(entrada.treinamentoInicio)} - ${formatDateTime(entrada.treinamentoFim)}`);
      }

      if (entrada.tipoServico) {
        doc.font("Helvetica").text(`Tipo de serviço: ${entrada.tipoServico}`);
      }

      if (entrada.numeroProcedimento) {
        doc.font("Helvetica").text(`Procedimento: ${entrada.numeroProcedimento}`);
      }

      if (entrada.description) {
        doc.font("Helvetica").text(entrada.description);
      }
      doc.moveDown(0.3);

      for (const mediaPath of entrada.mediaUrls) {
        const ext = mediaPath.split(".").pop()?.toLowerCase();
        const isSupported = ext === "jpg" || ext === "jpeg" || ext === "png";

        if (!isSupported) {
          doc.fontSize(9).font("Helvetica-Oblique").text("[Arquivo em formato nao exibido no PDF]");
          doc.moveDown(0.3);
          continue;
        }

        try {
          const imageBuffer = await this.objectStorage.downloadPrivateObject(mediaPath);
          doc.image(imageBuffer, { fit: [contentWidth, 200] });
          doc.moveDown(0.5);
        } catch {
          doc.fontSize(9).font("Helvetica-Oblique").text("[Imagem nao disponivel]");
          doc.moveDown(0.3);
        }
      }

      doc.moveDown(0.3);
      doc
        .moveTo(margin, doc.y)
        .lineTo(margin + contentWidth, doc.y)
        .dash(3, { space: 3 })
        .stroke()
        .undash();
      doc.moveDown(0.5);
    }

    doc.end();
    return endPromise;
  }
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit"
  });
}
