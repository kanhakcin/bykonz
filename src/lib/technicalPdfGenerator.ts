import PDFDocument from "pdfkit";

/**
 * Gerador de PDF profissional para Relatórios Técnicos Bykonz.
 *
 * O PDF é sempre gerado dinamicamente a partir do conteúdo estruturado
 * armazenado no banco (campo `content` em Markdown simplificado), nunca a
 * partir de um arquivo salvo previamente. Suporta capa, cabeçalho/rodapé,
 * seções com títulos e visualização fotográfica das evidências.
 */

export interface TechnicalReportPdfInput {
  reportCode: string;
  title: string;
  summary?: string | null;
  conclusion?: string | null;
  content: string;
  clientName?: string | null;
  vesselName?: string | null;
  technicianName?: string | null;
  siteLocation?: string | null;
  mobilizationDate?: Date | null;
  attachments?: Array<{
    path: string;
    caption?: string | null;
  }>;
  downloadMedia?: (path: string) => Promise<Buffer | null>;
}

const HEADER_FILL = "#1f2937";
const ACCENT = "#0f766e";
const BORDER = "#d1d5db";
const MUTED = "#6b7280";

export class TechnicalPdfGenerator {
  async generate(input: TechnicalReportPdfInput): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 48, autoFirstPage: true, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const endPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    this.drawCover(doc, input);
    doc.addPage();
    this.drawPdfHeader(doc, input);
    this.drawContent(doc, input.content);
    if (input.attachments && input.attachments.length > 0) {
      await this.drawPhotoSection(doc, input.attachments, input.downloadMedia);
    }
    this.drawFooterPagination(doc);

    doc.end();
    return endPromise;
  }

  private drawCover(doc: PDFKit.PDFDocument, input: TechnicalReportPdfInput): void {
    const width = doc.page.width;
    const height = doc.page.height;
    const margin = 48;

    // Faixa superior decorativa
    doc.rect(0, 0, width, 14).fill(ACCENT);
    doc.rect(0, height - 14, width, 14).fill(ACCENT);

    // Título central
    doc
      .fillColor(HEADER_FILL)
      .font("Helvetica-Bold")
      .fontSize(30)
      .text("RELATÓRIO TÉCNICO", margin, height * 0.22, { align: "center", width: width - margin * 2 });

    doc
      .fillColor(ACCENT)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(input.title, margin, height * 0.32, { align: "center", width: width - margin * 2 });

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(14)
      .text(input.reportCode, margin, height * 0.42, { align: "center", width: width - margin * 2 });

    // Bloco de dados gerais
    const dataY = height * 0.55;
    doc.fontSize(11).fillColor(HEADER_FILL);
    const rows: Array<[string, string]> = [
      ["Cliente", input.clientName ?? "Não informado"],
      ["Embarcação", input.vesselName ?? "Não informada"],
      ["Local", input.siteLocation ?? "Não informado"],
      ["Técnico responsável", input.technicianName ?? "Não informado"],
      ["Data", input.mobilizationDate ? input.mobilizationDate.toISOString().slice(0, 10) : "Não informada"]
    ];

    let y = dataY;
    for (const [label, value] of rows) {
      doc.font("Helvetica-Bold").text(label, margin + 40, y, { width: 160 });
      doc.font("Helvetica").text(":  " + value, margin + 40 + 160, y, { width: width - margin * 2 - 200 });
      y += 22;
    }

    doc
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .fontSize(9)
      .text("Documento gerado automaticamente pelo Sistema Inteligente de Relatórios da Bykonz.", margin, height - 60, {
        align: "center",
        width: width - margin * 2
      });
  }

  private drawPdfHeader(doc: PDFKit.PDFDocument, input: TechnicalReportPdfInput): void {
    const width = doc.page.width;
    const margin = doc.page.margins.left;
    doc
      .fillColor(ACCENT)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(input.title, margin, 40, { width: width - margin * 2, align: "left" });
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(input.reportCode, margin, 56, { width: width - margin * 2, align: "left" });
    doc.moveTo(margin, 70).lineTo(width - margin, 70).strokeColor(BORDER).lineWidth(0.8).stroke();
    doc.y = 84;
  }

  private drawContent(doc: PDFKit.PDFDocument, content: string): void {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 40;
    const lines = content.split("\n");

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        doc.moveDown(0.4);
        continue;
      }

      if (line.startsWith("# ")) {
        this.ensureSpace(doc, bottomLimit);
        doc.font("Helvetica-Bold").fontSize(16).fillColor(HEADER_FILL).text(line.slice(2), { align: "left" });
        doc.moveDown(0.4);
        continue;
      }

      if (line.startsWith("## ")) {
        this.ensureSpace(doc, bottomLimit);
        doc.moveDown(0.6);
        doc.rect(doc.page.margins.left, doc.y, 6, 18).fill(ACCENT);
        doc.font("Helvetica-Bold").fontSize(13).fillColor(ACCENT).text("  " + line.slice(3), { align: "left" });
        doc.moveDown(0.3);
        continue;
      }

      if (line.startsWith("- ")) {
        this.ensureSpace(doc, bottomLimit);
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#111827")
          .text("•  " + line.slice(2), { align: "left", lineGap: 2 });
        doc.moveDown(0.15);
        continue;
      }

      if (line.startsWith("---")) {
        this.ensureSpace(doc, bottomLimit);
        doc.moveDown(0.4);
        const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + w, doc.y).strokeColor(BORDER).lineWidth(0.8).stroke();
        doc.moveDown(0.4);
        continue;
      }

      // Texto normal — quebra entre a descrição técnica e identificação
      if (line.includes(":")) {
        const idx = line.indexOf(":");
        const label = line.slice(0, idx);
        const value = line.slice(idx + 1).trim();
        this.ensureSpace(doc, bottomLimit);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(HEADER_FILL).text(label, doc.page.margins.left, doc.y, { continued: true });
        doc.font("Helvetica").fillColor("#111827").text(": " + value);
        doc.moveDown(0.1);
        continue;
      }

      this.ensureSpace(doc, bottomLimit);
      doc.font("Helvetica").fontSize(10).fillColor("#111827").text(line, { align: "left", lineGap: 2 });
      doc.moveDown(0.2);
    }
  }

  private async drawPhotoSection(
    doc: PDFKit.PDFDocument,
    attachments: Array<{ path: string; caption?: string | null }>,
    downloadMedia?: (path: string) => Promise<Buffer | null>
  ): Promise<void> {
    if (!downloadMedia) return;

    const margin = doc.page.margins.left;
    const contentWidth = doc.page.width - margin - doc.page.margins.right;
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 40;

    this.ensureSpace(doc, bottomLimit);
    doc.moveDown(0.6);
    doc.rect(margin, doc.y, 6, 18).fill(ACCENT);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(ACCENT).text("  Registro Fotográfico", { align: "left" });
    doc.moveDown(0.4);

    const gap = 8;
    const cellW = (contentWidth - gap) / 2;
    const imageH = 160;

    for (let i = 0; i < attachments.length; i += 2) {
      const pair = attachments.slice(i, i + 2);
      const captionHeights = pair.map((_, j) => {
        const caption = buildPhotoCaption(i + j, attachments[i + j].caption);
        return doc.heightOfString(caption, { width: cellW - 8 });
      });
      const captionH = Math.max(...captionHeights) + 8;
      const cellH = imageH + captionH;

      if (doc.y + cellH > bottomLimit) {
        doc.addPage();
        this.drawPdfHeader(doc, { reportCode: "", title: "Registro Fotográfico" } as TechnicalReportPdfInput);
      }

      const rowY = doc.y;
      for (let j = 0; j < pair.length; j++) {
        const x = margin + j * (cellW + gap);
        doc.lineWidth(0.5).strokeColor(BORDER).rect(x, rowY, cellW, imageH).stroke();
        const buffer = await downloadMedia(attachments[i + j].path).catch(() => null);
        if (buffer) {
          try {
            doc.image(buffer, x + 4, rowY + 4, { fit: [cellW - 8, imageH - 8], align: "center", valign: "center" });
          } catch {
            doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text("[Imagem indisponível]", x + 4, rowY + imageH / 2, { width: cellW - 8, align: "center" });
          }
        } else {
          doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text("[Imagem indisponível]", x + 4, rowY + imageH / 2, { width: cellW - 8, align: "center" });
        }
        doc.fillColor("#111827").font("Helvetica").fontSize(7.5).text(buildPhotoCaption(i + j, attachments[i + j].caption), x + 4, rowY + imageH + 4, { width: cellW - 8 });
      }
      doc.y = rowY + cellH + gap;
    }
  }

  private drawFooterPagination(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 30;
      const width = doc.page.width;
      const margin = doc.page.margins.left;
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(8)
        .text(`Página ${i + 1} de ${pages.count}`, margin, bottom, { align: "center", width: width - margin * 2 });
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .text("Bykonz — Relatório Técnico", margin, bottom, { align: "left", width: width - margin * 2 });
    }
  }

  private ensureSpace(doc: PDFKit.PDFDocument, bottomLimit: number): void {
    if (doc.y > bottomLimit) {
      // Informa o cabeçalho na nova página (continua seção)
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  }
}

function buildPhotoCaption(index: number, caption?: string | null): string {
  const num = String(index + 1).padStart(2, "0");
  const text = caption?.trim() ? caption.trim() : "Evidência registrada";
  return `Foto ${num}: ${text.length > 140 ? `${text.slice(0, 137)}...` : text}`;
}
