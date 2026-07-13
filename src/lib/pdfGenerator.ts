import PDFDocument from "pdfkit";
import type {
  DailyReportInput,
  EntradaForReport,
  ObjectStorage,
  PdfGenerator,
  ReportInput
} from "../services/conversationService";

/** Cores do layout do diário (espelham o formulário manual F-06-03). */
const TABLE_HEADER_FILL = "#595959";
const TABLE_BORDER = "#8c8c8c";
const LIGHT_TEXT = "#ffffff";

interface DailyPhoto {
  mediaPath: string;
  caption: string;
  buffer: Buffer | null;
}

interface CompanyGroup {
  empresaNome: string;
  atividades: string[];
  responsaveis: string[];
}

export class PdfReportGenerator implements PdfGenerator {
  constructor(private readonly objectStorage: ObjectStorage) {}

  /**
   * "Diário de Obra" diário no formato do formulário manual: cabeçalho com
   * construtora + empreendimento, tabela de atividades agrupada por empresa
   * (responsável = usuário que registrou via WhatsApp) e grade de fotos
   * numeradas com legenda.
   */
  async generateDailyReport(input: DailyReportInput): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 36, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const endPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    // Baixa as fotos antes de diagramar: com as alturas conhecidas, a
    // paginação da grade fica determinística.
    const photos = await this.loadDailyPhotos(input.entradas);

    this.drawDailyHeader(doc, input);
    this.drawActivitiesTable(doc, groupEntradasByEmpresa(input.entradas));
    this.drawPhotoGrid(doc, photos);

    doc.moveDown(1);
    doc
      .font("Helvetica-Oblique")
      .fontSize(7)
      .fillColor("#666666")
      .text(`Gerado automaticamente em ${formatDateTime(input.generatedAt)}`, { align: "right" });

    doc.end();
    return endPromise;
  }

  private async loadDailyPhotos(entradas: EntradaForReport[]): Promise<DailyPhoto[]> {
    const photos: DailyPhoto[] = [];
    for (const entrada of entradas) {
      const caption = buildActivityText(entrada);
      for (const mediaPath of entrada.mediaUrls) {
        const ext = mediaPath.split(".").pop()?.toLowerCase();
        if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") {
          continue;
        }
        try {
          const buffer = await this.objectStorage.downloadPrivateObject(mediaPath);
          photos.push({ mediaPath, caption, buffer });
        } catch {
          photos.push({ mediaPath, caption, buffer: null });
        }
      }
    }
    return photos;
  }

  private drawDailyHeader(doc: PDFKit.PDFDocument, input: DailyReportInput): void {
    const margin = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = doc.y;

    // Faixa com os "logos" em texto (construtora + empreendimento) e o título
    // do documento à direita, contornada como no formulário manual.
    const bandHeight = 46;
    doc.rect(margin, top, contentWidth, bandHeight).lineWidth(0.8).strokeColor(TABLE_BORDER).stroke();

    const construtora = input.construtoraNome?.trim() || "Construtora";
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#000000")
      .text(construtora.toUpperCase(), margin + 10, top + 8, { width: contentWidth * 0.42, ellipsis: true, height: 20 });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#666666")
      .text("Construtora", margin + 10, top + 28);

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#000000")
      .text(input.obraNome.toUpperCase(), margin + contentWidth * 0.44, top + 10, {
        width: contentWidth * 0.34,
        ellipsis: true,
        height: 18
      });
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#666666")
      .text("Empreendimento", margin + contentWidth * 0.44, top + 28);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#000000")
      .text("Diário de Obras", margin + contentWidth * 0.8, top + 12, { width: contentWidth * 0.2 - 10, align: "right" });

    // Linha de identificação: número da obra + data por extenso.
    const infoY = top + bandHeight + 8;
    doc.font("Helvetica").fontSize(9).fillColor("#000000");
    const obraLabel = input.obraCodigo ? `Diário de Obra:  ${input.obraCodigo}` : `Diário de Obra:  ${input.obraNome}`;
    doc.text(obraLabel, margin, infoY, { continued: true });
    doc.font("Helvetica-Bold").text(`     Data:  ${formatLongDate(input.reportDate)}`);

    doc.y = infoY + 18;
  }

  /** Tabela "Empresa | Atividades desenvolvidas | Responsável" agrupada por empresa. */
  private drawActivitiesTable(doc: PDFKit.PDFDocument, groups: CompanyGroup[]): void {
    const margin = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colEmpresa = 105;
    const colResponsavel = 95;
    const colAtividades = contentWidth - colEmpresa - colResponsavel;
    const pad = 5;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    const drawHeaderRow = () => {
      const y = doc.y;
      const h = 18;
      doc.rect(margin, y, contentWidth, h).fillColor(TABLE_HEADER_FILL).fill();
      doc.fillColor(LIGHT_TEXT).font("Helvetica-Bold").fontSize(8.5);
      doc.text("Empresa", margin + pad, y + 5, { width: colEmpresa - pad * 2, align: "center" });
      doc.text("Atividades desenvolvidas", margin + colEmpresa + pad, y + 5, {
        width: colAtividades - pad * 2,
        align: "center"
      });
      doc.text("Responsável", margin + colEmpresa + colAtividades + pad, y + 5, {
        width: colResponsavel - pad * 2,
        align: "center"
      });
      doc.y = y + h;
    };

    drawHeaderRow();

    if (groups.length === 0) {
      const y = doc.y;
      const h = 24;
      doc.rect(margin, y, contentWidth, h).lineWidth(0.5).strokeColor(TABLE_BORDER).stroke();
      doc
        .fillColor("#000000")
        .font("Helvetica-Oblique")
        .fontSize(8.5)
        .text("Nenhum registro nesta data.", margin + pad, y + 8, { width: contentWidth - pad * 2, align: "center" });
      doc.y = y + h + 10;
      return;
    }

    doc.font("Helvetica").fontSize(8.5).fillColor("#000000");
    for (const group of groups) {
      const atividadesText = group.atividades.map((a) => `- ${a};`).join("\n\n");
      const responsavelText = group.responsaveis.join(", ");

      const hEmpresa = doc.heightOfString(group.empresaNome, { width: colEmpresa - pad * 2 });
      const hAtividades = doc.heightOfString(atividadesText, { width: colAtividades - pad * 2 });
      const hResponsavel = doc.heightOfString(responsavelText, { width: colResponsavel - pad * 2 });
      const rowH = Math.max(hEmpresa, hAtividades, hResponsavel) + pad * 2;

      if (doc.y + rowH > bottomLimit) {
        doc.addPage();
        drawHeaderRow();
        doc.font("Helvetica").fontSize(8.5).fillColor("#000000");
      }

      const y = doc.y;
      doc.lineWidth(0.5).strokeColor(TABLE_BORDER);
      doc.rect(margin, y, colEmpresa, rowH).stroke();
      doc.rect(margin + colEmpresa, y, colAtividades, rowH).stroke();
      doc.rect(margin + colEmpresa + colAtividades, y, colResponsavel, rowH).stroke();

      const centerOffset = (h: number) => y + Math.max(pad, (rowH - h) / 2);
      doc.text(group.empresaNome, margin + pad, centerOffset(hEmpresa), {
        width: colEmpresa - pad * 2,
        align: "center"
      });
      doc.text(atividadesText, margin + colEmpresa + pad, y + pad, { width: colAtividades - pad * 2 });
      doc.text(responsavelText, margin + colEmpresa + colAtividades + pad, centerOffset(hResponsavel), {
        width: colResponsavel - pad * 2,
        align: "center"
      });

      doc.y = y + rowH;
    }

    doc.y += 12;
  }

  /** Grade de fotos 2 colunas com legendas numeradas ("Foto 01: ..."). */
  private drawPhotoGrid(doc: PDFKit.PDFDocument, photos: DailyPhoto[]): void {
    if (photos.length === 0) {
      return;
    }

    const margin = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    const gap = 8;
    const cellW = (contentWidth - gap) / 2;
    const imageH = 170;
    const pad = 4;

    // Barra de seção "FOTOS:" como no formulário manual.
    const labelY = doc.y;
    doc.rect(margin, labelY, contentWidth, 14).fillColor(TABLE_HEADER_FILL).fill();
    doc.fillColor(LIGHT_TEXT).font("Helvetica-Bold").fontSize(8.5).text("FOTOS:", margin + pad, labelY + 3);
    doc.y = labelY + 14 + gap;

    doc.fillColor("#000000");
    for (let i = 0; i < photos.length; i += 2) {
      const pair = photos.slice(i, i + 2);

      doc.font("Helvetica").fontSize(7.5);
      const captionHeights = pair.map((photo, j) =>
        doc.heightOfString(buildPhotoCaption(i + j, photo.caption), { width: cellW - pad * 2 })
      );
      const captionH = Math.max(...captionHeights) + pad * 2;
      const cellH = imageH + captionH;

      if (doc.y + cellH > bottomLimit) {
        doc.addPage();
      }

      const rowY = doc.y;
      pair.forEach((photo, j) => {
        const x = margin + j * (cellW + gap);

        doc.lineWidth(0.5).strokeColor(TABLE_BORDER);
        doc.rect(x, rowY, cellW, imageH).stroke();
        if (photo.buffer) {
          try {
            doc.image(photo.buffer, x + pad, rowY + pad, {
              fit: [cellW - pad * 2, imageH - pad * 2],
              align: "center",
              valign: "center"
            });
          } catch {
            this.drawPhotoPlaceholder(doc, x, rowY, cellW, imageH);
          }
        } else {
          this.drawPhotoPlaceholder(doc, x, rowY, cellW, imageH);
        }

        doc.rect(x, rowY + imageH, cellW, captionH).stroke();
        doc
          .fillColor("#000000")
          .font("Helvetica")
          .fontSize(7.5)
          .text(buildPhotoCaption(i + j, photo.caption), x + pad, rowY + imageH + pad, { width: cellW - pad * 2 });
      });

      doc.y = rowY + cellH + gap;
    }
  }

  private drawPhotoPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number): void {
    doc
      .fillColor("#888888")
      .font("Helvetica-Oblique")
      .fontSize(8)
      .text("[Imagem nao disponivel]", x + 4, y + h / 2 - 4, { width: w - 8, align: "center" });
    doc.fillColor("#000000");
  }

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
    if (input.empresaNome) {
      doc.text(`Empresa: ${input.empresaNome}`);
    }
    if (input.obraNome) {
      doc.text(`Obra: ${input.obraNome}`);
    }
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

      if (entrada.tipo) {
        doc.font("Helvetica-Oblique").fontSize(9).text(`Categoria: ${entrada.tipo}`);
      }

      if (entrada.empresaNome) {
        doc.font("Helvetica-Oblique").fontSize(9).text(`Empresa: ${entrada.empresaNome}`);
      }

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

/** "2026-07-09" → "quinta-feira, 9 de julho de 2026" (como no formulário manual). */
function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

/** Texto da atividade de um registro para a tabela e para a legenda da foto. */
function buildActivityText(entrada: EntradaForReport): string {
  if (entrada.treinamentoTema) {
    return `Treinamento: ${entrada.treinamentoTema}`;
  }
  const description = entrada.description?.trim();
  if (description) {
    return description;
  }
  return entrada.tipoServico ? `${entrada.tipoServico}` : "Registro sem descrição";
}

function buildPhotoCaption(index: number, caption: string): string {
  const numero = String(index + 1).padStart(2, "0");
  const text = caption.length > 160 ? `${caption.slice(0, 157)}...` : caption;
  return `Foto ${numero}: ${text}`;
}

/**
 * Agrupa os registros do dia por empresa (a query já vem ordenada por
 * companyId). Responsável = usuários (tabela Users, cadastrados por telefone)
 * que fizeram os registros daquela empresa via WhatsApp.
 */
function groupEntradasByEmpresa(entradas: EntradaForReport[]): CompanyGroup[] {
  const groups = new Map<string, CompanyGroup>();
  for (const entrada of entradas) {
    const empresaNome = entrada.empresaNome ?? "Empresa não informada";
    let group = groups.get(empresaNome);
    if (!group) {
      group = { empresaNome, atividades: [], responsaveis: [] };
      groups.set(empresaNome, group);
    }
    group.atividades.push(buildActivityText(entrada));
    const responsavel = entrada.usuarioNome ?? "Desconhecido";
    if (!group.responsaveis.includes(responsavel)) {
      group.responsaveis.push(responsavel);
    }
  }
  return [...groups.values()];
}
