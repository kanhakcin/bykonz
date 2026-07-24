import { describe, expect, it } from "vitest";
import { renderEmailHtml, renderEmailText } from "../src/lib/emailTemplate";

describe("emailTemplate", () => {
  const input = {
    heading: "Obra Residencial Aurora — 06/07/2026",
    paragraphs: ["Segue em anexo o Diário de Obra.", "Bom trabalho."],
    note: "Anexo: MRH - DO 5.pdf"
  };

  it("renders an HTML document with the brand header, heading, paragraphs and note", () => {
    const html = renderEmailHtml(input);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Diário de Obra"); // cabeçalho da marca
    expect(html).toContain("#1969a1"); // cor da marca
    expect(html).toContain("Obra Residencial Aurora — 06/07/2026");
    expect(html).toContain("Segue em anexo o Diário de Obra.");
    expect(html).toContain("Bom trabalho.");
    expect(html).toContain("Anexo: MRH - DO 5.pdf");
  });

  it("escapes HTML in user-provided content", () => {
    const html = renderEmailHtml({ heading: "<script>alert(1)</script>", paragraphs: ["a & b <b>x</b>"] });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &lt;b&gt;x&lt;/b&gt;");
  });

  it("renders a plain-text fallback with heading, paragraphs and note", () => {
    const text = renderEmailText(input);
    expect(text).toContain("Obra Residencial Aurora — 06/07/2026");
    expect(text).toContain("Segue em anexo o Diário de Obra.");
    expect(text).toContain("Anexo: MRH - DO 5.pdf");
    expect(text).toContain("Diário de Obra"); // assinatura
    // Não deve conter tags HTML.
    expect(text).not.toContain("<");
  });
});
