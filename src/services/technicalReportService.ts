import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import { AiEngineService } from "./aiEngineService";
import { S3ObjectStorage } from "../lib/s3Storage";
import { TechnicalPdfGenerator } from "../lib/technicalPdfGenerator";
import { TechnicalDocxGenerator } from "../lib/technicalDocxGenerator";
import { loadConfig } from "../config/env";

export interface CreateMobilizationInput {
  projectId: number;
  vesselId?: number;
  clientName?: string;
  vesselName?: string;
  serviceType?: string;
  attendanceType?: string;
  siteLocation?: string;
  mobilizationDate?: string;
  technicianName?: string;
  objective?: string;
}

export interface EvidenceInput {
  category: string;
  observation?: string;
  aiDescription?: string;
  ocrText?: string;
  attachmentType?: string;
  attachmentMime?: string;
  attachmentData?: string;
  videoUrl?: string;
  documentUrl?: string;
}

export interface PendingIssueInput {
  system: string;
  description: string;
  responsible?: string;
  status?: string;
  suggestedByAi?: boolean;
}

export interface EquipmentInput {
  name: string;
  manufacturer?: string;
  model?: string;
  notes?: string;
}

export class TechnicalReportService {
  private readonly ai: AiEngineService;
  private readonly storage: S3ObjectStorage | null;
  private readonly pdfGenerator: TechnicalPdfGenerator;
  private readonly docxGenerator: TechnicalDocxGenerator;

  constructor() {
    this.ai = new AiEngineService();
    this.storage = this.createStorage();
    this.pdfGenerator = new TechnicalPdfGenerator();
    this.docxGenerator = new TechnicalDocxGenerator();
  }

  private createStorage(): S3ObjectStorage | null {
    try {
      return S3ObjectStorage.fromConfig(loadConfig());
    } catch {
      return null;
    }
  }

  async listMobilizations(projectId: number) {
    return prisma.technicalMobilization.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        reports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async getMobilization(mobilizationId: number) {
    return prisma.technicalMobilization.findUnique({
      where: { id: mobilizationId },
      include: {
        vessel: true,
        evidences: { orderBy: [{ category: "asc" }, { orderIndex: "asc" }, { createdAt: "asc" }] },
        pendingIssues: { orderBy: { createdAt: "asc" } },
        equipment: { orderBy: { createdAt: "asc" } },
        inventory: { orderBy: { createdAt: "asc" } },
        reports: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  async createMobilization(input: CreateMobilizationInput) {
    const reportCode = await this.generateReportCode();
    const attendanceType = normalizeAttendanceType(input.attendanceType);
    return prisma.technicalMobilization.create({
      data: {
        projectId: input.projectId,
        reportCode,
        vesselId: input.vesselId,
        clientName: input.clientName,
        vesselName: input.vesselName,
        serviceType: input.serviceType,
        attendanceType,
        siteLocation: input.siteLocation,
        mobilizationDate: input.mobilizationDate ? new Date(input.mobilizationDate) : undefined,
        technicianName: input.technicianName,
        objective: input.objective,
        status: "DRAFT",
      },
    });
  }

  async addEvidence(mobilizationId: number, input: EvidenceInput) {
    return prisma.technicalEvidence.create({
      data: {
        mobilizationId,
        category: input.category,
        observation: input.observation,
        aiDescription: input.aiDescription,
        ocrText: input.ocrText,
        attachmentType: input.attachmentType,
        attachmentMime: input.attachmentMime,
        attachmentData: input.attachmentData,
        videoUrl: input.videoUrl,
        documentUrl: input.documentUrl,
      },
    });
  }

  /**
   * Upload de evidência com análise automática pela IA (Vision). Persiste a
   * descrição/sugestões geradas e permite edição posterior pelo técnico.
   */
  async uploadEvidence(mobilizationId: number, input: {
    filename?: string;
    contentType?: string;
    body?: string;
    category?: string;
    observation?: string;
  }) {
    let attachmentData: string | undefined;
    if (this.storage && input.body) {
      const body = Buffer.from(input.body, "base64");
      const filename = input.filename ?? `evidence-${Date.now()}`;
      const path = `technical-evidences/${mobilizationId}/${Date.now()}-${filename}`;
      await this.storage.uploadPrivateObject({ path, body, contentType: input.contentType ?? "application/octet-stream" });
      attachmentData = path;
    }

    const analysis = await this.ai.analyzeEvidence({
      imageBase64: input.body,
      contentType: input.contentType,
      filename: input.filename,
      observation: input.observation
    });

    const orderIndex = await this.nextOrderIndex(mobilizationId, analysis.category);

    const evidence = await prisma.technicalEvidence.create({
      data: {
        mobilizationId,
        category: input.category ?? analysis.category,
        observation: input.observation,
        aiDescription: analysis.aiDescription,
        aiConfidence: analysis.confidence,
        aiTags: analysis.aiTags,
        equipmentIdentified: analysis.equipmentIdentified,
        manufacturer: analysis.manufacturer,
        model: analysis.model,
        serialNumber: analysis.serialNumber,
        ocrText: analysis.ocrText,
        orderIndex,
        attachmentType: input.contentType?.split("/")[0] ?? "file",
        attachmentMime: input.contentType,
        attachmentData,
      },
    });

// Sugestão automática de pendências pela IA
    if (analysis.suggestedPendingIssues.length > 0) {
      await prisma.technicalPendingIssue.createMany({
        data: analysis.suggestedPendingIssues.map((issue) => ({
          mobilizationId,
          system: issue.system ?? analysis.category,
          description: issue.description,
          suggestedByAi: true,
        })),
      });
    }

    return evidence;
  }

  async updateEvidence(evidenceId: number, input: { aiDescription?: string; category?: string; observation?: string; orderIndex?: number }) {
    return prisma.technicalEvidence.update({
      where: { id: evidenceId },
      data: {
        aiDescription: input.aiDescription,
        category: input.category,
        observation: input.observation,
        orderIndex: input.orderIndex,
      },
    });
  }

async addPendingIssue(mobilizationId: number, input: PendingIssueInput) {
    return prisma.technicalPendingIssue.create({
      data: {
        mobilizationId,
        system: input.system,
        description: input.description,
        responsible: input.responsible,
        status: normalizePendingStatus(input.status),
        suggestedByAi: input.suggestedByAi ?? false,
      },
    });
  }

  async addEquipment(mobilizationId: number, input: EquipmentInput) {
    return prisma.technicalEquipment.create({
      data: {
        mobilizationId,
        name: input.name,
        manufacturer: input.manufacturer,
        model: input.model,
        notes: input.notes,
      },
    });
  }

  async addInventoryItem(mobilizationId: number, input: { name: string; category?: string; quantity?: number; notes?: string }) {
    return prisma.technicalInventory.create({
      data: {
        mobilizationId,
        name: input.name,
        category: input.category,
        quantity: input.quantity ?? 1,
        notes: input.notes,
      },
    });
  }

  /**
   * Gera o relatório técnico usando a IA + memória da embarcação. O PDF nunca é
   * fonte de dados: o conteúdo em Markdown é armazenado no banco e o PDF é
   * gerado dinamicamente a partir dele.
   */
  async generateReport(mobilizationId: number) {
    const mobilization = await prisma.technicalMobilization.findUnique({
      where: { id: mobilizationId },
      include: {
        vessel: true,
        evidences: { orderBy: [{ category: "asc" }, { orderIndex: "asc" }] },
        pendingIssues: true,
        equipment: true,
        inventory: true,
      },
    });

    if (!mobilization) {
      throw new Error("mobilization_not_found");
    }

    // Memória técnica da embarcação: consulta relatórios anteriores e embutimentos
    const memorySummary = await this.buildMemorySummary(mobilization);

    const result = await this.ai.generateReport({
      reportCode: mobilization.reportCode,
      clientName: mobilization.clientName,
      vesselName: mobilization.vesselName,
      serviceType: mobilization.serviceType,
      attendanceType: mobilization.attendanceType,
      siteLocation: mobilization.siteLocation,
      mobilizationDate: mobilization.mobilizationDate,
      technicianName: mobilization.technicianName,
      objective: mobilization.objective,
      vessel: mobilization.vessel
        ? {
            name: mobilization.vessel.name,
            imo: mobilization.vessel.imo,
            mmsi: mobilization.vessel.mmsi,
            vesselType: mobilization.vessel.vesselType,
            port: mobilization.vessel.port,
            location: mobilization.vessel.location,
          }
        : null,
      evidences: mobilization.evidences.map((e) => ({
        category: e.category,
        observation: e.observation,
        aiDescription: e.aiDescription,
        ocrText: e.ocrText,
        manufacturer: e.manufacturer,
        model: e.model,
        serialNumber: e.serialNumber,
        equipmentIdentified: e.equipmentIdentified,
      })),
      equipment: mobilization.equipment,
      pendingIssues: mobilization.pendingIssues,
      memorySummary: memorySummary ?? undefined,
    });

    const report = await this.upsertReport(mobilizationId, mobilization, result, memorySummary);

    // Persiste a memória técnica da embarcação
    if (mobilization.vesselId) {
      await this.persistMemory(mobilization.vesselId, report.id, result.content, mobilization);
    }

    return report;
  }

  private async upsertReport(
    mobilizationId: number,
    mobilization: {
      id: number;
      reportCode: string;
      vesselId?: number | null;
    },
    result: { content: string; summary: string; conclusion: string },
    memorySummary?: string | null
  ) {
    const data = {
      title: `Relatório ${mobilization.reportCode}`,
      reportCode: mobilization.reportCode,
      summary: result.summary,
      conclusion: result.conclusion,
      content: result.content,
      metadata: {
        categories: await this.loadCategories(mobilizationId),
        memorySummary,
      },
    };

    const existing = await prisma.technicalReport.findFirst({ where: { mobilizationId } });
    if (existing) {
      return prisma.technicalReport.update({ where: { id: existing.id }, data });
    }

    return prisma.technicalReport.create({
      data: {
        mobilizationId,
        ...data,
      },
    });
  }

  private async loadCategories(mobilizationId: number): Promise<string[]> {
    const items = await prisma.technicalEvidence.findMany({
      where: { mobilizationId },
      select: { category: true },
    });
    return Array.from(new Set(items.map((i) => i.category)));
  }

  private async buildMemorySummary(mobilization: {
    vesselId?: number | null;
  }): Promise<string | null> {
    if (!mobilization.vesselId) return null;
    const memories = await prisma.technicalMemory.findMany({
      where: { vesselId: mobilization.vesselId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (memories.length === 0) return null;
    return memories.map((m) => m.content).join("\n---\n").slice(0, 4000);
  }

  private async persistMemory(
    vesselId: number,
    reportId: number,
    content: string,
    mobilization: { reportCode: string }
  ) {
    const embedding = await this.ai.createEmbedding(content);
    const memoryText = `[${mobilization.reportCode}] ${content.slice(0, 6000)}`;
    await prisma.technicalMemory.create({
      data: {
        vesselId,
        reportId,
        contentType: "TEXT",
        content: memoryText,
        embedding: embedding ? { vector: embedding } : undefined,
        metadata: { reportCode: mobilization.reportCode },
      },
    });
  }

  /**
   * Gera um token público de compartilhamento (expirável) para o relatório.
   */
  async createShareLink(reportId: number, expiresInDays = 30) {
    const token = generateShareToken();
    const shareExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    return prisma.technicalReport.update({
      where: { id: reportId },
      data: { shareToken: token, shareExpiresAt },
    });
  }

async getReportByShareToken(token: string) {
    const report = await prisma.technicalReport.findUnique({
      where: { shareToken: token },
      include: { mobilization: true },
    });
    if (!report) return null;
    if (report.shareExpiresAt && report.shareExpiresAt < new Date()) {
      return null;
    }
    return report;
  }

  /**
   * Gera o PDF profissional do relatório dinamicamente a partir do banco.
   * O PDF nunca é a fonte de dados — o conteúdo Markdown é a fonte; o PDF é
   * renderizado sob demanda.
   */
  async exportPdf(reportId: number): Promise<Buffer> {
    const report = await prisma.technicalReport.findUnique({
      where: { id: reportId },
      include: {
        mobilization: {
          include: {
            evidences: { orderBy: [{ category: "asc" }, { orderIndex: "asc" }] },
          },
        },
      },
    });
    if (!report) {
      throw new Error("report_not_found");
    }

    const attachments = report.mobilization.evidences
      .filter((e) => e.attachmentData && e.attachmentMime?.startsWith("image/"))
      .map((e) => ({
        path: e.attachmentData!,
        caption: e.aiDescription ?? e.observation,
      }));

    return this.pdfGenerator.generate({
      reportCode: report.reportCode,
      title: report.title,
      summary: report.summary,
      conclusion: report.conclusion,
      content: report.content,
      clientName: report.mobilization.clientName,
      vesselName: report.mobilization.vesselName,
      technicianName: report.mobilization.technicianName,
      siteLocation: report.mobilization.siteLocation,
      mobilizationDate: report.mobilization.mobilizationDate,
attachments,
      downloadMedia: this.storage
        ? async (path: string) => this.storage?.downloadPrivateObject(path).catch(() => null) ?? null
        : undefined,
    });
  }

  /**
   * Gera o relatório em formato Word (.docx) dinamicamente a partir do banco.
   */
  async exportDocx(reportId: number): Promise<Buffer> {
    const report = await prisma.technicalReport.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new Error("report_not_found");
    }

    return this.docxGenerator.generate({
      reportCode: report.reportCode,
      title: report.title,
      content: report.content,
    });
  }

  async listVesselHistory(vesselId: number) {
    return prisma.technicalMobilization.findMany({
      where: { vesselId },
      orderBy: { mobilizationDate: "desc" },
      include: {
        reports: { orderBy: { createdAt: "desc" }, take: 1 },
        pendingIssues: { orderBy: { createdAt: "desc" }, take: 10 },
        equipment: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  }

  private async nextOrderIndex(mobilizationId: number, category: string): Promise<number> {
    const last = await prisma.technicalEvidence.findFirst({
      where: { mobilizationId, category },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    return (last?.orderIndex ?? 0) + 1;
  }

  private async generateReportCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const count = await prisma.technicalMobilization.count({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });

    const sequence = String(count + 1).padStart(6, "0");
    return `RT-${year}-${sequence}`;
  }
}

function normalizeAttendanceType(value?: string): Prisma.TechnicalMobilizationCreateInput["attendanceType"] {
  const map: Record<string, NonNullable<Prisma.TechnicalMobilizationCreateInput["attendanceType"]>> = {
    SITE_SURVEY: "SITE_SURVEY",
    INSTALLATION: "INSTALLATION",
    MAINTENANCE: "MAINTENANCE",
    DIAGNOSIS: "DIAGNOSIS",
    COMMISSIONING: "COMMISSIONING",
    TECHNICAL_SUPPORT: "TECHNICAL_SUPPORT",
  };
  if (!value) return undefined;
  const upper = value.replace(/[\s-]/g, "_").toUpperCase();
  return map[upper] ?? map[toEnumKey(value)] ?? undefined;
}

function toEnumKey(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "_")
    .toUpperCase();
  const map: Record<string, string> = {
    SITE_SURVEY: "SITE_SURVEY",
    INSTALACAO: "INSTALLATION",
    INSTALLATION: "INSTALLATION",
    MANUTENCAO: "MAINTENANCE",
    MAINTENANCE: "MAINTENANCE",
    DIAGNOSTICO: "DIAGNOSIS",
    DIAGNOSIS: "DIAGNOSIS",
    COMISSIONAMENTO: "COMMISSIONING",
    COMMISSIONING: "COMMISSIONING",
    SUPORTE_TECNICO: "TECHNICAL_SUPPORT",
    TECHNICAL_SUPPORT: "TECHNICAL_SUPPORT",
  };
  return map[normalized] ?? normalized;
}

function generateShareToken(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

function normalizePendingStatus(value?: string): Prisma.TechnicalPendingIssueCreateInput["status"] {
  const map: Record<string, NonNullable<Prisma.TechnicalPendingIssueCreateInput["status"]>> = {
    OPEN: "OPEN",
    IN_PROGRESS: "IN_PROGRESS",
    RESOLVED: "RESOLVED",
    CLOSED: "CLOSED",
  };
  if (!value) return undefined;
  const normalized = value.replace(/[\s-]/g, "_").toUpperCase();
  return map[normalized] ?? undefined;
}
