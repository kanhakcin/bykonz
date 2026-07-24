import { DIARIO_OBRA_REPORT_LABEL, DIARIO_OBRA_REPORT_OPTION } from "./gerarDiarioObra";
import { usesIncludeOnlyActionMenu } from "./inspecaoServico";
import { ENTRY_TIPOS, type EntryTipo } from "./types";

export const MAIN_MENU_OPTIONS = [
  ...ENTRY_TIPOS.map((tipo, index) => ({ option: `${index + 1}`, label: tipo })),
  { option: DIARIO_OBRA_REPORT_OPTION, label: DIARIO_OBRA_REPORT_LABEL }
] as const;

export const TIPO_OPTIONS: Record<string, EntryTipo> = {
  "1": "Inspecao de servico",
  "2": "Abrir nao conformidade",
  "3": "Recebimento de material",
  "4": "Plano de manutencao",
  "5": "Programa sol",
  "6": "Treinamento"
};

export const ACTION_OPTIONS = {
  consulta: "1",
  incluir: "2"
};

export const INCLUDE_ONLY_ACTION_OPTIONS = {
  incluir: "1"
};

export const POST_SAVE_OPTIONS = {
  novoRegistro: "1",
  voltarMenu: "2"
};

const MAIN_MENU_OPTION_EMOJI: Record<string, string> = {
  "Inspecao de servico": "🔧",
  "Abrir nao conformidade": "⚠️",
  "Recebimento de material": "📦",
  "Plano de manutencao": "🛠️",
  "Programa sol": "☀️",
  Treinamento: "🎓",
  [DIARIO_OBRA_REPORT_LABEL]: "📄"
};

export function isEntryTipo(value: string | null | undefined): value is EntryTipo {
  return typeof value === "string" && (ENTRY_TIPOS as readonly string[]).includes(value);
}

export function mainMenuText(): string {
  const options = MAIN_MENU_OPTIONS.map((option) => `${MAIN_MENU_OPTION_EMOJI[option.label]} ${option.option}) ${option.label}`).join("\n");
  return `👋 O que voce quer fazer agora?\n\n${options}\n\nDigite o numero da opcao.`;
}

export function actionMenuText(tipo: EntryTipo): string {
  const emoji = MAIN_MENU_OPTION_EMOJI[tipo] ?? "🔧";
  if (usesIncludeOnlyActionMenu(tipo)) {
    return `${emoji} ${tipo}\n\n1) Incluir novo registro\n0) Voltar ao menu`;
  }

  return `${emoji} ${tipo}\n\n1) Consultar registros\n2) Incluir novo registro\n0) Voltar ao menu`;
}

export function postSaveMenuText(): string {
  return "✅ Registro salvo! Já tá no diario da obra.\n\n1) Incluir outro registro\n2) Voltar ao menu";
}

/**
 * Menu pós-registro da inspeção de serviço: permite continuar mandando fotos da
 * MESMA norma em sequência (o engenheiro na laje tira várias fotos), sem
 * reescolher a norma a cada uma. A próxima foto entra direto; o menu numérico
 * cobre trocar de norma ou sair.
 */
export function postSaveInspecaoMenuText(norma: string): string {
  return (
    "✅ Registro salvo! Já tá no diario da obra.\n" +
    `📸 Norma atual: ${norma}\n\n` +
    "Envie mais uma FOTO pra registrar na mesma norma, ou digite:\n" +
    "1) Trocar de norma\n" +
    "2) Voltar ao menu"
  );
}
