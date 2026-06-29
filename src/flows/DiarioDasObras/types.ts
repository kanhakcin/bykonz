export const DIARIO_DAS_OBRAS_FLOW_KEY = "diario-das-obras";

export const ENTRY_TIPOS = [
  "Inspecao de servico",
  "Abrir nao conformidade",
  "Recebimento de material",
  "Plano de manutencao",
  "Programa sol",
  "Treinamento"
] as const;

export type EntryTipo = (typeof ENTRY_TIPOS)[number];

