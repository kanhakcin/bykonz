import type { ConversationStep as PrismaConversationStep, Prisma, PrismaClient } from "@prisma/client";
import type {
  ConversationStateRecord,
  ConversationStore,
  CreateEntradaInput,
  CreateTreinamentoInput,
  EmpresaRecord,
  EntradaForGroupForward,
  EntradaForReport,
  NormaRecord,
  ObraForReport,
  ObraRecord,
  SaveConversationStateInput,
  UserRecord
} from "./conversationService";
import { EntryMentionIdentifier } from "./entryMentionIdentifier";
import { phoneDigitsToE164 } from "../utils/phone";

/**
 * Adapter do port ConversationStore para o schema em inglês (tabelas
 * snake_case plural). As formas dos records do domínio (em português,
 * definidas em src/flows/types.ts) são preservadas — a tradução de nomes
 * acontece somente aqui.
 */
export class PrismaConversationStore implements ConversationStore {
  /** Identificação de códigos/menções, compartilhada com o painel. */
  private readonly mentions: EntryMentionIdentifier;

  constructor(private readonly prisma: PrismaClient) {
    this.mentions = new EntryMentionIdentifier(prisma);
  }

  async findUserByPhone(phoneDigits: string): Promise<UserRecord | null> {
    const phoneE164 = phoneDigitsToE164(phoneDigits);
    if (!phoneE164) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneE164 }
    });

    // Usuário inativo é tratado como não cadastrado: o bot não responde.
    if (!user || !user.active) {
      return null;
    }

    return {
      id: user.id,
      phoneE164: user.phoneE164.replace(/^\+/, ""),
      telegramUserId: user.telegramUserId,
      nome: user.name
    };
  }

  async linkTelegramIdByPhone(input: {
    phoneCandidates: string[];
    telegramUserId: string;
  }): Promise<{ user: UserRecord | null; alreadyLinked: boolean }> {
    // Resolve o operador testando os candidatos de telefone (com/sem o 9º dígito).
    let matched: { id: number; phoneE164: string; name: string | null; telegramUserId: string | null } | null = null;
    for (const candidate of input.phoneCandidates) {
      const phoneE164 = phoneDigitsToE164(candidate);
      if (!phoneE164) {
        continue;
      }
      const user = await this.prisma.user.findUnique({ where: { phoneE164 } });
      if (user && user.active) {
        matched = { id: user.id, phoneE164: user.phoneE164, name: user.name, telegramUserId: user.telegramUserId };
        break;
      }
    }

    if (!matched) {
      return { user: null, alreadyLinked: false };
    }

    // Não sobrescreve um vínculo existente (evita sequestro por telefone repetido).
    if (matched.telegramUserId && matched.telegramUserId !== input.telegramUserId) {
      return { user: null, alreadyLinked: true };
    }

    const updated = await this.prisma.user.update({
      where: { id: matched.id },
      data: { telegramUserId: input.telegramUserId }
    });

    return {
      user: {
        id: updated.id,
        phoneE164: updated.phoneE164.replace(/^\+/, ""),
        telegramUserId: updated.telegramUserId,
        nome: updated.name
      },
      alreadyLinked: false
    };
  }

  async findUserByTelegramId(telegramUserId: string): Promise<UserRecord | null> {
    if (!telegramUserId) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId }
    });

    // Usuário inativo é tratado como não cadastrado: o bot não responde.
    if (!user || !user.active) {
      return null;
    }

    return {
      id: user.id,
      phoneE164: user.phoneE164.replace(/^\+/, ""),
      telegramUserId: user.telegramUserId,
      nome: user.name
    };
  }

  async findEmpresasByUser(userId: number): Promise<EmpresaRecord[]> {
    const links = await this.prisma.userCompany.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { companyId: "asc" }
    });

    return links.map((link) => ({
      id: link.company.id,
      nome: link.company.name
    }));
  }

  async findObrasAtivas(): Promise<ObraRecord[]> {
    const projects = await this.prisma.project.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true }
    });

    return projects.map((project) => ({
      id: project.id,
      nome: project.name,
      codigo: project.code
    }));
  }

  async findNormasForObra(obraId: number): Promise<NormaRecord[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: obraId },
      select: { sectorId: true }
    });
    if (!project) {
      return [];
    }

    const standards = await this.prisma.standard.findMany({
      where: { sectorId: project.sectorId, active: true },
      orderBy: { code: "asc" },
      select: { code: true, title: true }
    });

    return standards.map((standard) => ({
      code: standard.code,
      title: standard.title
    }));
  }

  async getState(chatId: string): Promise<ConversationStateRecord | null> {
    const state = await this.prisma.whatsappConversationState.findUnique({
      where: { chatId }
    });

    return state ? mapState(state) : null;
  }

  async saveState(input: SaveConversationStateInput): Promise<ConversationStateRecord> {
    const fields = {
      phoneE164: input.phoneE164,
      step: input.step as PrismaConversationStep,
      flowKey: input.flowKey ?? null,
      stepKey: input.stepKey ?? input.step,
      flowData: toPrismaJson(input.flowData),
      selectedCategory: input.selectedTipo ?? null,
      selectedCompanyId: input.selectedEmpresaId ?? null,
      selectedServiceType: input.selectedTipoServico ?? null,
      selectedProcedureNumber: input.selectedNumeroProcedimento ?? null,
      selectedTrainingTopic: input.selectedTreinamentoTema ?? null,
      selectedTrainingParticipants: input.selectedTreinamentoParticipantes ?? null,
      selectedTrainingStartsAt: input.selectedTreinamentoInicio ?? null,
      selectedTrainingEndsAt: input.selectedTreinamentoFim ?? null,
      selectedTrainingPhotoCount: input.selectedTrainingPhotoCount ?? null,
      pendingEntryId: input.pendingEntradaId ?? null
    };

    const state = await this.prisma.whatsappConversationState.upsert({
      where: { chatId: input.chatId },
      create: { chatId: input.chatId, ...fields },
      update: fields
    });

    return mapState(state);
  }

  async clearState(chatId: string): Promise<void> {
    await this.prisma.whatsappConversationState.deleteMany({
      where: { chatId }
    });
  }

  async createEntrada(input: CreateEntradaInput): Promise<{ id: bigint }> {
    // Vincula o registro à obra e herda o setor dela (painel filtra por obra).
    const project =
      input.obraId != null
        ? await this.prisma.project.findUnique({
            where: { id: input.obraId },
            select: { id: true, sectorId: true }
          })
        : null;
    const sectorId = project?.sectorId ?? null;

    const entry = await this.prisma.entry.create({
      data: {
        userId: input.userId,
        companyId: input.empresaId,
        projectId: project?.id ?? null,
        sectorId,
        category: input.tipo,
        serviceType: input.tipoServico ?? null,
        procedureNumber: input.numeroProcedimento ?? null,
        description: input.description
      },
      select: { id: true }
    });

    const scanText = [input.numeroProcedimento, input.description].filter(Boolean).join(" ");
    await this.mentions.identify(entry.id, sectorId, scanText);

    return entry;
  }

  async createTreinamento(input: CreateTreinamentoInput): Promise<{ entradaId: bigint; treinamentoId: number }> {
    const project =
      input.obraId != null
        ? await this.prisma.project.findUnique({
            where: { id: input.obraId },
            select: { id: true, sectorId: true }
          })
        : null;

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          userId: input.userId,
          companyId: input.empresaId,
          projectId: project?.id ?? null,
          sectorId: project?.sectorId ?? null,
          category: "Treinamento",
          serviceType: null,
          procedureNumber: null,
          description: ""
        },
        select: { id: true }
      });

      const training = await tx.training.create({
        data: {
          entryId: entry.id,
          topic: input.tema,
          participants: input.participantes,
          startsAt: input.inicio,
          endsAt: input.fim
        },
        select: { id: true }
      });

      return { entradaId: entry.id, treinamentoId: training.id };
    });
  }

  async addEntradaMedia(input: { entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }): Promise<void> {
    await this.prisma.entryMedia.create({
      data: {
        entryId: input.entradaId,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaTipo ?? null
      }
    });
  }

  async updateEntradaDescription(entradaId: bigint, description: string): Promise<void> {
    const entry = await this.prisma.entry.update({
      where: { id: entradaId },
      data: { description },
      select: { id: true, sectorId: true, procedureNumber: true }
    });

    const scanText = [entry.procedureNumber, description].filter(Boolean).join(" ");
    await this.mentions.identify(entry.id, entry.sectorId, scanText);
  }

  async updateEntradaProcedureNumber(entradaId: bigint, numeroProcedimento: string): Promise<void> {
    const entry = await this.prisma.entry.update({
      where: { id: entradaId },
      data: { procedureNumber: numeroProcedimento },
      select: { id: true, sectorId: true, description: true }
    });

    const scanText = [numeroProcedimento, entry.description].filter(Boolean).join(" ");
    await this.mentions.identify(entry.id, entry.sectorId, scanText);
  }

  async findEntradasForReport(input: {
    empresaId: bigint;
    obraId?: number | null;
    tipo: string;
    dateStart: Date;
    dateEnd: Date;
  }): Promise<EntradaForReport[]> {
    const entries = await this.prisma.entry.findMany({
      where: {
        companyId: input.empresaId,
        projectId: input.obraId ?? undefined,
        category: input.tipo,
        createdAt: {
          gte: input.dateStart,
          lt: input.dateEnd
        }
      },
      include: {
        company: { select: { name: true } },
        user: { select: { name: true } },
        media: { select: { mediaUrl: true } },
        training: true
      },
      orderBy: { createdAt: "asc" }
    });

    return entries.map((e) => ({
      id: e.id,
      description: e.description,
      createdAt: e.createdAt,
      tipo: e.category,
      tipoServico: e.serviceType,
      numeroProcedimento: e.procedureNumber,
      treinamentoTema: e.training?.topic ?? null,
      treinamentoParticipantes: e.training?.participants ?? null,
      treinamentoInicio: e.training?.startsAt ?? null,
      treinamentoFim: e.training?.endsAt ?? null,
      empresaNome: e.company?.name ?? null,
      usuarioNome: e.user.name ?? null,
      mediaUrls: e.media.map((m) => m.mediaUrl)
    }));
  }

  async findEntradasForObraDay(input: { obraId: number; dateStart: Date; dateEnd: Date }): Promise<EntradaForReport[]> {
    const entries = await this.prisma.entry.findMany({
      where: {
        projectId: input.obraId,
        createdAt: {
          gte: input.dateStart,
          lt: input.dateEnd
        }
      },
      include: {
        company: { select: { name: true } },
        user: { select: { name: true } },
        media: { select: { mediaUrl: true } },
        training: true
      },
      orderBy: [{ companyId: "asc" }, { createdAt: "asc" }]
    });

    return entries.map((e) => ({
      id: e.id,
      description: e.description,
      createdAt: e.createdAt,
      tipo: e.category,
      tipoServico: e.serviceType,
      numeroProcedimento: e.procedureNumber,
      treinamentoTema: e.training?.topic ?? null,
      treinamentoParticipantes: e.training?.participants ?? null,
      treinamentoInicio: e.training?.startsAt ?? null,
      treinamentoFim: e.training?.endsAt ?? null,
      empresaNome: e.company?.name ?? null,
      usuarioNome: e.user.name ?? null,
      mediaUrls: e.media.map((m) => m.mediaUrl)
    }));
  }

  async findEntradaForGroupForward(entradaId: bigint): Promise<EntradaForGroupForward | null> {
    const entry = await this.prisma.entry.findUnique({
      where: { id: entradaId },
      include: {
        user: { select: { name: true } },
        media: { select: { mediaUrl: true } }
      }
    });
    if (!entry) {
      return null;
    }

    return {
      description: entry.description,
      tipoServico: entry.serviceType,
      numeroProcedimento: entry.procedureNumber,
      usuarioNome: entry.user.name ?? null,
      mediaUrls: entry.media.map((m) => m.mediaUrl)
    };
  }

  async findObraById(obraId: number): Promise<ObraForReport | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: obraId },
      include: { company: { select: { name: true } } }
    });
    if (!project) {
      return null;
    }

    return {
      id: project.id,
      nome: project.name,
      codigo: project.code,
      construtoraNome: project.company?.name ?? null,
      whatsappGroupId: project.whatsappGroupId,
      whatsappAutoReportEnabled: project.whatsappAutoReportEnabled,
      reportEmailRecipients: project.reportEmailRecipients,
      emailAutoReportEnabled: project.emailAutoReportEnabled,
      status: project.status
    };
  }

  async findObrasForAutoReport(): Promise<ObraForReport[]> {
    // Canais independentes: seleciona obras ativas com QUALQUER canal de
    // auto-report habilitado (WhatsApp e/ou e-mail).
    const projects = await this.prisma.project.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ whatsappAutoReportEnabled: true }, { emailAutoReportEnabled: true }]
      }
    });

    return projects.map((project) => ({
      id: project.id,
      nome: project.name,
      whatsappGroupId: project.whatsappGroupId,
      whatsappAutoReportEnabled: project.whatsappAutoReportEnabled,
      reportEmailRecipients: project.reportEmailRecipients,
      emailAutoReportEnabled: project.emailAutoReportEnabled,
      status: project.status
    }));
  }

  async assignDailyReportNumber(input: { obraId: number; date: string }): Promise<number> {
    // Data normalizada em meia-noite UTC para casar com a coluna DATE.
    const reportDate = new Date(`${input.date}T00:00:00.000Z`);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dailyReportNumber.findUnique({
        where: { projectId_reportDate: { projectId: input.obraId, reportDate } },
        select: { sequence: true }
      });
      if (existing) {
        return existing.sequence;
      }

      const project = await tx.project.findUnique({
        where: { id: input.obraId },
        select: { diaryNextSequence: true }
      });
      const sequence = project?.diaryNextSequence ?? 1;

      await tx.dailyReportNumber.create({
        data: { projectId: input.obraId, reportDate, sequence }
      });
      await tx.project.update({
        where: { id: input.obraId },
        data: { diaryNextSequence: sequence + 1 }
      });

      return sequence;
    });
  }

  async hasProcedureCode(input: { obraId?: number | null; text: string }): Promise<boolean> {
    if (!input.text.trim()) {
      return false;
    }

    const sectorId =
      input.obraId != null
        ? (await this.prisma.project.findUnique({ where: { id: input.obraId }, select: { sectorId: true } }))
            ?.sectorId ?? null
        : null;

    return this.mentions.hasStandardCode(sectorId, input.text);
  }
}

function mapState(state: {
  chatId: string;
  phoneE164: string;
  step: string;
  flowKey?: string | null;
  stepKey?: string | null;
  flowData?: Prisma.JsonValue | null;
  selectedCategory: string | null;
  selectedCompanyId: bigint | null;
  selectedServiceType: string | null;
  selectedProcedureNumber: string | null;
  selectedTrainingTopic?: string | null;
  selectedTrainingParticipants?: string | null;
  selectedTrainingStartsAt?: Date | null;
  selectedTrainingEndsAt?: Date | null;
  selectedTrainingPhotoCount?: number | null;
  pendingEntryId: bigint | null;
  updatedAt?: Date | null;
}): ConversationStateRecord {
  const flowData = normalizeFlowData(state.flowData);

  return {
    chatId: state.chatId,
    phoneE164: state.phoneE164,
    step: state.step as ConversationStateRecord["step"],
    flowKey: state.flowKey ?? null,
    stepKey: state.stepKey ?? state.step,
    flowData,
    selectedTipo: state.selectedCategory ?? stringFromFlowData(flowData.selectedTipo),
    selectedEmpresaId: state.selectedCompanyId ?? bigintFromFlowData(flowData.selectedEmpresaId),
    selectedObraId: numberFromFlowData(flowData.selectedObraId),
    selectedObraNome: stringFromFlowData(flowData.selectedObraNome),
    selectedTipoServico: state.selectedServiceType ?? stringFromFlowData(flowData.selectedTipoServico),
    selectedNumeroProcedimento:
      state.selectedProcedureNumber ?? stringFromFlowData(flowData.selectedNumeroProcedimento),
    selectedTreinamentoTema: state.selectedTrainingTopic ?? stringFromFlowData(flowData.selectedTreinamentoTema),
    selectedTreinamentoParticipantes:
      state.selectedTrainingParticipants ?? stringFromFlowData(flowData.selectedTreinamentoParticipantes),
    selectedTreinamentoInicio:
      state.selectedTrainingStartsAt ?? dateFromFlowData(flowData.selectedTreinamentoInicio),
    selectedTreinamentoFim: state.selectedTrainingEndsAt ?? dateFromFlowData(flowData.selectedTreinamentoFim),
    selectedTrainingPhotoCount:
      state.selectedTrainingPhotoCount ?? numberFromFlowData(flowData.selectedTrainingPhotoCount),
    pendingEntradaId: state.pendingEntryId ?? bigintFromFlowData(flowData.pendingEntradaId),
    updatedAt: state.updatedAt ?? null
  };
}

function toPrismaJson(flowData: ConversationStateRecord["flowData"]): Prisma.InputJsonValue {
  return (flowData ?? {}) as Prisma.InputJsonValue;
}

function normalizeFlowData(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringFromFlowData(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberFromFlowData(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bigintFromFlowData(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

function dateFromFlowData(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
