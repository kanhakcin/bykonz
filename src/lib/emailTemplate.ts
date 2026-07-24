/**
 * Template mínimo e apresentável para os e-mails do Diário de Obra.
 *
 * HTML "email-safe": layout em tabela, CSS inline, largura fixa e cores em hex
 * — o que os clientes de e-mail (Gmail/Outlook) renderizam de forma confiável.
 * O cabeçalho é textual, na cor da marca (sem imagem/logo, por escolha de UX:
 * SVG não renderiza em e-mail e evita anexos de imagem).
 *
 * Sempre acompanhar de uma versão `text` (fallback para clientes sem HTML).
 */

/** Azul da marca (mesmo tom do wordmark em frontend/public/logo.svg). */
const BRAND_COLOR = "#1969a1";
const BRAND_NAME = "Diário de Obra";

/** Escapa texto para interpolar com segurança no HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailTemplateInput {
  /** Título exibido em destaque no corpo (ex.: nome da obra). */
  heading: string;
  /** Parágrafos do corpo (texto puro; são escapados). */
  paragraphs: string[];
  /** Linha opcional de destaque (ex.: "Anexo: diário em PDF"). */
  note?: string;
}

/**
 * Monta o HTML do e-mail. Use `renderEmailText` para o fallback textual
 * equivalente.
 */
export function renderEmailHtml(input: EmailTemplateInput): string {
  const heading = escapeHtml(input.heading);
  const body = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(paragraph)}</p>`
    )
    .join("");
  const note = input.note
    ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">${escapeHtml(input.note)}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#f1f5f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:${BRAND_COLOR};padding:20px 32px;">
                <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${BRAND_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 20px;font-size:18px;line-height:1.3;color:#0f172a;">${heading}</h1>
                ${body}
                ${note}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">Mensagem automática do ${BRAND_NAME}. Por favor, não responda a este e-mail.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Versão texto puro equivalente ao HTML (fallback). */
export function renderEmailText(input: EmailTemplateInput): string {
  const parts = [input.heading, "", ...input.paragraphs];
  if (input.note) {
    parts.push("", input.note);
  }
  parts.push("", `— ${BRAND_NAME} (mensagem automática, não responda)`);
  return parts.join("\n");
}
