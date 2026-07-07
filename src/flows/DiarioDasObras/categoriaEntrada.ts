import type { EmpresaRecord } from "../types";
import type { EntryTipo } from "./types";

export const TIPO_SERVICOS = [
  "Alvenaria",
  "Hidráulica",
  "Elétrica",
  "Organização e Limpeza",
  "Segurança",
  "Concretagem",
  "Outros"
] as const;

export type TipoServico = (typeof TIPO_SERVICOS)[number];

export const TIPO_SERVICO_OPTIONS: Record<string, TipoServico> = {
  "1": "Alvenaria",
  "2": "Hidráulica",
  "3": "Elétrica",
  "4": "Organização e Limpeza",
  "5": "Segurança",
  "6": "Concretagem",
  "7": "Outros"
};

export function isTipoServico(value: string | null | undefined): value is TipoServico {
  return typeof value === "string" && (TIPO_SERVICOS as readonly string[]).includes(value);
}

export function tipoServicoMenuText(tipo: EntryTipo): string {
  const options = TIPO_SERVICOS.map((tipoServico, index) => `${index + 1}) ${tipoServico}`).join("\n");
  return `🔧 ${tipo}\nQual o tipo de serviço?\n\n${options}\n\nDigite o numero.`;
}

export function numeroProcedimentoPromptText(): string {
  return "📝 Qual o número do procedimento utilizado?\nEx: PS-031";
}

export function photoPromptText(
  tipo: EntryTipo,
  empresa: EmpresaRecord,
  tipoServico: TipoServico,
  numeroProcedimento: string
): string {
  const empresaNome = empresa.nome ?? `Empresa ${empresa.id.toString()}`;
  return `🔧 ${tipo} - ${empresaNome}\nServiço: ${tipoServico}\nProcedimento: ${numeroProcedimento}\n\n📸 Agora envie uma foto pra continuar.`;
}

