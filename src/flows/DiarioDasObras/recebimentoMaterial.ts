import type { EntryTipo } from "./types";

export const MATERIAL_TIPO: EntryTipo = "Recebimento de material";

export const MATERIAL_FLOW_STEPS = {
  awaitingOs: "AWAITING_MATERIAL_OS",
  awaitingNotaPhoto: "AWAITING_MATERIAL_NOTA_PHOTO",
  awaitingMaterialPhoto: "AWAITING_MATERIAL_PHOTO",
  awaitingQuantity: "AWAITING_MATERIAL_QUANTITY",
  awaitingQuality: "AWAITING_MATERIAL_QUALITY"
} as const;

export type MaterialFlowStepKey = (typeof MATERIAL_FLOW_STEPS)[keyof typeof MATERIAL_FLOW_STEPS];

export const MATERIAL_MEDIA_TYPES = {
  nota: "material_nota",
  material: "material_foto"
} as const;

export const MATERIAL_FLOW_DATA_KEYS = {
  quantidadeCorreta: "materialQuantidadeCorreta",
  qualidadeCorreta: "materialQualidadeCorreta"
} as const;

export type MaterialAnswer = "Sim" | "Não";

export function isMaterialFlowStepKey(value: string | null | undefined): value is MaterialFlowStepKey {
  return typeof value === "string" && (Object.values(MATERIAL_FLOW_STEPS) as string[]).includes(value);
}

export function materialOsPromptText(): string {
  return "Informe o número da OS.";
}

export function materialNotaPhotoPromptText(): string {
  return "Envie a foto da nota.";
}

export function materialPhotoPromptText(): string {
  return "Foto da nota recebida. Agora envie a foto do material.";
}

export function materialQuantityPromptText(): string {
  return "A quantidade está correta?\n1) Sim\n2) Não";
}

export function materialQualityPromptText(): string {
  return "A qualidade está correta?\n1) Sim\n2) Não";
}

export function parseMaterialAnswer(text: string): MaterialAnswer | null {
  const value = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (value === "1" || value === "sim" || value === "s") {
    return "Sim";
  }

  if (value === "2" || value === "nao" || value === "n") {
    return "Não";
  }

  return null;
}
