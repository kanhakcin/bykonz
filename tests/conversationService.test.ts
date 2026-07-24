import { describe, expect, it, vi } from "vitest";
import {
  ConversationService,
  type ConversationStateRecord,
  type ConversationStore,
  type CreateEntradaInput,
  type CreateTreinamentoInput,
  type EmpresaRecord,
  type EntradaForGroupForward,
  type EntradaForReport,
  type MessagingClient,
  type NormaRecord,
  type ObjectStorage,
  type ObraForReport,
  type ObraRecord,
  type DailyReportInput,
  type PdfGenerator,
  type ReportInput,
  type UserRecord
} from "../src/services/conversationService";
import { DailyReportService } from "../src/services/dailyReportService";
import type { WahaWebhook } from "../src/types/waha";
import { wahaWebhookToIncomingMessage } from "../src/channels/waha/inbound";

/**
 * Roteia um webhook WAHA cru pelo adapter de entrada (borda) antes de entregar
 * ao ConversationService — espelha o que a rota /webhooks/waha faz: quando o
 * adapter devolve null (evento não suportado, grupo, fromMe), nada é entregue.
 */
async function deliverWaha(service: ConversationService, webhook: WahaWebhook): Promise<void> {
  const message = wahaWebhookToIncomingMessage(webhook);
  if (message) {
    await service.handleWebhook(message);
  }
}

const CHAT_ID = "5511999999999@c.us";
const PHONE = "5511999999999";
const PHONE_WITHOUT_NINTH = "551199999999";
const REPORTED_PHONE_WITH_NINTH = "5547996222708";
const REPORTED_PHONE_WITHOUT_NINTH = "554799720053";
const CONSULTA_ACTION_MENU_CATEGORY_OPTIONS = [
  ["2", "Abrir nao conformidade"],
  ["3", "Recebimento de material"],
  ["4", "Plano de manutencao"],
  ["5", "Programa sol"]
] as const;

class FakeStore implements ConversationStore {
  users = new Map<string, UserRecord>();
  empresasByUser = new Map<number, EmpresaRecord[]>();
  obras: ObraRecord[] = [{ id: 1, nome: "Obra Residencial Aurora", codigo: "AUR" }];
  normasByObra = new Map<number, NormaRecord[]>([
    [
      1,
      [
        { code: "PS-008", title: "Execução de alvenaria tradicional" },
        { code: "PS-031", title: "Impermeabilização de lajes" },
        { code: "PS-045", title: "Concretagem de estruturas" }
      ]
    ]
  ]);
  states = new Map<string, ConversationStateRecord>();
  entradas: Array<CreateEntradaInput & { id: bigint }> = [];
  treinamentos: Array<CreateTreinamentoInput & { id: number; entradaId: bigint }> = [];
  media: Array<{ entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }> = [];
  reportEntradas: EntradaForReport[] = [];
  obrasForReport: ObraForReport[] = [];
  diaryNextSequenceByObra = new Map<number, number>();
  assignedDailyNumbers = new Map<string, number>();

  usersByTelegramId = new Map<string, UserRecord>();

  async findUserByPhone(phoneDigits: string): Promise<UserRecord | null> {
    return this.users.get(phoneDigits) ?? null;
  }

  async findUserByTelegramId(telegramUserId: string): Promise<UserRecord | null> {
    return this.usersByTelegramId.get(telegramUserId) ?? null;
  }

  async linkTelegramIdByPhone(input: {
    phoneCandidates: string[];
    telegramUserId: string;
  }): Promise<{ user: UserRecord | null; alreadyLinked: boolean }> {
    for (const candidate of input.phoneCandidates) {
      const user = this.users.get(candidate);
      if (!user) {
        continue;
      }
      if (user.telegramUserId && user.telegramUserId !== input.telegramUserId) {
        return { user: null, alreadyLinked: true };
      }
      const linked = { ...user, telegramUserId: input.telegramUserId };
      this.users.set(candidate, linked);
      this.usersByTelegramId.set(input.telegramUserId, linked);
      return { user: linked, alreadyLinked: false };
    }
    return { user: null, alreadyLinked: false };
  }

  async findEmpresasByUser(userId: number): Promise<EmpresaRecord[]> {
    return this.empresasByUser.get(userId) ?? [];
  }

  async findObrasAtivas(): Promise<ObraRecord[]> {
    return this.obras;
  }

  async findNormasForObra(obraId: number): Promise<NormaRecord[]> {
    return this.normasByObra.get(obraId) ?? [];
  }

  async getState(chatId: string): Promise<ConversationStateRecord | null> {
    return this.states.get(chatId) ?? null;
  }

  async saveState(input: ConversationStateRecord): Promise<ConversationStateRecord> {
    this.states.set(input.chatId, input);
    return input;
  }

  async clearState(chatId: string): Promise<void> {
    this.states.delete(chatId);
  }

  async createEntrada(input: CreateEntradaInput): Promise<{ id: bigint }> {
    const entrada = { ...input, id: BigInt(this.entradas.length + 1) };
    this.entradas.push(entrada);
    return { id: entrada.id };
  }

  async createTreinamento(input: CreateTreinamentoInput): Promise<{ entradaId: bigint; treinamentoId: number }> {
    const entrada = {
      userId: input.userId,
      empresaId: input.empresaId,
      tipo: "Treinamento" as const,
      tipoServico: null,
      numeroProcedimento: null,
      description: "",
      id: BigInt(this.entradas.length + 1)
    };
    const treinamento = {
      ...input,
      id: this.treinamentos.length + 1,
      entradaId: entrada.id
    };

    this.entradas.push(entrada);
    this.treinamentos.push(treinamento);
    return { entradaId: entrada.id, treinamentoId: treinamento.id };
  }

  async addEntradaMedia(input: { entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }): Promise<void> {
    this.media.push(input);
  }

  async updateEntradaDescription(entradaId: bigint, description: string): Promise<void> {
    const entrada = this.entradas.find((item) => item.id === entradaId);
    if (entrada) {
      entrada.description = description;
    }
  }

  async updateEntradaProcedureNumber(entradaId: bigint, numeroProcedimento: string): Promise<void> {
    const entrada = this.entradas.find((item) => item.id === entradaId);
    if (entrada) {
      entrada.numeroProcedimento = numeroProcedimento;
    }
  }

  /** Regex simples só para testes: considera que há procedimento se casar um código tipo PS-031. */
  async hasProcedureCode(input: { obraId?: number | null; text: string }): Promise<boolean> {
    return /\b[A-Za-z]+-\d+\b/.test(input.text) || /\([A-Za-z]+-?\d+\)/.test(input.text);
  }

  async findEntradasForReport(_input: {
    empresaId: bigint;
    obraId?: number | null;
    tipo: string;
    dateStart: Date;
    dateEnd: Date;
  }): Promise<EntradaForReport[]> {
    return this.reportEntradas;
  }

  async findEntradasForObraDay(_input: { obraId: number; dateStart: Date; dateEnd: Date }): Promise<EntradaForReport[]> {
    return this.reportEntradas;
  }

  async findEntradaForGroupForward(entradaId: bigint): Promise<EntradaForGroupForward | null> {
    const entrada = this.entradas.find((e) => e.id === entradaId);
    if (!entrada) {
      return null;
    }
    const usuario = [...this.users.values()].find((u) => u.id === entrada.userId) ?? null;
    return {
      description: entrada.description,
      tipoServico: entrada.tipoServico ?? null,
      numeroProcedimento: entrada.numeroProcedimento ?? null,
      usuarioNome: usuario?.nome ?? null,
      mediaUrls: this.media.filter((m) => m.entradaId === entradaId).map((m) => m.mediaUrl)
    };
  }

  async findObraById(obraId: number): Promise<ObraForReport | null> {
    return this.obrasForReport.find((obra) => obra.id === obraId) ?? null;
  }

  async findObrasForAutoReport(): Promise<ObraForReport[]> {
    return this.obrasForReport.filter((obra) => obra.status === "ACTIVE" && obra.whatsappAutoReportEnabled);
  }

  async assignDailyReportNumber(input: { obraId: number; date: string }): Promise<number> {
    const key = `${input.obraId}:${input.date}`;
    const existing = this.assignedDailyNumbers.get(key);
    if (existing != null) {
      return existing;
    }
    const next = this.diaryNextSequenceByObra.get(input.obraId) ?? 1;
    this.assignedDailyNumbers.set(key, next);
    this.diaryNextSequenceByObra.set(input.obraId, next + 1);
    return next;
  }
}

class FakeMessaging implements MessagingClient {
  messages: Array<{ chatId: string; text: string }> = [];
  files: Array<{ chatId: string; file: { mimetype: string; filename: string; data: string }; caption?: string }> = [];

  async sendText(chatId: string, text: string): Promise<void> {
    this.messages.push({ chatId, text });
  }

  async sendFile(
    chatId: string,
    file: { mimetype: string; filename: string; data: string },
    caption?: string
  ): Promise<void> {
    this.files.push({ chatId, file, caption });
  }
}

class FakeStorage implements ObjectStorage {
  uploads: Array<{ path: string; body: Buffer; contentType: string }> = [];

  async uploadPrivateObject(input: { path: string; body: Buffer; contentType: string }): Promise<void> {
    this.uploads.push(input);
  }

  async downloadPrivateObject(_path: string): Promise<Buffer> {
    return Buffer.from("fake-download");
  }
}

class FakePdfGenerator implements PdfGenerator {
  calls: ReportInput[] = [];
  dailyCalls: DailyReportInput[] = [];

  async generateReport(input: ReportInput): Promise<Buffer> {
    this.calls.push(input);
    return Buffer.from("%PDF-1.4 fake");
  }

  async generateDailyReport(input: DailyReportInput): Promise<Buffer> {
    this.dailyCalls.push(input);
    return Buffer.from("%PDF-1.4 fake");
  }
}

function createHarness(overrides: { download?: () => Promise<Buffer> } = {}) {
  const store = new FakeStore();
  const messaging = new FakeMessaging();
  const storage = new FakeStorage();
  const pdfGenerator = new FakePdfGenerator();
  const service = new ConversationService({
    store,
    messaging,
    mediaDownloader: {
      download: overrides.download ?? (async () => Buffer.from("fake-image"))
    },
    objectStorage: storage,
    pdfGenerator,
    // Mesmo serviço usado pelo painel: menu 7 gera o PDF do diário do dia.
    dailyReport: new DailyReportService(store, pdfGenerator)
  });

  store.users.set(PHONE, { id: 7, phoneE164: PHONE, nome: "Usuario Teste" });

  return { service, store, messaging, storage, pdfGenerator };
}

function textWebhook(body: string, chatId = CHAT_ID): WahaWebhook {
  return {
    event: "message",
    session: "default",
    payload: {
      id: `msg-${body}`,
      from: chatId,
      body,
      hasMedia: false
    }
  };
}

function photoWebhook(id = "photo-1", filename = "foto.jpg", caption = ""): WahaWebhook {
  return {
    event: "message",
    session: "default",
    payload: {
      id,
      from: CHAT_ID,
      body: caption,
      hasMedia: true,
      media: {
        url: `http://waha.local/api/files/${filename}`,
        mimetype: "image/jpeg",
        filename
      }
    }
  };
}

function fileWebhook(): WahaWebhook {
  return {
    event: "message",
    session: "default",
    payload: {
      id: "file-1",
      from: CHAT_ID,
      body: "",
      hasMedia: true,
      media: {
        url: "http://waha.local/api/files/treinamento.pdf",
        mimetype: "application/pdf",
        filename: "treinamento.pdf"
      }
    }
  };
}

describe("ConversationService", () => {
  it("starts known users at the main menu", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));

    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("1) Inspecao de servico");
    expect(messaging.messages.at(-1)?.text).toContain("6) Treinamento");
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("stays in standby for group chats — no reply, no state created", async () => {
    const { service, store, messaging } = createHarness();
    const groupChatId = "120363012345678901@g.us";

    await deliverWaha(service, textWebhook("oi", groupChatId));

    expect(messaging.messages).toHaveLength(0);
    expect(store.states.get(groupChatId)).toBeUndefined();
  });

  it("uses nested WAHA SenderAlt fields for phone lookup when from is a lid", async () => {
    const { service, store, messaging } = createHarness();
    const lidChatId = "999999999999999@lid";

    await deliverWaha(service, {
      event: "message",
      session: "default",
      payload: {
        id: "msg-lid",
        from: lidChatId,
        body: "oi",
        hasMedia: false,
        _data: {
          Info: {
            SenderAlt: `${PHONE}@whatsapp.net.us`
          }
        }
      }
    });

    expect(store.states.get(lidChatId)).toMatchObject({
      phoneE164: PHONE,
      step: "MAIN_MENU"
    });
    expect(messaging.messages.at(-1)).toMatchObject({
      chatId: lidChatId,
      text: expect.stringContaining("7) Gerar diario de obra")
    });
  });

  it("matches a database user stored with the ninth digit when WAHA omits it", async () => {
    const { service, store, messaging } = createHarness();
    const shortChatId = `${PHONE_WITHOUT_NINTH}@c.us`;

    await deliverWaha(service, textWebhook("oi", shortChatId));

    expect(store.states.get(shortChatId)).toMatchObject({
      phoneE164: PHONE,
      step: "MAIN_MENU"
    });
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("matches a database user stored without the ninth digit when WAHA includes it", async () => {
    const { service, store, messaging } = createHarness();
    store.users.clear();
    store.users.set(PHONE_WITHOUT_NINTH, {
      id: 8,
      phoneE164: PHONE_WITHOUT_NINTH,
      nome: "Usuario Sem Nono Digito"
    });

    await deliverWaha(service, textWebhook("oi"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      phoneE164: PHONE_WITHOUT_NINTH,
      step: "MAIN_MENU"
    });
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("keeps the exact WAHA phone match when both Brazilian variants exist", async () => {
    const { service, store } = createHarness();
    const shortChatId = `${PHONE_WITHOUT_NINTH}@c.us`;
    store.users.set(PHONE_WITHOUT_NINTH, {
      id: 8,
      phoneE164: PHONE_WITHOUT_NINTH,
      nome: "Usuario Exato"
    });

    await deliverWaha(service, textWebhook("oi", shortChatId));

    expect(store.states.get(shortChatId)).toMatchObject({
      phoneE164: PHONE_WITHOUT_NINTH,
      step: "MAIN_MENU"
    });
  });

  it("starts the flow for a reported stored number when WAHA includes a device suffix", async () => {
    const { service, store, messaging } = createHarness();
    const deviceChatId = `${REPORTED_PHONE_WITH_NINTH}:12@c.us`;
    store.users.clear();
    store.users.set(REPORTED_PHONE_WITH_NINTH, {
      id: 9,
      phoneE164: REPORTED_PHONE_WITH_NINTH,
      nome: "Usuario Com Sufixo"
    });

    await deliverWaha(service, textWebhook("oi", deviceChatId));

    expect(store.states.get(deviceChatId)).toMatchObject({
      phoneE164: REPORTED_PHONE_WITH_NINTH,
      step: "MAIN_MENU"
    });
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("starts the flow for a reported shorter stored number when WAHA includes a device suffix", async () => {
    const { service, store, messaging } = createHarness();
    const deviceChatId = `${REPORTED_PHONE_WITHOUT_NINTH}:3@s.whatsapp.net`;
    store.users.clear();
    store.users.set(REPORTED_PHONE_WITHOUT_NINTH, {
      id: 10,
      phoneE164: REPORTED_PHONE_WITHOUT_NINTH,
      nome: "Usuario Sem Nono Digito Com Sufixo"
    });

    await deliverWaha(service, textWebhook("oi", deviceChatId));

    expect(store.states.get(deviceChatId)).toMatchObject({
      phoneE164: REPORTED_PHONE_WITHOUT_NINTH,
      step: "MAIN_MENU"
    });
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("writes opt-in WAHA debug logs for successful lookups", async () => {
    const { service } = createHarness();
    const previousDebugLogs = process.env.WAHA_DEBUG_LOGS;
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    process.env.WAHA_DEBUG_LOGS = "1";

    try {
      await deliverWaha(service, textWebhook("oi"));

      expect(infoSpy).toHaveBeenCalledWith(
        "channel message received",
        expect.objectContaining({
          channel: "whatsapp",
          chatId: CHAT_ID,
          identityKind: "phone"
        })
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "channel identity matched registered user",
        expect.objectContaining({
          channel: "whatsapp",
          chatId: CHAT_ID,
          matchedPhoneE164: PHONE,
          userId: 7
        })
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "conversation state loaded",
        expect.objectContaining({
          chatId: CHAT_ID,
          stateStep: null,
          textLength: 2
        })
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "conversation state created",
        expect.objectContaining({
          chatId: CHAT_ID,
          step: "MAIN_MENU"
        })
      );
    } finally {
      if (previousDebugLogs === undefined) {
        delete process.env.WAHA_DEBUG_LOGS;
      } else {
        process.env.WAHA_DEBUG_LOGS = previousDebugLogs;
      }
      infoSpy.mockRestore();
    }
  });

  it("rejects unknown users", async () => {
    const { service, store, messaging } = createHarness();
    const previousDebugLogs = process.env.WAHA_DEBUG_LOGS;
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    process.env.WAHA_DEBUG_LOGS = "1";

    try {
      await deliverWaha(service, textWebhook("oi", "5511888888888@c.us"));
      expect(messaging.messages.at(-1)?.text).toContain("Numero nao cadastrado");
      // Sem match: nenhum estado de conversa é criado.
      expect(store.states.get("5511888888888@c.us")).toBeUndefined();
      expect(infoSpy).toHaveBeenCalledWith(
        "channel identity did not match a registered user",
        expect.objectContaining({
          channel: "whatsapp",
          chatId: "5511888888888@c.us",
          identityKind: "phone",
          identityValue: "5511888888888"
        })
      );
    } finally {
      if (previousDebugLogs === undefined) {
        delete process.env.WAHA_DEBUG_LOGS;
      } else {
        process.env.WAHA_DEBUG_LOGS = previousDebugLogs;
      }
      infoSpy.mockRestore();
    }
  });

  it.each(CONSULTA_ACTION_MENU_CATEGORY_OPTIONS)(
    "selects %s as %s and shows the consulta/incluir action menu",
    async (option, tipo) => {
      const { service, store, messaging } = createHarness();

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook(option));

      expect(store.states.get(CHAT_ID)).toMatchObject({
        step: "ACTION_MENU",
        selectedTipo: tipo
      });
      expect(messaging.messages.at(-1)?.text).toContain(tipo);
      expect(messaging.messages.at(-1)?.text).toContain("1) Consulta");
      expect(messaging.messages.at(-1)?.text).toContain("2) Incluir");
    }
  );

  it("selects Inspecao de servico and shows only the Incluir action", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "ACTION_MENU",
      selectedTipo: "Inspecao de servico"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Inspecao de servico");
    expect(messaging.messages.at(-1)?.text).toContain("1) Incluir");
    expect(messaging.messages.at(-1)?.text).not.toContain("Consulta");
    expect(messaging.messages.at(-1)?.text).not.toContain("2) Incluir");
  });

  it("goes straight to the main menu on the first message when there is only one obra", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "MAIN_MENU",
      flowKey: "diario-das-obras",
      stepKey: "MAIN_MENU",
      selectedObraId: 1,
      selectedObraNome: "Obra Residencial Aurora"
    });
    expect(messaging.messages).toHaveLength(1);
    expect(messaging.messages.at(-1)?.text).toContain("O que voce quer fazer agora?");
  });

  it("routes a main-menu selection right after the obra is auto-selected", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("6"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_TEMA",
      flowKey: "diario-das-obras",
      stepKey: "AWAITING_TRAINING_TEMA",
      selectedTipo: "Treinamento",
      selectedEmpresaId: 10n,
      flowData: expect.objectContaining({
        selectedTipo: "Treinamento",
        selectedEmpresaId: "10"
      })
    });
    expect(messaging.messages.at(-1)?.text).toContain("tema do treinamento");
  });

  it("routes the Gerar diario de obra selection straight to the date prompt", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("7"));

    // Diário cobre a obra toda: não pede empresa nem tipo.
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_REPORT_DATE",
      flowKey: "diario-das-obras",
      stepKey: "AWAITING_DIARIO_OBRA_DATE",
      selectedTipo: null,
      selectedEmpresaId: null,
      selectedObraId: 1
    });
    expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA");
  });

  it("resumes DiarioDasObras using generic flowKey, stepKey, and flowData", async () => {
    const { service, store, messaging } = createHarness();
    store.states.set(CHAT_ID, {
      chatId: CHAT_ID,
      phoneE164: PHONE,
      step: "MAIN_MENU",
      flowKey: "diario-das-obras",
      stepKey: "AWAITING_TRAINING_TEMA",
      flowData: {
        selectedTipo: "Treinamento",
        selectedEmpresaId: "10",
        selectedObraId: 1,
        selectedObraNome: "Obra Residencial Aurora"
      },
      selectedTipo: null,
      selectedEmpresaId: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      selectedTreinamentoTema: null,
      selectedTreinamentoParticipantes: null,
      selectedTreinamentoInicio: null,
      selectedTreinamentoFim: null,
      selectedTrainingPhotoCount: null,
      pendingEntradaId: null
    });

    await deliverWaha(service, textWebhook("NR-18 Canteiro de obras"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_PARTICIPANTS",
      flowKey: "diario-das-obras",
      stepKey: "AWAITING_TRAINING_PARTICIPANTS",
      selectedTreinamentoTema: "NR-18 Canteiro de obras",
      flowData: expect.objectContaining({
        selectedTipo: "Treinamento",
        selectedEmpresaId: "10",
        selectedTreinamentoTema: "NR-18 Canteiro de obras"
      })
    });
    expect(messaging.messages.at(-1)?.text).toContain("nomes e CPFs");
  });

  it("runs the Treinamento flow with tema, participants, dates, photos, and file upload", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("6"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_TEMA",
      selectedTipo: "Treinamento",
      selectedEmpresaId: 10n
    });
    expect(messaging.messages.at(-1)?.text).toContain("tema do treinamento");

    await deliverWaha(service, textWebhook("NR-35 Trabalho em altura"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_PARTICIPANTS",
      selectedTreinamentoTema: "NR-35 Trabalho em altura"
    });
    expect(messaging.messages.at(-1)?.text).toContain("nomes e CPFs");

    await deliverWaha(service, textWebhook("Ana Silva - 123.456.789-00\nBruno Souza - 987.654.321-00"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_DATES",
      selectedTreinamentoParticipantes: "Ana Silva - 123.456.789-00\nBruno Souza - 987.654.321-00"
    });
    expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA HH:mm");

    await deliverWaha(service, textWebhook("25/06/2026 08:00 - 25/06/2026 10:30"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_PHOTO",
      pendingEntradaId: 1n,
      selectedTrainingPhotoCount: 0
    });
    expect(store.treinamentos).toMatchObject([
      {
        entradaId: 1n,
        tema: "NR-35 Trabalho em altura",
        participantes: "Ana Silva - 123.456.789-00\nBruno Souza - 987.654.321-00",
        inicio: new Date("2026-06-25T11:00:00.000Z"),
        fim: new Date("2026-06-25T13:30:00.000Z")
      }
    ]);
    expect(messaging.messages.at(-1)?.text).toContain("fotos do treinamento");

    await deliverWaha(service, photoWebhook());
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_PHOTO",
      selectedTrainingPhotoCount: 1
    });
    expect(storage.uploads).toHaveLength(1);
    expect(store.media[0]).toMatchObject({
      entradaId: 1n,
      mediaUrl: storage.uploads[0].path,
      mediaTipo: "treinamento_foto"
    });

    await deliverWaha(service, textWebhook("OK"));
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_TRAINING_FILE");
    expect(messaging.messages.at(-1)?.text).toContain("PDF ou foto");

    await deliverWaha(service, fileWebhook());

    expect(storage.uploads).toHaveLength(2);
    expect(storage.uploads[1]).toMatchObject({
      contentType: "application/pdf"
    });
    expect(storage.uploads[1].path).toMatch(/\.pdf$/);
    expect(store.media[1]).toMatchObject({
      entradaId: 1n,
      mediaUrl: storage.uploads[1].path,
      mediaTipo: "treinamento_arquivo"
    });
    expect(store.entradas[0]).toMatchObject({
      userId: 7,
      empresaId: 10n,
      tipo: "Treinamento",
      description: ""
    });
    expect(store.states.has(CHAT_ID)).toBe(false);
    expect(messaging.messages.at(-1)?.text).toContain("Treinamento registrado");
  });

  it("asks users with multiple companies to choose one before the Treinamento details", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [
      { id: 10n, nome: "Obra Centro" },
      { id: 20n, nome: "Obra Sul" }
    ]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("6"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "SELECT_EMPRESA_FOR_TRAINING",
      selectedTipo: "Treinamento"
    });
    expect(messaging.messages.at(-1)?.text).toContain("2) Obra Sul");

    await deliverWaha(service, textWebhook("2"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_TEMA",
      selectedEmpresaId: 20n
    });
    expect(messaging.messages.at(-1)?.text).toContain("tema do treinamento");
  });

  it("re-prompts when Treinamento dates are invalid", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("6"));
    await deliverWaha(service, textWebhook("NR-35 Trabalho em altura"));
    await deliverWaha(service, textWebhook("Ana Silva - 123.456.789-00"));
    await deliverWaha(service, textWebhook("25/06/2026 10:30 - 25/06/2026 08:00"));

    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_TRAINING_DATES");
    expect(store.treinamentos).toHaveLength(0);
    expect(messaging.messages.at(-1)?.text).toContain("Não entendi essa data");
  });

  it("re-shows the main menu after an invalid category", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("8"));

    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("Não entendi");
  });

  it("re-shows the include-only action menu after an invalid Inspecao action", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("9"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "ACTION_MENU",
      selectedTipo: "Inspecao de servico"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Não entendi");
    expect(messaging.messages.at(-1)?.text).not.toContain("Consulta");
  });

  it("re-shows the consulta/incluir action menu after an invalid regular action", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, textWebhook("9"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "ACTION_MENU",
      selectedTipo: "Abrir nao conformidade"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Não entendi");
  });

  it("lists the sector norms and takes the procedure from the chosen norm", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n,
      selectedObraId: 1
    });
    // O menu agora lista as normas do setor da obra (código + título), não os tipos.
    expect(messaging.messages.at(-1)?.text).toContain("Qual a norma do serviço?");
    expect(messaging.messages.at(-1)?.text).toContain("1) PS-008 - Execução de alvenaria tradicional");
    expect(messaging.messages.at(-1)?.text).toContain("2) PS-031 - Impermeabilização de lajes");
    // "Outros" (foto sem norma) é sempre a última opção.
    expect(messaging.messages.at(-1)?.text).toContain("4) Outros");

    // Escolher a norma define tipo de serviço (título) e procedimento (código) e vai direto para a foto.
    await deliverWaha(service, textWebhook("2"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedTipoServico: "Impermeabilização de lajes",
      selectedNumeroProcedimento: "PS-031"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Obra: Obra Residencial Aurora");
    expect(messaging.messages.at(-1)?.text).toContain("PS-031 - Impermeabilização de lajes");
    expect(messaging.messages.at(-1)?.text).toContain("envie uma foto");

    await deliverWaha(service, photoWebhook());
    // A descrição é livre; o procedimento já veio da norma.
    await deliverWaha(service, textWebhook("Parede norte impermeabilizada"));

    expect(storage.uploads).toHaveLength(1);
    expect(storage.uploads[0].path).toContain("entradas/10/obras/1/");
    expect(store.entradas).toMatchObject([
      {
        userId: 7,
        empresaId: 10n,
        obraId: 1,
        tipo: "Inspecao de servico",
        tipoServico: "Impermeabilização de lajes",
        numeroProcedimento: "PS-031",
        description: "Parede norte impermeabilizada"
      }
    ]);
    expect(store.media[0].mediaUrl).toBe(storage.uploads[0].path);
    // Norma preservada no state para permitir fotos em sequência.
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_POST_SAVE_CHOICE",
      selectedObraId: 1,
      selectedTipoServico: "Impermeabilização de lajes",
      selectedNumeroProcedimento: "PS-031"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Registro salvo");
    // Menu de sequência: norma atual + trocar de norma.
    expect(messaging.messages.at(-1)?.text).toContain("Norma atual: PS-031 - Impermeabilização de lajes");
    expect(messaging.messages.at(-1)?.text).toContain("Trocar de norma");
  });

  it("permite mandar mais fotos da mesma norma em sequência, sem reescolher", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1")); // norma PS-008
    // 1ª foto (com legenda para concluir direto)
    await deliverWaha(service, photoWebhook("photo-1", "foto1.jpg", "Fiada 1"));
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");

    // 2ª foto direto no pós-registro: entra na MESMA norma, sem reescolher.
    await deliverWaha(service, photoWebhook("photo-2", "foto2.jpg", "Fiada 2"));
    // 3ª foto idem.
    await deliverWaha(service, photoWebhook("photo-3", "foto3.jpg", "Fiada 3"));

    expect(storage.uploads).toHaveLength(3);
    expect(store.entradas).toHaveLength(3);
    // Todas as 3 na mesma norma PS-008.
    for (const entrada of store.entradas) {
      expect(entrada).toMatchObject({
        tipo: "Inspecao de servico",
        tipoServico: "Execução de alvenaria tradicional",
        numeroProcedimento: "PS-008"
      });
    }
    expect(store.entradas.map((e) => e.description)).toEqual(["Fiada 1", "Fiada 2", "Fiada 3"]);
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");
  });

  it("aceita foto em sequência mesmo sem legenda (pede descrição e conclui)", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1")); // norma PS-008
    await deliverWaha(service, photoWebhook("photo-1", "foto1.jpg", "Fiada 1"));

    // 2ª foto sem legenda: volta a pedir descrição, preservando a norma.
    await deliverWaha(service, photoWebhook("photo-2", "foto2.jpg"));
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_DESCRIPTION");
    await deliverWaha(service, textWebhook("Fiada 2 sem legenda"));

    expect(store.entradas).toHaveLength(2);
    expect(store.entradas[1]).toMatchObject({
      numeroProcedimento: "PS-008",
      description: "Fiada 2 sem legenda"
    });
  });

  it("troca de norma pela opção 1 no menu pós-registro", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1")); // norma PS-008
    await deliverWaha(service, photoWebhook("photo-1", "foto1.jpg", "Fiada 1"));

    // "1" = trocar de norma -> reabre o menu de normas.
    await deliverWaha(service, textWebhook("1"));
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_SERVICE_TYPE");
    expect(messaging.messages.at(-1)?.text).toContain("Qual a norma do serviço?");

    // Escolhe outra norma e segue normalmente.
    await deliverWaha(service, textWebhook("2")); // PS-031
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedNumeroProcedimento: "PS-031"
    });
  });

  it("volta ao menu principal pela opção 2 no pós-registro da inspeção", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, photoWebhook("photo-1", "foto1.jpg", "Fiada 1"));

    await deliverWaha(service, textWebhook("2"));
    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("O que voce quer fazer agora?");
  });

  it("encaminha a foto da inspeção para o grupo de WhatsApp da obra com a legenda certa", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    // Obra 1 tem grupo de WhatsApp cadastrado.
    store.obrasForReport = [
      {
        id: 1,
        nome: "Obra Residencial Aurora",
        codigo: "130",
        construtoraNome: "Construtora Tanen",
        whatsappGroupId: "123@g.us",
        whatsappAutoReportEnabled: false,
        status: "ACTIVE"
      }
    ];

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1")); // norma PS-008
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Parede norte levantada"));

    // A cópia foi enviada ao grupo (via sendFile) — não confundir com as mensagens de texto do privado.
    expect(messaging.files).toHaveLength(1);
    const enviado = messaging.files[0];
    expect(enviado.chatId).toBe("123@g.us");
    expect(enviado.file.mimetype).toBe("image/jpeg");
    // O corpo veio do storage (download), reencaminhado em base64.
    expect(enviado.file.data).toBe((await storage.downloadPrivateObject(storage.uploads[0].path)).toString("base64"));
    // Legenda: descrição / norma / usuário - obra.
    expect(enviado.caption).toBe(
      "Parede norte levantada\nPS-008 - Execução de alvenaria tradicional\nUsuario Teste - Obra Residencial Aurora"
    );
    // O registro seguiu normalmente.
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");
  });

  it("não encaminha para o grupo quando a obra não tem grupo cadastrado", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    // findObraById retorna null (obrasForReport vazio) -> sem grupo.

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Parede norte levantada"));

    expect(messaging.files).toHaveLength(0);
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");
  });

  it("conclui o registro mesmo se o envio para o grupo falhar", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    store.obrasForReport = [
      {
        id: 1,
        nome: "Obra Residencial Aurora",
        codigo: "130",
        construtoraNome: "Construtora Tanen",
        whatsappGroupId: "123@g.us",
        whatsappAutoReportEnabled: false,
        status: "ACTIVE"
      }
    ];
    // WAHA fora: sendFile lança. O registro não pode quebrar por isso.
    messaging.sendFile = async () => {
      throw new Error("ECONNREFUSED");
    };

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Parede norte levantada"));

    expect(store.entradas).toHaveLength(1);
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");
    expect(messaging.messages.at(-1)?.text).toContain("Registro salvo");
  });

  it("não encaminha para o grupo registros que não são inspeção de serviço", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    store.obrasForReport = [
      {
        id: 1,
        nome: "Obra Residencial Aurora",
        codigo: "130",
        construtoraNome: "Construtora Tanen",
        whatsappGroupId: "123@g.us",
        whatsappAutoReportEnabled: false,
        status: "ACTIVE"
      }
    ];

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("2")); // Abrir nao conformidade
    await deliverWaha(service, textWebhook("2")); // incluir (1 = consulta)
    await deliverWaha(service, textWebhook("1")); // norma
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Fissura na viga"));

    expect(store.entradas).toMatchObject([{ tipo: "Abrir nao conformidade" }]);
    // Só inspeção de serviço é copiada para o grupo.
    expect(messaging.files).toHaveLength(0);
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");
  });

  it("usa a legenda com 'Outros' quando a inspeção foi registrada sem norma", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    store.obrasForReport = [
      {
        id: 1,
        nome: "Obra Residencial Aurora",
        codigo: "130",
        construtoraNome: "Construtora Tanen",
        whatsappGroupId: "123@g.us",
        whatsappAutoReportEnabled: false,
        status: "ACTIVE"
      }
    ];

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("4")); // Outros (3 normas + Outros)
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Foto do canteiro"));

    expect(messaging.files).toHaveLength(1);
    expect(messaging.files[0].caption).toBe("Foto do canteiro\nOutros\nUsuario Teste - Obra Residencial Aurora");
  });

  it("concludes even when the description does not contain a code, since the norm defines the procedure", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook());
    // Descrição sem código de procedimento: não pergunta mais nada, o código veio da norma.
    await deliverWaha(service, textWebhook("Parede norte concretada"));

    expect(store.entradas).toMatchObject([
      {
        description: "Parede norte concretada",
        numeroProcedimento: "PS-031"
      }
    ]);
    expect(store.states.get(CHAT_ID)).toMatchObject({ step: "AWAITING_POST_SAVE_CHOICE" });
    expect(messaging.messages.at(-1)?.text).not.toContain("Faltou você informar o número do procedimento");
    expect(messaging.messages.at(-1)?.text).toContain("Registro salvo");
  });

  it("lets the user add another entry of the same tipo right after saving, without losing the obra", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Parede norte concretada (PS-045)"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_POST_SAVE_CHOICE",
      selectedTipo: "Inspecao de servico",
      selectedObraId: 1
    });

    await deliverWaha(service, textWebhook("1"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n,
      selectedObraId: 1,
      selectedNumeroProcedimento: null
    });

    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Parede sul concretada (PS-046)"));

    expect(storage.uploads).toHaveLength(2);
    expect(store.entradas).toMatchObject([
      { description: "Parede norte concretada (PS-045)" },
      { description: "Parede sul concretada (PS-046)" }
    ]);
    expect(store.states.get(CHAT_ID)).toMatchObject({ step: "AWAITING_POST_SAVE_CHOICE" });

    await deliverWaha(service, textWebhook("2"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "MAIN_MENU",
      selectedObraId: 1,
      selectedTipo: null
    });
    expect(messaging.messages.at(-1)?.text).toContain("O que voce quer fazer agora?");
  });

  it("uses the image caption as description and skips the description prompt", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook("photo-1", "foto.jpg", "Parede norte concretada (PS-031)"));

    expect(storage.uploads).toHaveLength(1);
    expect(store.entradas).toMatchObject([{ description: "Parede norte concretada (PS-031)" }]);
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_POST_SAVE_CHOICE",
      pendingEntradaId: null
    });
    expect(messaging.messages.at(-1)?.text).toContain("Trocar de norma");
  });

  it("still asks for a description when the image has no caption", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook());

    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_DESCRIPTION");
    expect(messaging.messages.at(-1)?.text).toContain("me conta o que foi feito");
  });

  it("concludes with a caption that has no code, taking the procedure from the norm", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook("photo-1", "foto.jpg", "Parede norte concretada"));

    expect(store.entradas).toMatchObject([
      { description: "Parede norte concretada", numeroProcedimento: "PS-031" }
    ]);
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_POST_SAVE_CHOICE",
      pendingEntradaId: null
    });
    expect(messaging.messages.at(-1)?.text).not.toContain("Faltou você informar o número do procedimento");
    expect(messaging.messages.at(-1)?.text).toContain("Trocar de norma");
  });

  it("asks which obra to work on before showing the main menu when there are multiple", async () => {
    const { service, store, messaging } = createHarness();
    store.obras = [
      { id: 1, nome: "Obra Residencial Aurora", codigo: "AUR" },
      { id: 4, nome: "Obra Boulevard", codigo: "BSV" }
    ];

    await deliverWaha(service, textWebhook("oi"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "SELECT_EMPRESA",
      stepKey: "SELECT_OBRA",
      flowData: expect.objectContaining({ selectedObraId: null })
    });
    expect(messaging.messages.at(-1)?.text).toContain("Em qual obra voce vai trabalhar hoje?");
    expect(messaging.messages.at(-1)?.text).toContain("1) Obra Residencial Aurora");
    expect(messaging.messages.at(-1)?.text).toContain("2) Obra Boulevard");
    expect(messaging.messages.at(-1)?.text).not.toContain("O que voce quer fazer agora?");

    await deliverWaha(service, textWebhook("2"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "MAIN_MENU",
      selectedObraId: 4,
      selectedObraNome: "Obra Boulevard",
      flowData: expect.objectContaining({ selectedObraId: 4, selectedObraNome: "Obra Boulevard" })
    });
    expect(messaging.messages.at(-1)?.text).toContain("Voce esta na obra Obra Boulevard");
    expect(messaging.messages.at(-1)?.text).toContain("O que voce quer fazer agora?");
  });

  it("auto-selects the only active obra without asking", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "MAIN_MENU",
      selectedObraId: 1,
      selectedObraNome: "Obra Residencial Aurora"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Voce esta na obra Obra Residencial Aurora");
    expect(messaging.messages.at(-1)?.text).toContain("O que voce quer fazer agora?");
  });

  it("re-prompts the obra menu after an invalid obra selection", async () => {
    const { service, store, messaging } = createHarness();
    store.obras = [
      { id: 1, nome: "Obra Residencial Aurora", codigo: "AUR" },
      { id: 4, nome: "Obra Boulevard", codigo: "BSV" }
    ];

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("9"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "SELECT_EMPRESA",
      stepKey: "SELECT_OBRA"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Não achei essa obra");
  });

  it("blocks the entire flow when there are no active obras", async () => {
    const { service, store, messaging } = createHarness();
    store.obras = [];

    await deliverWaha(service, textWebhook("oi"));

    expect(store.states.has(CHAT_ID)).toBe(false);
    expect(messaging.messages.at(-1)?.text).toContain("Nenhuma obra ativa encontrada");
  });

  it("links the entry to the selected obra across the full inspection flow", async () => {
    const { service, store } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    store.obras = [
      { id: 1, nome: "Obra Residencial Aurora", codigo: "AUR" },
      { id: 4, nome: "Obra Boulevard", codigo: "BSV" }
    ];
    store.normasByObra.set(4, [{ code: "PS-001", title: "Compactação de aterro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Compactação do aterro trecho 3"));

    expect(store.entradas).toMatchObject([
      {
        userId: 7,
        empresaId: 10n,
        obraId: 4,
        tipo: "Inspecao de servico",
        tipoServico: "Compactação de aterro",
        numeroProcedimento: "PS-001",
        description: "Compactação do aterro trecho 3"
      }
    ]);
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_POST_SAVE_CHOICE",
      selectedObraId: 4
    });
  });

  it("lets the user switch obra mid-conversation with the 'trocar obra' command", async () => {
    const { service, store, messaging } = createHarness();
    store.obras = [
      { id: 1, nome: "Obra Residencial Aurora", codigo: "AUR" },
      { id: 4, nome: "Obra Boulevard", codigo: "BSV" }
    ];

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("2"));

    await deliverWaha(service, textWebhook("trocar obra"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "SELECT_EMPRESA",
      stepKey: "SELECT_OBRA"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Em qual obra voce vai trabalhar hoje?");

    await deliverWaha(service, textWebhook("1"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "MAIN_MENU",
      selectedObraId: 1,
      selectedObraNome: "Obra Residencial Aurora"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Voce esta na obra Obra Residencial Aurora");
  });

  it("prefixes every bot message with the current obra header", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));

    expect(messaging.messages.at(-1)?.text).toContain("🏗️ Obra: Obra Residencial Aurora");
  });

  it("runs the Recebimento de material include flow with OS, note photo, material photo, quantity, and quality", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("3"));
    await deliverWaha(service, textWebhook("2"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PROCEDURE_NUMBER",
      stepKey: "AWAITING_MATERIAL_OS",
      selectedTipo: "Recebimento de material",
      selectedEmpresaId: 10n
    });
    expect(messaging.messages.at(-1)?.text).toContain("número da OS");
    expect(messaging.messages.at(-1)?.text).not.toContain("Escolha o tipo de serviço");
    expect(messaging.messages.at(-1)?.text).not.toContain("procedimento utilizado");

    await deliverWaha(service, textWebhook("OS-123/2026"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      stepKey: "AWAITING_MATERIAL_NOTA_PHOTO",
      selectedNumeroProcedimento: "OS-123/2026"
    });
    expect(messaging.messages.at(-1)?.text).toContain("foto da nota");

    await deliverWaha(service, photoWebhook("nota-1", "nota.jpg"));

    expect(store.entradas).toMatchObject([
      {
        userId: 7,
        empresaId: 10n,
        tipo: "Recebimento de material",
        tipoServico: null,
        numeroProcedimento: "OS-123/2026",
        description: ""
      }
    ]);
    expect(store.media[0]).toMatchObject({
      entradaId: 1n,
      mediaUrl: storage.uploads[0].path,
      mediaTipo: "material_nota"
    });
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      stepKey: "AWAITING_MATERIAL_PHOTO",
      pendingEntradaId: 1n
    });
    expect(messaging.messages.at(-1)?.text).toContain("foto do material");

    await deliverWaha(service, photoWebhook("material-1", "material.jpg"));

    expect(storage.uploads).toHaveLength(2);
    expect(store.media[1]).toMatchObject({
      entradaId: 1n,
      mediaUrl: storage.uploads[1].path,
      mediaTipo: "material_foto"
    });
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_DESCRIPTION",
      stepKey: "AWAITING_MATERIAL_QUANTITY"
    });
    expect(messaging.messages.at(-1)?.text).toContain("quantidade recebida está correta");

    await deliverWaha(service, textWebhook("talvez"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      stepKey: "AWAITING_MATERIAL_QUANTITY"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Digite 1 pra Sim ou 2 pra Não");

    await deliverWaha(service, textWebhook("1"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      stepKey: "AWAITING_MATERIAL_QUALITY",
      flowData: expect.objectContaining({
        materialQuantidadeCorreta: "Sim"
      })
    });
    expect(messaging.messages.at(-1)?.text).toContain("qualidade do material está boa");

    await deliverWaha(service, textWebhook("não"));

    expect(store.entradas[0]).toMatchObject({
      description: "Quantidade correta: Sim\nQualidade correta: Não"
    });
    expect(store.states.has(CHAT_ID)).toBe(false);
    expect(messaging.messages.at(-1)?.text).toContain("Recebimento de material registrado");
  });

  it("rejects non-image files for both Recebimento de material photos", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("3"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, textWebhook("OS-124/2026"));
    await deliverWaha(service, fileWebhook());

    expect(store.states.get(CHAT_ID)).toMatchObject({
      stepKey: "AWAITING_MATERIAL_NOTA_PHOTO"
    });
    expect(store.entradas).toHaveLength(0);
    expect(messaging.messages.at(-1)?.text).toContain("Isso nao e uma foto");

    await deliverWaha(service, photoWebhook("nota-2", "nota-2.jpg"));
    await deliverWaha(service, fileWebhook());

    expect(store.states.get(CHAT_ID)).toMatchObject({
      stepKey: "AWAITING_MATERIAL_PHOTO"
    });
    expect(store.media).toHaveLength(1);
    expect(messaging.messages.at(-1)?.text).toContain("Isso nao e uma foto");
  });

  it("re-shows the norm menu after an invalid norm option", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    // Só há 3 normas cadastradas; a opção 8 é inválida.
    await deliverWaha(service, textWebhook("8"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Digite o numero da norma na lista acima");
  });

  it("registra a foto sem norma quando o usuário escolhe Outros", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    // O menu tem 3 normas; "Outros" é a opção seguinte (4).
    expect(messaging.messages.at(-1)?.text).toContain("4) Outros");

    await deliverWaha(service, textWebhook("4"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedTipoServico: null,
      selectedNumeroProcedimento: null
    });
    expect(messaging.messages.at(-1)?.text).toContain("Norma: Outros");

    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Foto do canteiro"));

    expect(storage.uploads).toHaveLength(1);
    expect(store.entradas).toMatchObject([
      {
        tipo: "Inspecao de servico",
        tipoServico: null,
        numeroProcedimento: null,
        description: "Foto do canteiro"
      }
    ]);
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");
  });

  it("mostra o menu só com Outros quando o setor da obra não tem normas", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    // Obra 1 sem normas cadastradas.
    store.normasByObra.set(1, []);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));

    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_SERVICE_TYPE");
    const menu = messaging.messages.at(-1)?.text ?? "";
    expect(menu).toContain("Qual a norma do serviço?");
    // Sem normas: "Outros" é a única opção (1).
    expect(menu).toContain("1) Outros");
    expect(menu).not.toContain("2) ");

    // Escolher "Outros" registra sem norma.
    await deliverWaha(service, textWebhook("1"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedTipoServico: null,
      selectedNumeroProcedimento: null
    });
  });

  it("responds to the user when photo processing fails", async () => {
    const { service, store, messaging } = createHarness({
      download: async () => {
        throw new Error("ECONNREFUSED");
      }
    });
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("3"));
    await deliverWaha(service, photoWebhook());

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedTipoServico: "Concretagem de estruturas",
      selectedNumeroProcedimento: "PS-045"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Deu um problema pra salvar a foto");
  });

  it("asks users with multiple companies to choose one", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [
      { id: 10n, nome: "Obra Centro" },
      { id: 20n, nome: "Obra Sul" }
    ]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("4"));
    await deliverWaha(service, textWebhook("2"));

    expect(store.states.get(CHAT_ID)?.step).toBe("SELECT_EMPRESA");
    expect(store.states.get(CHAT_ID)?.selectedTipo).toBe("Plano de manutencao");
    expect(messaging.messages.at(-1)?.text).toContain("2) Obra Sul");

    await deliverWaha(service, textWebhook("2"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedEmpresaId: 20n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Qual a norma do serviço?");
  });

  it("resets the flow from any step while keeping the active obra", async () => {
    const { service, store, messaging } = createHarness();

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("cancelar"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "MAIN_MENU",
      selectedObraId: 1,
      selectedObraNome: "Obra Residencial Aurora"
    });
    expect(messaging.messages.at(-1)?.text).toContain("🏗️ Obra: Obra Residencial Aurora");
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("consulta via action menu still uses the legacy report layout (generateReport)", async () => {
    const { service, store, messaging, pdfGenerator } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
    store.reportEntradas = [
      {
        id: 1n,
        description: "Nao conformidade aberta",
        createdAt: new Date("2026-06-22T10:00:00Z"),
        tipo: "Abrir nao conformidade",
        tipoServico: null,
        numeroProcedimento: null,
        empresaNome: "Obra Centro",
        usuarioNome: "Joao",
        mediaUrls: []
      }
    ];

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("2")); // Abrir nao conformidade
    await deliverWaha(service, textWebhook("1")); // Consulta
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_REPORT_DATE");
    expect(store.states.get(CHAT_ID)?.stepKey).toBe("AWAITING_REPORT_DATE");

    await deliverWaha(service, textWebhook("22/06/2026"));

    expect(pdfGenerator.calls).toHaveLength(1);
    expect(pdfGenerator.calls[0]).toMatchObject({
      categoria: "Abrir nao conformidade",
      empresaNome: "Obra Centro",
      reportDate: "22/06/2026"
    });
    expect(pdfGenerator.dailyCalls).toHaveLength(0);
    expect(messaging.files).toHaveLength(1);
  });

  describe("Gerar diario de obra flow", () => {
    const OBRA_FOR_REPORT: ObraForReport = {
      id: 1,
      nome: "Obra Residencial Aurora",
      codigo: "130",
      construtoraNome: "Construtora Tanen",
      whatsappGroupId: null,
      whatsappAutoReportEnabled: false,
      status: "ACTIVE"
    };

    it("asks only for the date, without empresa selection", async () => {
      const { service, store, messaging } = createHarness();

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));

      expect(store.states.get(CHAT_ID)).toMatchObject({
        step: "AWAITING_REPORT_DATE",
        stepKey: "AWAITING_DIARIO_OBRA_DATE",
        selectedTipo: null,
        selectedEmpresaId: null,
        selectedObraId: 1
      });
      expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA");
    });

    it("rejects invalid date formats and stays awaiting the date", async () => {
      const { service, store, messaging, pdfGenerator } = createHarness();

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));
      await deliverWaha(service, textWebhook("32/13/2026"));

      expect(store.states.get(CHAT_ID)?.stepKey).toBe("AWAITING_DIARIO_OBRA_DATE");
      expect(messaging.messages.at(-1)?.text).toContain("Não entendi essa data");
      expect(pdfGenerator.dailyCalls).toHaveLength(0);
    });

    it("rejects impossible calendar dates and stays awaiting the date", async () => {
      const { service, store, messaging } = createHarness();

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));
      await deliverWaha(service, textWebhook("31/04/2026"));

      expect(store.states.get(CHAT_ID)?.stepKey).toBe("AWAITING_DIARIO_OBRA_DATE");
      expect(messaging.messages.at(-1)?.text).toContain("Não entendi essa data");
    });

    it("sends text only when no records found and returns to main menu keeping the obra", async () => {
      const { service, store, messaging } = createHarness();
      store.obrasForReport = [OBRA_FOR_REPORT];
      store.reportEntradas = [];

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));
      await deliverWaha(service, textWebhook("22/06/2026"));

      expect(messaging.files).toHaveLength(0);
      const allTexts = messaging.messages.map((m) => m.text);
      expect(allTexts.some((t) => t.includes("Nenhum registro encontrado em 22/06/2026"))).toBe(true);
      expect(store.states.get(CHAT_ID)).toMatchObject({ step: "MAIN_MENU", selectedObraId: 1 });
      expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
    });

    it("sends the same daily PDF as the panel (generateDailyReport) when records are found", async () => {
      const { service, store, messaging, pdfGenerator } = createHarness();
      store.obrasForReport = [OBRA_FOR_REPORT];
      store.reportEntradas = [
        {
          id: 1n,
          description: "Parede concretada (PS-045)",
          createdAt: new Date("2026-06-22T10:00:00Z"),
          tipo: "Inspecao de servico",
          tipoServico: "Concretagem",
          numeroProcedimento: null,
          empresaNome: "AND Construções",
          usuarioNome: "Joao",
          mediaUrls: []
        }
      ];

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));
      await deliverWaha(service, textWebhook("22/06/2026"));

      // Gera pelo layout do diário (não pelo relatório de consulta antigo).
      expect(pdfGenerator.calls).toHaveLength(0);
      expect(pdfGenerator.dailyCalls).toHaveLength(1);
      expect(pdfGenerator.dailyCalls[0]).toMatchObject({
        obraNome: "Obra Residencial Aurora",
        obraCodigo: "130",
        construtoraNome: "Construtora Tanen",
        reportDate: "2026-06-22",
        entradas: [expect.objectContaining({ empresaNome: "AND Construções" })]
      });
      expect(messaging.files).toHaveLength(1);
      expect(messaging.files[0].file.mimetype).toBe("application/pdf");
      expect(messaging.files[0].file.filename).toBe("130 - DO 1 - 22-06-26.pdf");
      expect(messaging.files[0].file.data).toBeTruthy();
      expect(store.states.get(CHAT_ID)).toMatchObject({ step: "MAIN_MENU", selectedObraId: 1 });
      expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
    });

    it("sends 'Gerando o diario' before generating", async () => {
      const { service, store, messaging } = createHarness();
      store.obrasForReport = [OBRA_FOR_REPORT];
      store.reportEntradas = [];

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));
      await deliverWaha(service, textWebhook("22/06/2026"));

      const allTexts = messaging.messages.map((m) => m.text);
      expect(allTexts.some((t) => t.includes("Gerando o diario"))).toBe(true);
    });

    it("works even when the user has no empresa vinculada", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, []);

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));

      expect(store.states.get(CHAT_ID)?.stepKey).toBe("AWAITING_DIARIO_OBRA_DATE");
      expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA");
    });

    it("reset commands work from the diario date state", async () => {
      const { service, store, messaging } = createHarness();

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));
      await deliverWaha(service, textWebhook("cancelar"));

      expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
      expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
    });

    it("reset command '0' works from the diario date state", async () => {
      const { service, store, messaging } = createHarness();

      await deliverWaha(service, textWebhook("oi"));
      await deliverWaha(service, textWebhook("7"));
      await deliverWaha(service, textWebhook("0"));

      expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
      expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
    });
  });

  it("resets to obra selection when the session is idle for more than 1 hour", async () => {
    const { service, store, messaging } = createHarness();
    store.obras = [
      { id: 1, nome: "Obra Residencial Aurora", codigo: "AUR" },
      { id: 4, nome: "Obra Boulevard", codigo: "BSV" }
    ];
    store.states.set(CHAT_ID, {
      chatId: CHAT_ID,
      phoneE164: PHONE,
      step: "AWAITING_PROCEDURE_NUMBER",
      stepKey: "AWAITING_PROCEDURE_NUMBER",
      selectedObraId: 1,
      selectedObraNome: "Obra Residencial Aurora",
      selectedTipo: "Inspecao de servico",
      updatedAt: new Date(Date.now() - 61 * 60 * 1000)
    });

    await deliverWaha(service, textWebhook("PROC-45/2026"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      stepKey: "SELECT_OBRA",
      flowData: expect.objectContaining({ selectedObraId: null })
    });
    expect(messaging.messages.at(-1)?.text).toContain("Em qual obra voce vai trabalhar hoje?");
  });

  it("keeps the session when the last message was under 1 hour ago", async () => {
    const { service, store } = createHarness();
    // Entrada e foto já criadas; aguardando apenas a descrição.
    store.entradas.push({
      id: 1n,
      userId: 7,
      empresaId: 10n,
      obraId: 1,
      tipo: "Inspecao de servico",
      tipoServico: "Execução de alvenaria tradicional",
      numeroProcedimento: "PS-008",
      description: ""
    });
    store.states.set(CHAT_ID, {
      chatId: CHAT_ID,
      phoneE164: PHONE,
      step: "AWAITING_DESCRIPTION",
      stepKey: "AWAITING_DESCRIPTION",
      selectedObraId: 1,
      selectedObraNome: "Obra Residencial Aurora",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n,
      selectedTipoServico: "Execução de alvenaria tradicional",
      selectedNumeroProcedimento: "PS-008",
      pendingEntradaId: 1n,
      updatedAt: new Date(Date.now() - 59 * 60 * 1000)
    });

    await deliverWaha(service, textWebhook("Parede norte levantada"));

    // Sessão mantida: a descrição foi gravada e o registro concluído (procedimento veio da norma).
    expect(store.entradas[0]).toMatchObject({
      numeroProcedimento: "PS-008",
      description: "Parede norte levantada"
    });
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_POST_SAVE_CHOICE");
  });

  it("serializes concurrent messages for the same chatId", async () => {
    const { service, store } = createHarness();

    const timestamps: { start: number; end: number }[] = [];
    const originalGetState = store.getState.bind(store);
    let callCount = 0;
    store.getState = async (chatId: string) => {
      const n = ++callCount;
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, n === 1 ? 30 : 0));
      timestamps.push({ start, end: Date.now() });
      return originalGetState(chatId);
    };

    const webhook = (body: string): WahaWebhook => ({
      event: "message",
      session: "default",
      payload: { from: `${PHONE}@c.us`, body, hasMedia: false }
    });

    await Promise.all([
      deliverWaha(service, webhook("msg1")),
      deliverWaha(service, webhook("msg2"))
    ]);

    // With mutex: msg2 starts only after msg1 finishes (including its 30ms delay).
    // Without mutex: both would start simultaneously and timestamps[1].start < timestamps[0].end.
    expect(timestamps).toHaveLength(2);
    expect(timestamps[1].start).toBeGreaterThanOrEqual(timestamps[0].end);
  });
});
