import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

/**
 * Gerador de Word (.docx) profissional para Relatórios Técnicos Bykonz.
 * O conteúdo vem do banco (campo `content` em Markdown simplificado) e é
 * convertido em um documento .docx estruturado com capa, seções e tabelas.
 */

export interface TechnicalDocxInput {
  reportCode: string;
  title: string;
  content: string;
}

const ACCENT = "0F766E";
const HEADER = "1F2937";
const MUTED = "6B7280";

export class TechnicalDocxGenerator {
  async generate(input: TechnicalDocxInput): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
            },
          },
          children: this.buildChildren(input),
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }

  private buildChildren(input: TechnicalDocxInput): Paragraph[] {
    const children: Paragraph[] = [];

    // Capa
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400 },
        children: [new TextRun({ text: "RELATÓRIO TÉCNICO", bold: true, size: 56, color: HEADER })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: input.title, bold: true, size: 36, color: ACCENT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300 },
        children: [new TextRun({ text: input.reportCode, size: 28, color: MUTED })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200 },
        children: [
          new TextRun({
            text: "Documento gerado automaticamente pelo Sistema Inteligente de Relatórios da Bykonz.",
            size: 20,
            color: MUTED,
            italics: true,
          }),
        ],
      }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [] }),
    );

    const lines = input.content.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        children.push(new Paragraph({ children: [] }));
        continue;
      }

      if (line.startsWith("# ")) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: line.slice(2), bold: true, size: 32, color: HEADER })],
          })
        );
        continue;
      }

      if (line.startsWith("## ")) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [new TextRun({ text: line.slice(3), bold: true, size: 26, color: ACCENT })],
          })
        );
        continue;
      }

      if (line.startsWith("- ")) {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 360 },
            children: [new TextRun({ text: "•  " + line.slice(2), size: 22 })],
          })
        );
        continue;
      }

      if (line.startsWith("---")) {
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 200 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MUTED } },
            children: [],
          })
        );
        continue;
      }

      if (line.includes(":")) {
        const idx = line.indexOf(":");
        const label = line.slice(0, idx);
        const value = line.slice(idx + 1).trim();
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: label + ": ", bold: true, size: 22 }),
              new TextRun({ text: value, size: 22 }),
            ],
          })
        );
        continue;
      }

      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: line, size: 22 })],
        })
      );
    }

    return children;
  }
}
