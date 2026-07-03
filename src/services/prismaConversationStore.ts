import type { ConversationStep as PrismaConversationStep, Prisma, PrismaClient } from "@prisma/client";
import type {
  ConversationStateRecord,
  ConversationStore,
  CreateEntradaInput,
  CreateTreinamentoInput,
  EmpresaRecord,
  EntradaForReport,
  SaveConversationStateInput,
  UserRecord
} from "./conversationService";
import { phoneDigitsToE164 } from "../utils/phone";

/**
 * Adapter do port ConversationStore para o schema em inglês (tabelas
 * snake_case plural). As formas dos records do domínio (em português,
 * definidas em src/flows/types.ts) são preservadas — a tradução de nomes
 * acontece somente aqui.
 */
export class PrismaConversationStore implements ConversationStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByPhone(phoneDigits: string): Promise<UserRecord | null> {
    const phoneE164 = phoneDigitsToE164(phoneDigits);
    if (!phoneE164) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { phoneE164 }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      phoneE164: user.phoneE164.replace(/^\+/, ""),
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
    const entry = await this.prisma.entry.create({
      data: {
        userId: input.userId,
        companyId: input.empresaId,
        category: input.tipo,
        serviceType: input.tipoServico ?? null,
        procedureNumber: input.numeroProcedimento ?? null,
        description: input.description
      },
      select: { id: true }
    });

    return entry;
  }

  async createTreinamento(input: CreateTreinamentoInput): Promise<{ entradaId: bigint; treinamentoId: number }> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          userId: input.userId,
          companyId: input.empresaId,
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
    await this.prisma.entry.update({
      where: { id: entradaId },
      data: { description }
    });
  }

  async findEntradasForReport(input: {
    empresaId: bigint;
    tipo: string;
    dateStart: Date;
    dateEnd: Date;
  }): Promise<EntradaForReport[]> {
    const entries = await this.prisma.entry.findMany({
      where: {
        companyId: input.empresaId,
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
    pendingEntradaId: state.pendingEntryId ?? bigintFromFlowData(flowData.pendingEntradaId)
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
