import type { EmpresaRecord, NormaRecord } from "../types";
import type { EntryTipo } from "./types";

/** Rótulo da opção "sem norma" no menu de inspeção de serviço. */
export const SEM_NORMA_LABEL = "Outros";

/**
 * Menu de inspeção de serviço: lista as normas (Standards) do setor da obra,
 * cada uma numerada a partir de 1. Cada norma já implica o tipo de serviço
 * (título) e o número do procedimento (código). A última opção — logo após as
 * normas — é "Outros", que registra a foto sem vincular nenhuma norma (para o
 * que não precisa de procedimento). Não usamos 0 porque ele é o comando global
 * de voltar ao menu.
 */
export function normaMenuText(tipo: EntryTipo, normas: NormaRecord[]): string {
  const linhas = normas.map((norma, index) => `${index + 1}) ${norma.code} - ${norma.title}`);
  linhas.push(`${normas.length + 1}) ${SEM_NORMA_LABEL}`);
  return `🔧 ${tipo}\nQual a norma do serviço?\n\n${linhas.join("\n")}\n\nDigite o numero.`;
}

/**
 * Rótulo da norma para exibição (ex: "PS-008 - Execução de alvenaria"),
 * ou "Outros" quando o registro é sem norma. `tipoServico` guarda o título e
 * `numeroProcedimento` o código.
 */
export function normaLabel(tipoServico: string | null, numeroProcedimento: string | null): string {
  if (numeroProcedimento && tipoServico) {
    return `${numeroProcedimento} - ${tipoServico}`;
  }
  return tipoServico?.trim() || SEM_NORMA_LABEL;
}

export function photoPromptText(tipo: EntryTipo, empresa: EmpresaRecord, norma: NormaRecord | null): string {
  const empresaNome = empresa.nome ?? `Empresa ${empresa.id.toString()}`;
  const normaLinha = norma ? `Norma: ${norma.code} - ${norma.title}` : `Norma: ${SEM_NORMA_LABEL}`;
  return (
    `🔧 ${tipo} - ${empresaNome}\n${normaLinha}\n\n` +
    "📸 Agora envie uma foto pra continuar e descreva o serviço.\n" +
    "Pode enviar várias fotos desta mesma norma, uma após a outra."
  );
}

/**
 * Legenda da cópia enviada ao grupo de WhatsApp da obra. Layout:
 *   Descrição
 *   Norma (código - título, ou "Outros" quando sem norma)
 *   Usuário - Obra
 */
export function grupoCaptionText(input: {
  description: string | null;
  tipoServico: string | null;
  numeroProcedimento: string | null;
  usuarioNome: string | null;
  obraNome: string;
}): string {
  const usuario = input.usuarioNome?.trim() || "Operador";

  const linhas: string[] = [];
  if (input.description?.trim()) {
    linhas.push(input.description.trim());
  }
  linhas.push(normaLabel(input.tipoServico, input.numeroProcedimento));
  linhas.push(`${usuario} - ${input.obraNome}`);
  return linhas.join("\n");
}
