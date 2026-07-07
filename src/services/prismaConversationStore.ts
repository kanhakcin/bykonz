import type { ConversationStep as PrismaConversationStep, Prisma, PrismaClient } from "@prisma/client";
import type {
  ConversationStateRecord,
  ConversationStore,
  CreateEntradaInput,
  CreateTreinamentoInput,
  EmpresaRecord,
  EntradaForReport,
  ObraForReport,
  ObraRecord,
  SaveConversationStateInput,
  UserRecord
} from "./conversationService";
import { extractCodeMentions, type ParsedEntityType } from "./mentionParser";
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
    await this.identifyMentions(entry.id, sectorId, scanText);

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
    await this.identifyMentions(entry.id, entry.sectorId, scanText);
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

  async findObraById(obraId: number): Promise<ObraForReport | null> {
    const project = await this.prisma.project.findUnique({ where: { id: obraId } });
    if (!project) {
      return null;
    }

    return {
      id: project.id,
      nome: project.name,
      whatsappGroupId: project.whatsappGroupId,
      whatsappAutoReportEnabled: project.whatsappAutoReportEnabled,
      status: project.status
    };
  }

  async findObrasForAutoReport(): Promise<ObraForReport[]> {
    const projects = await this.prisma.project.findMany({
      where: { status: "ACTIVE", whatsappAutoReportEnabled: true }
    });

    return projects.map((project) => ({
      id: project.id,
      nome: project.name,
      whatsappGroupId: project.whatsappGroupId,
      whatsappAutoReportEnabled: project.whatsappAutoReportEnabled,
      status: project.status
    }));
  }

  /**
   * Pipeline de identificação, etapa [1] (determinística) — extrai códigos
   * entre parênteses da legenda, resolve pela tabela de prefixos do setor e
   * grava EntryMention + Alert conforme docs/arquitetura-dados-nova-versao-v1.md §5-6.
   * Idempotente por (entryId, code): reprocessar a mesma entrada não duplica.
   */
  private async identifyMentions(entryId: bigint, sectorId: number | null, text: string): Promise<void> {
    if (!text.trim()) {
      return;
    }

    const prefixRows = await this.prisma.codePrefix.findMany({
      where: { OR: [{ sectorId: null }, { sectorId: sectorId ?? undefined }] }
    });
    // Prefixo específico do setor tem prioridade sobre o global de mesmo nome.
    const prefixMap = new Map<string, { entityType: ParsedEntityType }>();
    for (const row of prefixRows.sort((a, b) => (a.sectorId == null ? -1 : 1) - (b.sectorId == null ? -1 : 1))) {
      prefixMap.set(row.prefix.toUpperCase(), { entityType: row.entityType as ParsedEntityType });
    }

    const mentions = extractCodeMentions(text, prefixMap);
    if (mentions.length === 0) {
      return;
    }

    const existing = await this.prisma.entryMention.findMany({
      where: { entryId },
      select: { matchedText: true }
    });
    const alreadyLinked = new Set(existing.map((m) => m.matchedText));

    // STANDARD primeiro: checkPersonTraining depende da norma já estar
    // resolvida na mesma entrada, independente da ordem no texto.
    const ordered = [...mentions].sort((a, b) => (a.entityType === "STANDARD" ? -1 : 1) - (b.entityType === "STANDARD" ? -1 : 1));

    for (const mention of ordered) {
      if (alreadyLinked.has(mention.matchedText)) {
        continue;
      }

      const entityId = sectorId != null ? await this.resolveEntityId(mention.entityType, sectorId, mention.code) : null;

      const created = await this.prisma.entryMention.create({
        data: {
          entryId,
          entityType: mention.entityType,
          entityId,
          source: "CODE",
          matchedText: mention.matchedText,
          confirmed: entityId != null
        }
      });

      await this.applyAlertRule(entryId, created.id, mention, entityId);
    }
  }

  private async resolveEntityId(entityType: ParsedEntityType, sectorId: number, code: string): Promise<number | null> {
    switch (entityType) {
      case "STANDARD": {
        const standard = await this.prisma.standard.findUnique({
          where: { sectorId_code: { sectorId, code } },
          select: { id: true }
        });
        return standard?.id ?? null;
      }
      case "MACHINE": {
        const machine = await this.prisma.machine.findUnique({
          where: { sectorId_code: { sectorId, code } },
          select: { id: true }
        });
        return machine?.id ?? null;
      }
      case "PERSON": {
        const person = await this.prisma.person.findUnique({
          where: { sectorId_registrationCode: { sectorId, registrationCode: code } },
          select: { id: true }
        });
        return person?.id ?? null;
      }
      case "ASSET": {
        const asset = await this.prisma.asset.findFirst({
          where: { sectorId, code },
          select: { id: true }
        });
        return asset?.id ?? null;
      }
      default:
        return null;
    }
  }

  /** docs/arquitetura-dados-nova-versao-v1.md §6 — motor de alertas (snapshot no momento do registro). */
  private async applyAlertRule(
    entryId: bigint,
    mentionId: number,
    mention: { entityType: ParsedEntityType; code: string },
    entityId: number | null
  ): Promise<void> {
    if (entityId == null) {
      if (mention.entityType === "STANDARD") {
        await this.prisma.alert.create({
          data: {
            entryId,
            mentionId,
            type: "STANDARD_NOT_FOUND",
            severity: "WARNING",
            title: `Norma ${mention.code} não encontrada`,
            detail: `Código citado no registro não corresponde a nenhuma norma cadastrada.`
          }
        });
      }
      return;
    }

    if (mention.entityType === "MACHINE") {
      await this.applyMachineAlert(entryId, mentionId, entityId);
    }
    // PERSON_NOT_TRAINED depende da norma também citada na mesma entrada —
    // ver checkPersonTraining, chamado depois que todas as menções da
    // entrada foram resolvidas (identifyMentions processa uma por vez, mas
    // a normal e a pessoa costumam estar na mesma legenda).
    if (mention.entityType === "PERSON") {
      await this.checkPersonTraining(entryId, mentionId, entityId);
    }
  }

  private async applyMachineAlert(entryId: bigint, mentionId: number, machineId: number): Promise<void> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: { code: true }
    });
    if (!machine) {
      return;
    }

    const lastInspection = await this.prisma.machineInspection.findFirst({
      where: { machineId },
      orderBy: { inspectedAt: "desc" }
    });

    if (!lastInspection || lastInspection.result === "REJECTED") {
      await this.prisma.alert.create({
        data: {
          entryId,
          mentionId,
          type: "MACHINE_NO_INSPECTION",
          severity: "CRITICAL",
          title: `Máquina ${machine.code} sem vistoria válida`,
          detail: lastInspection ? "Última vistoria foi reprovada." : "Nenhuma vistoria registrada."
        }
      });
      return;
    }

    if (lastInspection.validUntil && lastInspection.validUntil.getTime() < Date.now()) {
      await this.prisma.alert.create({
        data: {
          entryId,
          mentionId,
          type: "MACHINE_INSPECTION_EXPIRED",
          severity: "CRITICAL",
          title: `Máquina ${machine.code} — vistoria vencida`,
          detail: `Última vistoria válida até ${lastInspection.validUntil.toLocaleDateString("pt-BR")}.`
        }
      });
    }
  }

  private async checkPersonTraining(entryId: bigint, mentionId: number, personId: number): Promise<void> {
    // A norma exigida é a outra menção STANDARD já resolvida na mesma entrada.
    const standardMention = await this.prisma.entryMention.findFirst({
      where: { entryId, entityType: "STANDARD", entityId: { not: null } },
      select: { entityId: true }
    });
    if (!standardMention?.entityId) {
      return;
    }

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { name: true, registrationCode: true }
    });
    if (!person) {
      return;
    }

    const competency = await this.prisma.competency.findUnique({
      where: { personId_standardId: { personId, standardId: standardMention.entityId } }
    });

    const isTrained =
      competency?.status === "TRAINED" && (!competency.validUntil || competency.validUntil.getTime() >= Date.now());

    if (!isTrained) {
      const standard = await this.prisma.standard.findUnique({
        where: { id: standardMention.entityId },
        select: { code: true }
      });

      await this.prisma.alert.create({
        data: {
          entryId,
          mentionId,
          type: "PERSON_NOT_TRAINED",
          severity: "WARNING",
          title: `${person.name} não treinado`,
          detail: standard ? `Competência ausente ou vencida para a norma ${standard.code}.` : null
        }
      });
    }
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
