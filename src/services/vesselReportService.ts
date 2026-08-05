import { prisma } from "../lib/prisma";
import { S3ObjectStorage } from "../lib/s3Storage";
import { loadConfig } from "../config/env";
import { analyzeEvidenceContent } from "./vesselAiService";

export interface CreateVesselInput {
  companyId?: number;
  name: string;
  code?: string;
  imo?: string;
  mmsi?: string;
  vesselType?: string;
  vesselClass?: string;
  flag?: string;
  port?: string;
  location?: string;
  model?: string;
  manufacturer?: string;
  observations?: string;
}

export interface CreateMobilizationInput {
  vesselId: number;
  title?: string;
  serviceType?: string;
  objective?: string;
  location?: string;
  technicianName?: string;
  mobilizationDate?: string;
}

export class VesselReportService {
  private readonly storage = this.createStorage();

  private createStorage() {
    try {
      return S3ObjectStorage.fromConfig(loadConfig());
    } catch {
      return null;
    }
  }

  async listVessels() {
    return prisma.vessel.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        mobilizations: { orderBy: { createdAt: "desc" }, take: 5 },
        reports: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    });
  }

  async getVessel(vesselId: number) {
    return prisma.vessel.findUnique({
      where: { id: vesselId },
      include: {
        mobilizations: { orderBy: { createdAt: "desc" } },
        reports: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async createVessel(input: CreateVesselInput) {
    return prisma.vessel.create({
      data: {
        companyId: input.companyId ? Number(input.companyId) : null,
        name: input.name,
        code: input.code,
        imo: input.imo,
        mmsi: input.mmsi,
        vesselType: input.vesselType,
        vesselClass: input.vesselClass,
        flag: input.flag,
        port: input.port,
        location: input.location,
        model: input.model,
        manufacturer: input.manufacturer,
        observations: input.observations,
      },
    });
  }

  async createMobilization(input: CreateMobilizationInput) {
    const code = await this.generateReportCode();
    return prisma.vesselMobilization.create({
      data: {
        vesselId: input.vesselId,
        reportCode: code,
        title: input.title ?? `Mobilização ${new Date().toISOString().slice(0, 10)}`,
        serviceType: input.serviceType,
        objective: input.objective,
        location: input.location,
        technicianName: input.technicianName,
        mobilizationDate: input.mobilizationDate ? new Date(input.mobilizationDate) : undefined,
      },
    });
  }

  async addEvidence(mobilizationId: number, input: { category: string; observation?: string; description?: string; ocrText?: string; attachmentType?: string; attachmentMime?: string; attachmentData?: string }) {
    return prisma.vesselEvidence.create({
      data: {
        mobilizationId,
        category: input.category,
        observation: input.observation,
        description: input.description,
        ocrText: input.ocrText,
        attachmentType: input.attachmentType,
        attachmentMime: input.attachmentMime,
        attachmentData: input.attachmentData,
      },
    });
  }

  async uploadEvidence(mobilizationId: number, input: { filename?: string; contentType?: string; body?: string; category?: string; observation?: string; description?: string; ocrText?: string }) {
    if (!this.storage) {
      throw new Error("storage_not_configured");
    }

    const body = input.body ? Buffer.from(input.body, "base64") : Buffer.alloc(0);
    const filename = input.filename ?? `evidence-${Date.now()}`;
    const path = `vessel-evidences/${mobilizationId}/${Date.now()}-${filename}`;
    await this.storage.uploadPrivateObject({ path, body, contentType: input.contentType ?? "application/octet-stream" });

    const analysis = analyzeEvidenceContent({
      filename,
      contentType: input.contentType,
      observation: input.observation,
      ocrText: input.ocrText
    });

    return prisma.vesselEvidence.create({
      data: {
        mobilizationId,
        category: input.category ?? analysis.category,
        observation: input.observation ?? analysis.aiSummary,
        description: input.description ?? analysis.aiSummary,
        ocrText: input.ocrText,
        attachmentType: input.contentType?.split("/")[0] ?? "file",
        attachmentMime: input.contentType,
        attachmentData: path,
      },
    });
  }

  async addPendingIssue(mobilizationId: number, input: { system: string; description: string; responsible?: string; status?: string }) {
    return prisma.vesselPendingIssue.create({
      data: {
        mobilizationId,
        system: input.system,
        description: input.description,
        responsible: input.responsible,
        status: input.status ?? "OPEN",
      },
    });
  }

  async addEquipment(mobilizationId: number, input: { name: string; manufacturer?: string; model?: string; notes?: string }) {
    return prisma.vesselEquipment.create({
      data: {
        mobilizationId,
        name: input.name,
        manufacturer: input.manufacturer,
        model: input.model,
        notes: input.notes,
      },
    });
  }

  async generateReport(mobilizationId: number) {
    const mobilization = await prisma.vesselMobilization.findUnique({
      where: { id: mobilizationId },
      include: {
        vessel: true,
        evidences: true,
        pendingIssues: true,
        equipment: true,
      },
    });

    if (!mobilization) throw new Error("mobilization_not_found");

    const content = buildReportContent(mobilization);
    const report = await prisma.vesselReport.create({
      data: {
        vesselId: mobilization.vesselId,
        mobilizationId,
        title: `Relatório ${mobilization.reportCode}`,
        reportCode: mobilization.reportCode,
        summary: buildSummary(mobilization),
        conclusion: buildConclusion(mobilization),
        content,
        metadata: {
          categories: mobilization.evidences.map((e) => e.category),
          pendingIssuesCount: mobilization.pendingIssues.length,
          equipmentCount: mobilization.equipment.length,
        },
      },
    });

    return report;
  }

  private async generateReportCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const count = await prisma.vesselMobilization.count();
    return `RT-${year}-${String(count + 1).padStart(6, "0")}`;
  }
}

function buildSummary(mobilization: { title?: string | null; serviceType?: string | null; objective?: string | null }) {
  return `Mobilização ${mobilization.title ?? "técnica"} para ${mobilization.serviceType?.toLowerCase() ?? "atendimento"}. ${mobilization.objective?.trim() || "Relatório estruturado a partir das evidências registradas."}`;
}

function buildConclusion(mobilization: { technicianName?: string | null; location?: string | null; vessel?: { name?: string | null } }) {
  const technician = mobilization.technicianName ?? "técnico responsável";
  const location = mobilization.location ?? "local de atendimento";
  const vesselName = mobilization.vessel?.name ?? "embarcação";
  return `${technician} concluiu a avaliação em ${location} para ${vesselName}. O relatório foi montado automaticamente com base nas evidências e no histórico técnico da embarcação.`;
}

function buildReportContent(mobilization: {
  reportCode: string;
  title?: string | null;
  serviceType?: string | null;
  objective?: string | null;
  location?: string | null;
  technicianName?: string | null;
  vessel?: { name?: string | null; imo?: string | null; mmsi?: string | null; vesselType?: string | null; port?: string | null; location?: string | null };
  evidences: Array<{ category: string; observation?: string | null; description?: string | null }>;
  equipment: Array<{ name: string; manufacturer?: string | null; model?: string | null }>;
  pendingIssues: Array<{ system: string; description: string }>;
}) {
  const evidenceText = mobilization.evidences.map((item) => `- ${item.category}: ${item.description ?? item.observation ?? "Evidência registrada"}`).join("\n");
  const equipmentText = mobilization.equipment.map((item) => `- ${item.name}${item.manufacturer ? ` (${item.manufacturer})` : ""}${item.model ? ` - ${item.model}` : ""}`).join("\n");
  const pendingText = mobilization.pendingIssues.map((item) => `- ${item.system}: ${item.description}`).join("\n");

  return [
    `# Relatório Técnico ${mobilization.reportCode}`,
    `## ${mobilization.title ?? "Mobilização"}`,
    "",
    "## Capa",
    "Relatório gerado automaticamente a partir das evidências registradas durante a mobilização técnica.",
    "",
    "## Dados Gerais",
    `Tipo de atendimento: ${mobilization.serviceType ?? "Não informado"}`,
    `Local: ${mobilization.location ?? "Não informado"}`,
    `Técnico responsável: ${mobilization.technicianName ?? "Não informado"}`,
    "",
    "## Dados da Embarcação",
    `Nome: ${mobilization.vessel?.name ?? "Não informado"}`,
    `IMO: ${mobilization.vessel?.imo ?? "Não informado"}`,
    `MMSI: ${mobilization.vessel?.mmsi ?? "Não informado"}`,
    `Tipo: ${mobilization.vessel?.vesselType ?? "Não informado"}`,
    `Porto/Localização: ${mobilization.vessel?.port ?? mobilization.vessel?.location ?? "Não informado"}`,
    "",
    "## Objetivo",
    mobilization.objective?.trim() || "Registrar evidências técnicas e consolidar o atendimento em documento padronizado.",
    "",
    "## Escopo",
    "Acompanhamento técnico com registro de evidências para posterior geração do relatório final.",
    "",
    "## Atividades Realizadas",
    "Inspeção visual, organização das evidências e geração inicial do diagnóstico técnico com base nos registros da mobilização.",
    "",
    "## Equipamentos Instalados",
    equipmentText || "Nenhum equipamento cadastrado.",
    "",
    "## Testes Executados",
    "Análise visual das evidências registradas e validação técnica preliminar do estado do sistema.",
    "",
    "## Diagnóstico Técnico",
    "As evidências foram analisadas de forma técnica e estruturadas para compor o diagnóstico inicial do atendimento.",
    "",
    "## Pendências",
    pendingText || "Nenhuma pendência registrada.",
    "",
    "## Registro Fotográfico",
    evidenceText || "Nenhuma evidência registrada.",
    "",
    "## Materiais Utilizados",
    "Materiais e componentes registrados a partir das evidências e observações da mobilização.",
    "",
    "## Inventário",
    `Total de evidências registradas: ${mobilization.evidences.length}`,
    "",
    "## Conclusão Técnica",
    "O relatório foi montado automaticamente para servir como base documental do atendimento técnico.",
    "",
    "## Assinaturas",
    "Técnico responsável / Cliente / Responsável técnico",
  ].join("\n");
}
