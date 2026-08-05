import OpenAI from "openai";
import { loadConfig } from "../config/env";

/**
 * Categorias padrão de evidências técnicas (Relatórios Técnicos Bykonz).
 * A IA usa esta lista fechada para classificar cada evidência automaticamente.
 */
export const EVIDENCE_CATEGORIES = [
  "Painel Elétrico",
  "Sistema DP",
  "Supervisório",
  "Rack",
  "Encoder",
  "Switch",
  "IPC",
  "Câmera IA",
  "Rede",
  "NMEA",
  "Modbus",
  "CLP",
  "Antena",
  "Equipamentos",
  "Testes",
  "Pendências"
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export interface VisionAnalysisResult {
  category: EvidenceCategory;
  confidence: number;
  aiDescription: string;
  aiTags: string[];
  equipmentIdentified: string[];
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  ocrText: string | null;
  hasAnomaly: boolean;
  anomalies: string[];
  suggestedPendingIssues: Array<{ system: string; description: string }>;
}

export interface EvidenceAnalysisInput {
  imageBase64?: string;
  contentType?: string;
  filename?: string;
  observation?: string;
  existingOcrText?: string;
}

export interface ReportGenerationInput {
  reportCode: string;
  clientName?: string | null;
  vesselName?: string | null;
  serviceType?: string | null;
  attendanceType?: string | null;
  siteLocation?: string | null;
  mobilizationDate?: Date | null;
  technicianName?: string | null;
  objective?: string | null;
  vessel?: {
    name?: string | null;
    imo?: string | null;
    mmsi?: string | null;
    vesselType?: string | null;
    port?: string | null;
    location?: string | null;
  } | null;
  evidences: Array<{
    category: string;
    observation?: string | null;
    aiDescription?: string | null;
    ocrText?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    equipmentIdentified?: string[];
  }>;
  equipment: Array<{
    name: string;
    manufacturer?: string | null;
    model?: string | null;
    notes?: string | null;
  }>;
  pendingIssues: Array<{
    system: string;
    description: string;
    responsible?: string | null;
    status?: string | null;
  }>;
  memorySummary?: string | null;
}

export interface ReportGenerationResult {
  content: string;
  summary: string;
  conclusion: string;
}

/**
 * Motor de IA dos Relatórios Técnicos.
 *
 * Abstrai a integração com a OpenAI (Vision + Chat + Embeddings). Quando a chave
 * OPENAI_API_KEY não está configurada, cai em um modo determinístico local
 * (keyword-based) para que o fluxo continue funcionando em desenvolvimento/staging.
 */
export class AiEngineService {
  private readonly client: OpenAI | null;
  private readonly model: string;
  private readonly visionModel: string;
  private readonly embeddingModel: string;

  constructor(config = loadConfig()) {
    this.client = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;
    this.model = config.openaiModel ?? "gpt-4o-mini";
    this.visionModel = config.openaiVisionModel ?? "gpt-4o-mini";
    this.embeddingModel = config.openaiEmbeddingModel ?? "text-embedding-3-small";
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Analisa uma evidência (foto) e extrai dados técnicos + descrição + pendências.
   */
  async analyzeEvidence(input: EvidenceAnalysisInput): Promise<VisionAnalysisResult> {
    if (!this.client || !input.imageBase64) {
      return this.analyzeLocally(input);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: "system",
            content: buildVisionSystemPrompt()
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: buildVisionUserPrompt(input)
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.contentType ?? "image/jpeg"};base64,${input.imageBase64}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1200
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) {
        return this.analyzeLocally(input);
      }
      return this.parseVisionJson(raw);
    } catch {
      return this.analyzeLocally(input);
    }
  }

  /**
   * Gera o conteúdo completo do relatório técnico (estrutura Bykonz) usando LLM.
   */
  async generateReport(input: ReportGenerationInput): Promise<ReportGenerationResult> {
    if (!this.client) {
      return this.generateReportLocally(input);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: buildReportSystemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify(buildReportUserPayload(input))
          }
        ],
        temperature: 0.4,
        max_tokens: 4000
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) {
        return this.generateReportLocally(input);
      }
      return this.parseReportOutput(raw, input);
    } catch {
      return this.generateReportLocally(input);
    }
  }

  /**
   * Gera o embedding do conteúdo técnico de uma embarcação para a memória semântica.
   */
  async createEmbedding(text: string): Promise<number[] | null> {
    if (!this.client) {
      return null;
    }
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text.slice(0, 8000)
      });
      return response.data[0]?.embedding ?? null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback local (determinístico) — usado quando não há OPENAI_API_KEY
  // ---------------------------------------------------------------------------

  private analyzeLocally(input: EvidenceAnalysisInput): VisionAnalysisResult {
    const text = [input.filename, input.observation, input.existingOcrText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const category = inferCategory(text);
    const tags = inferTags(text);
    const equipment = inferEquipment(text);
    const anomalies = inferAnomalies(text);
    const description = buildLocalDescription(category, equipment, anomalies, input.observation);

    return {
      category,
      confidence: 0.7,
      aiDescription: description,
      aiTags: tags,
      equipmentIdentified: equipment,
      manufacturer: extractManufacturer(text),
      model: extractModel(text),
      serialNumber: extractSerialNumber(text),
      ocrText: input.existingOcrText ?? null,
      hasAnomaly: anomalies.length > 0,
      anomalies,
      suggestedPendingIssues: anomalies.map((a) => ({
        system: category,
        description: a
      }))
    };
  }

  private generateReportLocally(input: ReportGenerationInput): ReportGenerationResult {
    const content = buildLocalReportContent(input);
    const summary = buildLocalSummary(input);
    const conclusion = buildLocalConclusion(input);
    return { content, summary, conclusion };
  }

  private parseVisionJson(raw: string): VisionAnalysisResult {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const category = normalizeCategory(String(parsed.category ?? "Testes"));
      const anomalies = Array.isArray(parsed.anomalies)
        ? (parsed.anomalies as unknown[]).map(String)
        : [];
      const pendingRaw = Array.isArray(parsed.suggestedPendingIssues)
        ? (parsed.suggestedPendingIssues as Array<Record<string, unknown>>)
        : [];

      return {
        category,
        confidence: clamp01(Number(parsed.confidence ?? 0.8)),
        aiDescription: String(parsed.aiDescription ?? "").trim(),
        aiTags: asStringArray(parsed.aiTags),
        equipmentIdentified: asStringArray(parsed.equipmentIdentified),
        manufacturer: nullableString(parsed.manufacturer),
        model: nullableString(parsed.model),
        serialNumber: nullableString(parsed.serialNumber),
        ocrText: nullableString(parsed.ocrText),
        hasAnomaly: anomalies.length > 0,
        anomalies,
        suggestedPendingIssues: pendingRaw.map((item) => ({
          system: String(item.system ?? category),
          description: String(item.description ?? "")
        }))
      };
    } catch {
      // Se o JSON não foi parseado, retorna análise local com base em texto vazio.
      return this.analyzeLocally({});
    }
  }

  private parseReportOutput(raw: string, input: ReportGenerationInput): ReportGenerationResult {
    // Se o modelo devolveu JSON estruturado, usa; caso contrário usa o texto direto.
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const content = String(parsed.content ?? raw);
      return {
        content,
        summary: String(parsed.summary ?? buildLocalSummary(input)),
        conclusion: String(parsed.conclusion ?? buildLocalConclusion(input))
      };
    } catch {
      return {
        content: raw,
        summary: buildLocalSummary(input),
        conclusion: buildLocalConclusion(input)
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers de prompt
// ---------------------------------------------------------------------------

function buildVisionSystemPrompt(): string {
  return [
    "Você é um analista técnico naval especializado em sistemas eletrônicos embarcados.",
    "Analise a imagem fornecida e responda APENAS com JSON válido no formato:",
    JSON.stringify(
      {
        category: "uma das categorias fechadas",
        confidence: 0.0,
        aiDescription: "descrição técnica profissional em português",
        aiTags: ["tag1", "tag2"],
        equipmentIdentified: ["equipamento"],
        manufacturer: "fabricante ou null",
        model: "modelo ou null",
        serialNumber: "número de série ou null",
        ocrText: "texto visível lido da imagem (etiquetas, alarmes, telas)",
        anomalies: ["anomalias observadas ou []"],
        suggestedPendingIssues: [{ system: "sistema", description: "pendência" }]
      },
      null,
      2
    ),
    `Use APENAS estas categorias: ${EVIDENCE_CATEGORIES.join(", ")}.`,
    "Identifique: equipamento, fabricante, modelo, etiquetas, telas de supervisório, alarmes, LEDs ligados/desligados, cabos, conexões, estado visual, ambiente.",
    "Escreva a descrição em português técnico e profissional, sem jargões."
  ].join("\n");
}

function buildVisionUserPrompt(input: EvidenceAnalysisInput): string {
  const parts: string[] = [];
  if (input.filename) parts.push(`Arquivo: ${input.filename}`);
  if (input.observation) parts.push(`Observação do técnico: ${input.observation}`);
  if (input.existingOcrText) parts.push(`OCR já extraído: ${input.existingOcrText}`);
  parts.push("Analise a imagem e retorne o JSON conforme o formato solicitado.");
  return parts.join("\n");
}

function buildReportSystemPrompt(): string {
  return [
    "Você é um redator técnico sênior da Bykonz, especializado em relatórios de atendimento naval.",
    "Gere um relatório técnico profissional e padronizado a partir dos dados fornecidos.",
    "Responda APENAS com JSON válido com campos: content, summary, conclusion.",
    "Estrutura obrigatória do content (use marcação com títulos ##):",
    "Capa, Dados Gerais, Objetivo, Dados da Embarcação, Atividades Realizadas, Sistemas Inspecionados, Equipamentos Instalados, Testes Executados, Pendências, Diagnóstico Técnico, Materiais Utilizados, Inventário, Registro Fotográfico, Conclusão Técnica, Assinaturas.",
    "Use linguagem técnica e profissional. Pendências recorrentes e memória da embarcação devem ser consideradas."
  ].join("\n");
}

function buildReportUserPayload(input: ReportGenerationInput): unknown {
  return {
    reportCode: input.reportCode,
    clientName: input.clientName,
    vesselName: input.vesselName,
    serviceType: input.serviceType,
    attendanceType: input.attendanceType,
    siteLocation: input.siteLocation,
    mobilizationDate: input.mobilizationDate?.toISOString().slice(0, 10),
    technicianName: input.technicianName,
    objective: input.objective,
    vessel: input.vessel,
    evidences: input.evidences,
    equipment: input.equipment,
    pendingIssues: input.pendingIssues,
    memorySummary: input.memorySummary
  };
}

// ---------------------------------------------------------------------------
// Fallback local — construção determinística do relatório
// ---------------------------------------------------------------------------

function buildLocalReportContent(input: ReportGenerationInput): string {
  const categories = Array.from(new Set(input.evidences.map((e) => e.category).filter(Boolean)));
  const equipment = input.equipment
    .map((e) => `- ${e.name}${e.manufacturer ? ` (${e.manufacturer})` : ""}${e.model ? ` - ${e.model}` : ""}`)
    .join("\n") || "Nenhum equipamento cadastrado.";
  const pending = input.pendingIssues
    .map((p) => `- ${p.system}: ${p.description}${p.responsible ? ` (Responsável: ${p.responsible})` : ""}`)
    .join("\n") || "Nenhuma pendência registrada.";
  const evidence = input.evidences
    .map((e) => `- ${e.category}: ${e.aiDescription ?? e.observation ?? "Evidência registrada."}`)
    .join("\n") || "Nenhuma evidência registrada.";
  const memory = input.memorySummary ? `\nContexto de histórico: ${input.memorySummary}` : "";

  return [
    `# Relatório Técnico ${input.reportCode}`,
    "",
    "## Capa",
    "Relatório gerado automaticamente pelo sistema inteligente de relatórios da Bykonz a partir das evidências registradas na mobilização.",
    "",
    "## Dados Gerais",
    `Cliente: ${input.clientName ?? "Não informado"}`,
    `Embarcação: ${input.vesselName ?? "Não informada"}`,
    `Tipo de atendimento: ${input.attendanceType ?? input.serviceType ?? "Não informado"}`,
    `Local: ${input.siteLocation ?? "Não informado"}`,
    `Data: ${input.mobilizationDate ? input.mobilizationDate.toISOString().slice(0, 10) : "Não informada"}`,
    `Técnico responsável: ${input.technicianName ?? "Não informado"}`,
    "",
    "## Objetivo",
    input.objective?.trim() || "Registrar evidências técnicas e consolidar o atendimento em documento padronizado.",
    "",
    "## Dados da Embarcação",
    `Nome: ${input.vessel?.name ?? input.vesselName ?? "Não informado"}`,
    `IMO: ${input.vessel?.imo ?? "Não informado"}`,
    `MMSI: ${input.vessel?.mmsi ?? "Não informado"}`,
    `Tipo: ${input.vessel?.vesselType ?? "Não informado"}`,
    `Porto/Localização: ${input.vessel?.port ?? input.vessel?.location ?? "Não informado"}`,
    "",
    "## Atividades Realizadas",
    `Mobilização de ${(input.attendanceType ?? input.serviceType ?? "atendimento técnico").toLowerCase()} com registro e análise das evidências coletadas no local.${memory}`,
    "",
    "## Sistemas Inspecionados",
    categories.length > 0 ? categories.join(", ") : "Nenhum sistema identificado.",
    "",
    "## Equipamentos Instalados",
    equipment,
    "",
    "## Testes Executados",
    "Inspeção visual e análise técnica das evidências registradas, com validação das condições observadas.",
    "",
    "## Pendências",
    pending,
    "",
    "## Diagnóstico Técnico",
    "O diagnóstico foi elaborado a partir da análise das evidências, considerando o estado dos sistemas e equipamentos inspecionados.",
    "",
    "## Materiais Utilizados",
    "Materiais e componentes registrados a partir das evidências e observações do atendimento.",
    "",
    "## Inventário",
    `Total de evidências: ${input.evidences.length}`,
    `Total de equipamentos: ${input.equipment.length}`,
    "",
    "## Registro Fotográfico",
    evidence,
    "",
    "## Conclusão Técnica",
    "O relatório foi estruturado automaticamente para servir como base documental do atendimento executado.",
    "",
    "## Assinaturas",
    "Técnico responsável / Cliente / Responsável técnico"
  ].join("\n");
}

function buildLocalSummary(input: ReportGenerationInput): string {
  const service = (input.attendanceType ?? input.serviceType ?? "atendimento técnico").toLowerCase();
  return `Mobilização de ${service} com foco em ${(input.objective ?? "registro de evidências").toLowerCase()}. O relatório foi organizado a partir da análise das evidências registradas.`;
}

function buildLocalConclusion(input: ReportGenerationInput): string {
  const technician = input.technicianName ?? "técnico responsável";
  const location = input.siteLocation ?? "local de atendimento";
  const vessel = input.vesselName ?? "embarcação";
  const pendingCount = input.pendingIssues.length;
  const pendingText =
    pendingCount > 0
      ? `Há ${pendingCount} pendência(s) em aberto para acompanhamento.`
      : "Não foram registradas pendências no momento.";
  return `${technician} concluiu a avaliação em ${location} para ${vessel}. ${pendingText} O relatório foi montado para servir como base documental do serviço executado.`;
}

// ---------------------------------------------------------------------------
// Helpers de inferência local
// ---------------------------------------------------------------------------

function inferCategory(text: string): EvidenceCategory {
  if (/(rack|switch|router|rede|network|ip\b|ethernet)/.test(text)) return "Switch";
  if (/(camera|câmera|cam\b|surveillance)/.test(text)) return "Câmera IA";
  if (/(supervisorio|supervisory|scada|hmi)/.test(text)) return "Supervisório";
  if (/(clp|plc|modbus)/.test(text)) return "CLP";
  if (/(ipc|industrial pc|iot2050|computador industrial)/.test(text)) return "IPC";
  if (/(painel|panel|quadro)/.test(text)) return "Painel Elétrico";
  if (/(nmea|gps|antenna|antena)/.test(text)) return "Antena";
  if (/(dp|position|dynamic positioning)/.test(text)) return "Sistema DP";
  if (/(encoder|rotativo)/.test(text)) return "Encoder";
  if (/(pendencia|pendência|falt|problema|anomalia)/.test(text)) return "Pendências";
  if (/(test|teste|valida)/.test(text)) return "Testes";
  return "Equipamentos";
}

function inferTags(text: string): string[] {
  const tags = new Set<string>();
  if (/(switch|router|rede|network|ethernet)/.test(text)) tags.add("switch");
  if (/(rack|panel)/.test(text)) tags.add("rack");
  const keywordMap: Record<string, RegExp> = {
    camera: /(camera|câmera|cam)/,
    ipc: /(ipc|iot2050|computador industrial)/,
    clp: /(clp|plc)/,
    antenna: /(antena|antenna)/,
    scada: /(supervisorio|scada|hmi)/
  };
  for (const [tag, re] of Object.entries(keywordMap)) {
    if (re.test(text)) tags.add(tag);
  }
  return Array.from(tags);
}

function inferEquipment(text: string): string[] {
  const results: string[] = [];
  if (/(switch|moxa|cisco|router)/.test(text)) results.push("Switch de rede");
  if (/(iot2050|ipc|simens)/.test(text)) results.push("IPC Siemens IoT2050");
  if (/(camera|câmera)/.test(text)) results.push("Câmera de vigilância");
  if (/(clp|plc)/.test(text)) results.push("Controlador lógico programável (CLP)");
  if (/(rack)/.test(text)) results.push("Rack de telecomunicações");
  return results;
}

function inferAnomalies(text: string): string[] {
  const anomalies: string[] = [];
  if (/(sem sinal|sem imagem|falha|anomalia|defeito|vazio|led apagado|não funciona)/.test(text)) {
    anomalies.push("Possível falha ou anomalia identificada na evidência.");
  }
  if (/(hdmi|splitter)/.test(text)) {
    anomalies.push("Necessária validação do splitter/HDMI.");
  }
  return anomalies;
}

function buildLocalDescription(
  category: EvidenceCategory,
  equipment: string[],
  anomalies: string[],
  observation?: string
): string {
  const equipmentText = equipment.length > 0 ? equipment.join(", ") : "equipamento técnico";
  const anomalyText = anomalies.length > 0
    ? " Foram observadas possíveis anomalias que requerem atenção."
    : " Não foram observadas anomalias visuais durante a inspeção.";
  const obs = observation ? ` ${observation.trim()}` : "";
  return `Foi identificado(a) ${equipmentText} na categoria ${category}.${anomalyText}${obs}`;
}

function extractManufacturer(text: string): string | null {
  const match = text.match(/\b(siemens|moxa|cisco|allen-bradley|schneider|rockwell|wago|advantech)\b/i);
  return match ? match[1] : null;
}

function extractModel(text: string): string | null {
  const match = text.match(/\b([a-z0-9-]{3,})-\d{2,}[a-z0-9-]*\b/i);
  return match ? match[0] : null;
}

function extractSerialNumber(text: string): string | null {
  const match = text.match(/\bs\s*n\s*:?\s*([a-z0-9-]{6,})/i) ?? text.match(/\b(?:sn|serial|nº serie)[:\s]+([a-z0-9-]{6,})/i);
  return match ? match[1] : null;
}

function normalizeCategory(value: string): EvidenceCategory {
  return (EVIDENCE_CATEGORIES as readonly string[]).includes(value) ? (value as EvidenceCategory) : "Equipamentos";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}
