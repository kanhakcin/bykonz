import type { ObraRecord } from "../types";

/**
 * Seleção de obra no início da conversa: toda ação do menu acontece dentro
 * da obra escolhida. Step custom persistido em stepKey (a coluna step usa o
 * enum SELECT_EMPRESA).
 */
export const OBRA_FLOW_STEPS = {
  selectObra: "SELECT_OBRA"
} as const;

export function isObraFlowStepKey(value: string | null | undefined): value is "SELECT_OBRA" {
  return value === OBRA_FLOW_STEPS.selectObra;
}

/** Comando disponível a qualquer momento para trocar de obra sem perder o cadastro do usuário. */
export const TROCAR_OBRA_COMMANDS = new Set(["trocar obra", "trocar de obra"]);

export function isTrocarObraCommand(text: string): boolean {
  return TROCAR_OBRA_COMMANDS.has(text.trim().toLowerCase());
}

export function obraMenuText(obras: ObraRecord[]): string {
  const options = obras.map((obra, index) => `${index + 1}) ${obra.nome}`).join("\n");
  return `🏗️ Em qual obra voce vai trabalhar hoje?\n${options}\n\nDigite o numero da obra.`;
}

export function noObrasText(): string {
  return "Nenhuma obra ativa cadastrada. Cadastre a obra no painel do gestor e tente novamente.";
}

/** Primeira linha de toda mensagem do bot: lembra o usuario onde ele esta. */
export function withObraHeader(obraNome: string, message: string): string {
  return `🏗️ Obra: ${obraNome}\n\n${message}`;
}

export function obraSelecionadaText(obraNome: string): string {
  return `✅ Voce esta na obra: ${obraNome}\n\nPara trocar de obra a qualquer momento, digite "trocar obra".`;
}
