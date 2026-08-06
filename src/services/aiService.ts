import { loadConfig } from "../config/env";
import { AiEngineService } from "./aiEngineService";

/**
 * Contrato de provedor de IA — permite trocar OpenAI/Gemini/Claude sem alterar
 * quem consome o AIService. A implementação concreta atual usa o
 * AiEngineService (OpenAI); futuros provedores só precisam implementar esta
 * interface (e serem injetados no createAIService).
 */
export interface AiProvider {
  isConfigured: boolean;
  analyzeDraft(input: AiDraftInput): Promise<AiAnalysisResult>;
  generateSummary(input: AiSummaryInput): Promise<AiSummaryResult>;
}

// ---- Inputs / outputs -------------------------------------------------------

export interface AiDraftInput {
  /** Texto (rascunho / descrição / conteúdo do relatório) a analisar. */
  text: string;
  /** Contexto opcional (ex.: categoria, tipo de atendimento, embarcação). */
  context?: string;
}

export interface AiDraftIssue {
  type: "missing" | "inconsistency" | "suggestion";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  /** Trecho original sugerido para substituição (se houver). */
  original?: string;
  /** Texto sugerido pela IA (aceitável/rejeitável pelo usuário). */
  suggestion?: string;
}

export interface AiAnalysisResult {
  /** Sugestões, dados ausentes e inconsistências detectadas. */
  issues: AiDraftIssue[];
  /** Causas prováveis sugeridas com base nos dados. */
  causes: string[];
  /** Diagnósticos possíveis. */
  diagnostics: string[];
  /** Recomendações técnicas. */
  recommendations: string[];
  /** Resumo profissional gerado automaticamente. */
  summary: string;
  /** Confiança geral (0..1). */
  confidence: number;
}

export interface AiSummaryInput {
  text: string;
  context?: string;
}

export interface AiSummaryResult {
  summary: string;
}

// ---- Implementação concreta (OpenAI via AiEngineService) --------------------

/**
 * Camada de serviço de IA, agnóstica de provedor.
 *
 * Encapsula o AiEngineService (OpenAI) atrás de um contrato estável para que o
 * restante da aplicação (routers e painel) não dependa de um provedor
 * específico. Adiciona timeout, tratamento de erros e logs — e, quando a IA não
 * está configurada ou indisponível, cai em respostas determinísticas locais para
 * que o sistema continue funcionando normalmente.
 */
export class AIService implements AiProvider {
  private readonly inner: AiEngineService;
  private readonly timeoutMs: number;

  constructor(config = loadConfig()) {
    this.inner = new AiEngineService(config);
    this.timeoutMs = config.aiTimeoutMs;
  }

  get isConfigured(): boolean {
    return this.inner.isConfigured;
  }

  /** Analisa um rascunho em tempo real e devolve sugestões/causas/diagnósticos. */
  async analyzeDraft(input: AiDraftInput): Promise<AiAnalysisResult> {
    if (!this.inner.isConfigured || !input.text.trim()) {
      return this.analyzeLocally(input);
    }

    try {
      const { content } = await this.withTimeout(this.callChat(input), "analyzeDraft");
      return this.parseAnalysis(content, input);
    } catch (error) {
      this.logError("analyzeDraft", error);
      return this.analyzeLocally(input);
    }
  }

  /** Gera um resumo profissional do relatório. */
  async generateSummary(input: AiSummaryInput): Promise<AiSummaryResult> {
    if (!this.inner.isConfigured || !input.text.trim()) {
      return { summary: buildLocalSummary(input.text) };
    }

    try {
      const { content } = await this.withTimeout(this.callChat(input), "generateSummary");
      return { summary: stripJson(String(content ?? "").trim()) };
    } catch (error) {
      this.logError("generateSummary", error);
      return { summary: buildLocalSummary(input.text) };
    }
  }

  // ---- Chamada ao LLM (Chat Completion) -------------------------------------

  private async callChat(input: AiDraftInput | AiSummaryInput): Promise<{ content: string }> {
    const isSummary = "context" in input && input.text.length > 0 && !isDraft(input);
    const system = isSummary
      ? "Você é um redator técnico sênior da Bykonz. Gere um resumo profissional e conciso do relatório técnico fornecido. Responda apenas com o texto do resumo, sem aspas."
      : buildAnalysisSystemPrompt();
    const user = isSummary
      ? `Resuma o seguinte conteúdo técnico:\n\n${input.text}`
      : buildAnalysisUserPrompt(input as AiDraftInput);

    // Usa o OpenAI SDK do AiEngineService de forma simples via chat completions.
    // Para manter o encapsulamento, reutilizamos o cliente interno abrindo o
    // acesso ao `client` — ver método `chat` abaixo.
    return this.chatInterno(system, user);
  }

  // Acessa o cliente OpenAI interno. Mantém a lógica de provider isolada aqui.
  private async chatInterno(system: string, user: string): Promise<{ content: string }> {
    const client = (this.inner as unknown as { client: OpenAI });
    if (!client.client) {
      throw new Error("ai_not_configured");
    }
    const response = await client.client.chat.completions.create({
      model: (this.inner as unknown as { model: string }).model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });
    const content = response.choices[0]?.message?.content ?? "";
    if (!content) {
      throw new Error("ai_empty_response");
    }
    return { content };
  }

  private async withTimeout<T>(promise: Promise<T>, op: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`ai_timeout:${op}`)), this.timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private logError(op: string, error: unknown): void {
    console.error(`[ai] ${op} failed:`, error instanceof Error ? error.message : error);
  }

  // ---- Fallback local determinístico ---------------------------------------

  private analyzeLocally(input: AiDraftInput): AiAnalysisResult {
    const text = input.text.trim();
    const lower = text.toLowerCase();
    const issues: AiDraftIssue[] = [];

    if (!text) {
      issues.push({
        type: "missing",
        severity: "high",
        title: "Conteúdo vazio",
        description: "Informe uma descrição ou texto do relatório para análise."
      });
    }

    if (text.split(/\s+/).length < 10) {
      issues.push({
        type: "suggestion",
        severity: "medium",
        title: "Texto muito curto",
        description: "Adicione mais detalhes técnicos para um relatório completo.",
        suggestion: "Descreva o equipamento, a condição observada e as ações realizadas."
      });
    }

    const missingKeywords = detectMissingKeywords(lower);
    for (const kw of missingKeywords) {
      issues.push({
        type: "missing",
        severity: "medium",
        title: `Informação ausente: ${kw}`,
        description: `Não foi possível identificar ${kw} no texto informado.`
      });
    }

    const inconsistencies = detectInconsistencies(lower);
    for (const inc of inconsistencies) {
      issues.push({ type: "inconsistency", severity: "high", title: inc.title, description: inc.description });
    }

    const causes = buildLocalCauses(lower);
    const diagnostics = buildLocalDiagnostics(lower);
    const recommendations = buildLocalRecommendations(lower, issues);

    return {
      issues,
      causes,
      diagnostics,
      recommendations,
      summary: buildLocalSummary(text),
      confidence: text ? 0.7 : 0
    };
  }

  private parseAnalysis(content: string, input: AiDraftInput): AiAnalysisResult {
    try {
      const cleaned = stripJson(content);
      const parsed = cleaned ? JSON.parse(cleaned) : null;
      if (!parsed || typeof parsed !== "object") {
        return this.analyzeLocally(input);
      }
      const rec = parsed as Record<string, unknown>;
      return {
        issues: Array.isArray(rec.issues) ? (rec.issues as AiDraftIssue[]) : [],
        causes: toStrArray(rec.causes),
        diagnostics: toStrArray(rec.diagnostics),
        recommendations: toStrArray(rec.recommendations),
        summary: buildLocalSummary(input.text),
        confidence: clamp01(Number(rec.confidence ?? 0.8))
      };
    } catch {
      return this.analyzeLocally(input);
    }
  }
}

// ---- Factory ----------------------------------------------------------------

/** Cria o AIService (provider openai por padrão). Troca de provider aqui. */
export function createAIService(config = loadConfig()): AIService {
  // No futuro: `if (config.aiProvider === "gemini") return new GeminiProvider(...)`.
  return new AIService(config);
}

// ---- Tipos internos (para não duplicar import do OpenAI no topo) ------------
import type OpenAI from "openai";

// ---- Helpers ----------------------------------------------------------------

function isDraft(input: AiDraftInput | AiSummaryInput): boolean {
  return Boolean((input as AiDraftInput).context !== undefined);
}

function buildAnalysisSystemPrompt(): string {
  return [
    "Você é um analista técnico sênior da Bykonz, especializado em relatórios técnicos navais.",
    "Analise o rascunho do relatório/descrição técnica fornecido e responda APENAS com JSON válido:",
    JSON.stringify({
      issues: [
        {
          type: "missing | inconsistency | suggestion",
          severity: "low | medium | high",
          title: "título curto",
          description: "explicação",
          original: "trecho original (opcional)",
          suggestion: "texto sugerido (opcional)"
        }
      ],
      causes: ["causa provável"],
      diagnostics: ["diagnóstico possível"],
      recommendations: ["recomendação técnica"],
      confidence: 0.0
    }),
    "Identifique: informações ausentes (equipamento, local, data, técnico, pendências), inconsistências no texto e oportunidades de melhoria técnica.",
    "Escreva em português técnico e profissional."
  ].join("\n");
}

function buildAnalysisUserPrompt(input: AiDraftInput): string {
  const parts: string[] = [];
  if (input.context) parts.push(`Contexto: ${input.context}`);
  parts.push(`Rascunho a analisar:\n${input.text}`);
  parts.push("Retorne o JSON conforme o formato solicitado.");
  return parts.join("\n");
}

function stripJson(value: string): string {
  const trimmed = value.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

function toStrArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function detectMissingKeywords(lower: string): string[] {
  const missing: string[] = [];
  if (!/(equipamento|equipment|switch|painel|clp|ipc|câmera|camera|rack|encoder|antena)/.test(lower)) {
    missing.push("equipamento");
  }
  if (!/(local|site|porto|embarcação|embarcacao|vessel)/.test(lower)) {
    missing.push("local");
  }
if (!/(data|dia|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/.test(lower)) {
    missing.push("data do atendimento");
  }
  if (!/(pendên|pendencia|responsável|responsavel)/.test(lower)) {
    missing.push("pendências");
  }
  return missing;
}

function detectInconsistencies(lower: string): Array<{ title: string; description: string }> {
  const out: Array<{ title: string; description: string }> = [];
  if ((lower.includes("testado") || lower.includes("teste ok") || lower.includes("funcionando")) && lower.includes("não funciona")) {
    out.push({
      title: "Inconsistência de status",
      description: "O texto indica que o sistema foi testado/funciona, mas também menciona que não funciona."
    });
  }
  if (lower.includes("aprovado") && lower.includes("pendência")) {
    out.push({
      title: "Aprovação x pendências",
      description: "Há menção a aprovação ao mesmo tempo que existem pendências em aberto."
    });
  }
  return out;
}

function buildLocalCauses(lower: string): string[] {
  const causes: string[] = [];
  if (/(sem sinal|sem imagem|falha|defeito|não funciona|nao funciona)/.test(lower)) {
    causes.push("Possível falha no equipamento ou conexão elétrica/lógica.");
  }
  if (/(umidade|corrosão|corrosao|oxidação|oxidacao)/.test(lower)) {
    causes.push("Condições ambientais (umidade/corrosão) podem ter comprometido o equipamento.");
  }
  if (causes.length === 0) {
    causes.push("Sintomas insuficientes para determinar a causa provável.");
  }
  return causes;
}

function buildLocalDiagnostics(lower: string): string[] {
  const diags: string[] = [];
  if (/(switch|rede|network|conectividade)/.test(lower)) {
    diags.push("Provável falha de rede/conectividade.");
  }
  if (/(painel|clp|ipc)/.test(lower)) {
    diags.push("Potencial falha de hardware/energia no painel.");
  }
  if (diags.length === 0) {
    diags.push("Diagnóstico preliminar requer inspeção presencial.");
  }
  return diags;
}

function buildLocalRecommendations(lower: string, issues: AiDraftIssue[]): string[] {
  const recs: string[] = [];
  if (lower) {
    recs.push("Completar o relatório com os dados identificados como ausentes.");
  }
  for (const issue of issues) {
    if (issue.type === "inconsistency") {
      recs.push(`Revisar: ${issue.title}.`);
    }
  }
  recs.push("Registrar pendências e responsáveis antes de finalizar o relatório.");
  return recs;
}

function buildLocalSummary(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Relatório técnico sem conteúdo informado.";
  }
  const words = trimmed.split(/\s+/).length;
  return `Relatório técnico com ${words} palavra(s), com foco em diagnóstico e recomendação de ações.`;
}
