import type { ConversationStep as PrismaConversationStep, PrismaClient } from "@prisma/client";
import type {
  ConversationStateRecord,
  ConversationStore,
  CreateEntradaInput,
  EmpresaRecord,
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
        pendingEntradaId: input.pendingEntradaId ?? null
      },
      update: {
        phoneE164: input.phoneE164,
        step: input.step as PrismaConversationStep,
        selectedTipo: input.selectedTipo ?? null,
        selectedEmpresaId: input.selectedEmpresaId ?? null,
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
        description: input.description
      },
      select: { id: true }
    });

    return entrada;
  }

  async addEntradaMedia(input: { entradaId: bigint; mediaUrl: string }): Promise<void> {
    await this.prisma.entradaMedia.create({
      data: {
        entradaId: input.entradaId,
        mediaUrl: input.mediaUrl
      }
    });
  }

  async updateEntradaDescription(entradaId: bigint, description: string): Promise<void> {
    await this.prisma.entrada.update({
      where: { id: entradaId },
      data: { description }
    });
  }
}

function mapState(state: {
  chatId: string;
  phoneE164: string;
  step: string;
  selectedTipo: string | null;
  selectedEmpresaId: bigint | null;
  pendingEntradaId: bigint | null;
}): ConversationStateRecord {
  return {
    chatId: state.chatId,
    phoneE164: state.phoneE164,
    step: state.step as ConversationStateRecord["step"],
    selectedTipo: state.selectedTipo,
    selectedEmpresaId: state.selectedEmpresaId,
    pendingEntradaId: state.pendingEntradaId
  };
}
