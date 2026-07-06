import { DIARIO_OBRA_REPORT_TIPO } from "./gerarDiarioObra";
import type { EntryTipo } from "./types";

export function usesIncludeOnlyActionMenu(tipo: EntryTipo): boolean {
  return tipo === DIARIO_OBRA_REPORT_TIPO;
}
