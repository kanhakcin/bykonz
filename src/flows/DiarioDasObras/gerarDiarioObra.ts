export const DIARIO_OBRA_REPORT_OPTION = "7";
export const DIARIO_OBRA_REPORT_LABEL = "Gerar diario de obra";

/**
 * Sub-fluxo do "Gerar diario de obra" (menu 7): pergunta só a data e gera o
 * mesmo PDF do painel (/relatorios) via DailyReportGenerator — sem seleção de
 * empresa, pois o diário cobre todos os registros da obra no dia.
 * Reusa o step persistido AWAITING_REPORT_DATE com stepKey próprio (mesmo
 * padrão dos sub-fluxos de material e obra).
 */
export const DIARIO_OBRA_FLOW_STEPS = {
  awaitingDate: "AWAITING_DIARIO_OBRA_DATE"
} as const;

type DiarioObraFlowStepKey = (typeof DIARIO_OBRA_FLOW_STEPS)[keyof typeof DIARIO_OBRA_FLOW_STEPS];

export function isDiarioObraFlowStepKey(value: string | null | undefined): value is DiarioObraFlowStepKey {
  return typeof value === "string" && Object.values(DIARIO_OBRA_FLOW_STEPS).includes(value as DiarioObraFlowStepKey);
}

export function diarioObraDatePromptText(): string {
  return "📄 Qual data voce quer no diario? Formato: DD/MM/AAAA";
}

