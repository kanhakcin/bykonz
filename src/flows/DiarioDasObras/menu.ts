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

export function isEntryTipo(value: string | null | undefined): value is EntryTipo {
  return typeof value === "string" && (ENTRY_TIPOS as readonly string[]).includes(value);
}

export function mainMenuText(): string {
  const options = MAIN_MENU_OPTIONS.map((option) => `${option.option}) ${option.label}`).join("\n");
  return `O que voce quer acessar?\n${options}\n\nDigite 0 para voltar ao menu.`;
}

export function actionMenuText(tipo: EntryTipo): string {
  if (usesIncludeOnlyActionMenu(tipo)) {
    return `${tipo}\n1) Incluir\n\nDigite 0 para voltar ao menu.`;
  }

  return `${tipo}\n1) Consulta\n2) Incluir\n\nDigite 0 para voltar ao menu.`;
}
