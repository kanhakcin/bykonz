export interface EvidenceAnalysisResult {
  category: string;
  confidence: number;
  aiTags: string[];
  aiSummary: string;
  suggestedActions: string[];
  suggestedEquipment: string[];
}

export interface EvidenceAnalysisInput {
  filename?: string;
  contentType?: string;
  observation?: string;
  ocrText?: string;
}

export function analyzeEvidenceContent(input: EvidenceAnalysisInput): EvidenceAnalysisResult {
  const text = [input.filename, input.observation, input.ocrText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const inferredCategory = inferCategory(text);
  const tags = inferTags(text);
  const summary = buildSummary(inferredCategory, tags, input.ocrText);
  const suggestedActions = inferSuggestedActions(inferredCategory, text);
  const suggestedEquipment = inferSuggestedEquipment(tags);

  return {
    category: inferredCategory,
    confidence: 0.76,
    aiTags: tags,
    aiSummary: summary,
    suggestedActions,
    suggestedEquipment
  };
}

function inferCategory(text: string): string {
  if (/(rack|switch|router|rede|network|ip)/.test(text)) return "Rede";
  if (/(camera|câmera|cam)/.test(text)) return "Câmeras";
  if (/(rov|submers|mergulho)/.test(text)) return "ROV";
  if (/(nmea|modbus|telemetria|can|serial)/.test(text)) return "Telemetria";
  if (/(panel|clp|ipc|encoder)/.test(text)) return "Equipamentos Instalados";
  return "Testes";
}

function inferTags(text: string): string[] {
  const tags = new Set<string>();
  if (/(switch|router|network|rede|ip)/.test(text)) tags.add("switch");
  if (/(rack|panel)/.test(text)) tags.add("rack");
  if (/(camera|câmera)/.test(text)) tags.add("camera");
  if (/(rov|mergulho)/.test(text)) tags.add("rov");
  if (/(nmea|modbus|telemetria)/.test(text)) tags.add("telemetria");
  if (/(ipc|clp|encoder)/.test(text)) tags.add("automacao");
  return Array.from(tags);
}

function buildSummary(category: string, tags: string[], ocrText?: string): string {
  const details = ocrText ? ` OCR detectado: ${ocrText.slice(0, 120)}` : "";
  return `${category} identificado automaticamente com base na imagem e no contexto técnico.${details}`;
}

function inferSuggestedActions(category: string, text: string): string[] {
  const actions = ["Registrar detalhes técnicos da evidência", "Validar o estado operacional do equipamento"];
  if (category === "Rede") actions.push("Executar teste de conectividade e IP");
  if (category === "Câmeras") actions.push("Validar imagem e alinhamento da câmera");
  if (category === "ROV") actions.push("Confirmar funcionamento do sistema de mergulho");
  return actions;
}

function inferSuggestedEquipment(tags: string[]): string[] {
  const equipment: string[] = [];
  if (tags.includes("switch")) equipment.push("Switch de rede");
  if (tags.includes("rack")) equipment.push("Rack principal");
  if (tags.includes("camera")) equipment.push("Câmera de vigilância");
  if (tags.includes("rov")) equipment.push("ROV");
  if (tags.includes("automacao")) equipment.push("Controlador/CLP");
  return equipment;
}
