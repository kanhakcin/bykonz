import type { ConversationStep as PrismaConversationStep, PrismaClient } from "@prisma/client";
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
import { phoneDigitsToBigInt } from "../utils/phone";

export class PrismaConversationStore implements ConversationStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByPhone(phoneDigits: string): Promise<UserRecord | null> {
    const phoneE164 = phoneDigitsToBigInt(phoneDigits);
    if (!phoneE164) {
      return null;
    }

    const user = await this.prisma.usuario.findUnique({
      where: { phoneE164 }
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      phoneE164: user.phoneE164.toString(),
      nome: user.nome
    };
  }

  async findEmpresasByUser(userId: number): Promise<EmpresaRecord[]> {
    const links = await this.prisma.userEmpresa.findMany({
      where: { userId },
      include: { empresa: true },
      orderBy: { empresaId: "asc" }
    });

    return links.map((link) => ({
      id: link.empresa.id,
      nome: link.empresa.nome
    }));
  }

  async getState(chatId: string): Promise<ConversationStateRecord | null> {
    const state = await this.prisma.whatsappConversationState.findUnique({
      where: { chatId }
    });

    return state ? mapState(state) : null;
  }

  async saveState(input: SaveConversationStateInput): Promise<ConversationStateRecord> {
    const state = await this.prisma.whatsappConversationState.upsert({
      where: { chatId: input.chatId },
      create: {
        chatId: input.chatId,
        phoneE164: input.phoneE164,
        step: input.step as PrismaConversationStep,
        selectedTipo: input.selectedTipo ?? null,
        selectedEmpresaId: input.selectedEmpresaId ?? null,
        selectedTipoServico: input.selectedTipoServico ?? null,
        selectedNumeroProcedimento: input.selectedNumeroProcedimento ?? null,
        selectedTreinamentoTema: input.selectedTreinamentoTema ?? null,
        selectedTreinamentoParticipantes: input.selectedTreinamentoParticipantes ?? null,
        selectedTreinamentoInicio: input.selectedTreinamentoInicio ?? null,
        selectedTreinamentoFim: input.selectedTreinamentoFim ?? null,
        selectedTrainingPhotoCount: input.selectedTrainingPhotoCount ?? null,
        pendingEntradaId: input.pendingEntradaId ?? null
      },
      update: {
        phoneE164: input.phoneE164,
        step: input.step as PrismaConversationStep,
        selectedTipo: input.selectedTipo ?? null,
        selectedEmpresaId: input.selectedEmpresaId ?? null,
        selectedTipoServico: input.selectedTipoServico ?? null,
        selectedNumeroProcedimento: input.selectedNumeroProcedimento ?? null,
        selectedTreinamentoTema: input.selectedTreinamentoTema ?? null,
        selectedTreinamentoParticipantes: input.selectedTreinamentoParticipantes ?? null,
        selectedTreinamentoInicio: input.selectedTreinamentoInicio ?? null,
        selectedTreinamentoFim: input.selectedTreinamentoFim ?? null,
        selectedTrainingPhotoCount: input.selectedTrainingPhotoCount ?? null,
        pendingEntradaId: input.pendingEntradaId ?? null
      }
    });

    return mapState(state);
  }

  async clearState(chatId: string): Promise<void> {
    await this.prisma.whatsappConversationState.deleteMany({
      where: { chatId }
    });
  }

  async createEntrada(input: CreateEntradaInput): Promise<{ id: bigint }> {
    const entrada = await this.prisma.entrada.create({
      data: {
        userId: input.userId,
        empresaId: input.empresaId,
        tipo: input.tipo,
        tipoServico: input.tipoServico ?? null,
        numeroProcedimento: input.numeroProcedimento ?? null,
        description: input.description
      },
      select: { id: true }
    });

    return entrada;
  }

  async createTreinamento(input: CreateTreinamentoInput): Promise<{ entradaId: bigint; treinamentoId: number }> {
    return this.prisma.$transaction(async (tx) => {
      const entrada = await tx.entrada.create({
        data: {
          userId: input.userId,
          empresaId: input.empresaId,
          tipo: "Treinamento",
          tipoServico: null,
          numeroProcedimento: null,
          description: ""
        },
        select: { id: true }
      });

      const treinamento = await tx.treinamento.create({
        data: {
          entradaId: entrada.id,
          tema: input.tema,
          participantes: input.participantes,
          inicio: input.inicio,
          fim: input.fim
        },
        select: { id: true }
      });

      return { entradaId: entrada.id, treinamentoId: treinamento.id };
    });
  }

  async addEntradaMedia(input: { entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }): Promise<void> {
    await this.prisma.entradaMedia.create({
      data: {
        entradaId: input.entradaId,
        mediaUrl: input.mediaUrl,
        mediaTipo: input.mediaTipo ?? null
      }
    });
  }

  async updateEntradaDescription(entradaId: bigint, description: string): Promise<void> {
    await this.prisma.entrada.update({
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
    const entradas = await this.prisma.entrada.findMany({
      where: {
        empresaId: input.empresaId,
        tipo: input.tipo,
        createdAt: {
          gte: input.dateStart,
          lt: input.dateEnd
        }
      },
      include: {
        empresa: { select: { nome: true } },
        usuario: { select: { nome: true } },
        media: { select: { mediaUrl: true } },
        treinamento: true
      },
      orderBy: { createdAt: "asc" }
    });

    return entradas.map((e) => ({
      id: e.id,
      description: e.description,
      createdAt: e.createdAt,
      tipo: e.tipo,
      tipoServico: e.tipoServico,
      numeroProcedimento: e.numeroProcedimento,
      treinamentoTema: e.treinamento?.tema ?? null,
      treinamentoParticipantes: e.treinamento?.participantes ?? null,
      treinamentoInicio: e.treinamento?.inicio ?? null,
      treinamentoFim: e.treinamento?.fim ?? null,
      empresaNome: e.empresa?.nome ?? null,
      usuarioNome: e.usuario.nome ?? null,
      mediaUrls: e.media.map((m) => m.mediaUrl)
    }));
  }
}

function mapState(state: {
  chatId: string;
  phoneE164: string;
  step: string;
  selectedTipo: string | null;
  selectedEmpresaId: bigint | null;
  selectedTipoServico: string | null;
  selectedNumeroProcedimento: string | null;
  selectedTreinamentoTema?: string | null;
  selectedTreinamentoParticipantes?: string | null;
  selectedTreinamentoInicio?: Date | null;
  selectedTreinamentoFim?: Date | null;
  selectedTrainingPhotoCount?: number | null;
  pendingEntradaId: bigint | null;
}): ConversationStateRecord {
  return {
    chatId: state.chatId,
    phoneE164: state.phoneE164,
    step: state.step as ConversationStateRecord["step"],
    selectedTipo: state.selectedTipo,
    selectedEmpresaId: state.selectedEmpresaId,
    selectedTipoServico: state.selectedTipoServico,
    selectedNumeroProcedimento: state.selectedNumeroProcedimento,
    selectedTreinamentoTema: state.selectedTreinamentoTema ?? null,
    selectedTreinamentoParticipantes: state.selectedTreinamentoParticipantes ?? null,
    selectedTreinamentoInicio: state.selectedTreinamentoInicio ?? null,
    selectedTreinamentoFim: state.selectedTreinamentoFim ?? null,
    selectedTrainingPhotoCount: state.selectedTrainingPhotoCount ?? null,
    pendingEntradaId: state.pendingEntradaId
  };
}
