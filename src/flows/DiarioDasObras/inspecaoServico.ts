import type { EntryTipo } from "./types";

// Inspecao de servico não tem consulta própria no menu de ação: o relatório
// consolidado sai pelo "Gerar diario de obra" (menu 7).
export function usesIncludeOnlyActionMenu(tipo: EntryTipo): boolean {
  return tipo === "Inspecao de servico";
}
