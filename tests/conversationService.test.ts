import { describe, expect, it, vi } from "vitest";
import {
  ConversationService,
  type ConversationStateRecord,
  type ConversationStore,
  type CreateEntradaInput,
  type CreateTreinamentoInput,
  type EmpresaRecord,
  type EntradaForReport,
  type MessagingClient,
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

  async findEmpresasByUser(userId: number): Promise<EmpresaRecord[]> {
    return this.empresasByUser.get(userId) ?? [];
  }

  async findObrasAtivas(): Promise<ObraRecord[]> {
    return this.obras;
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

  it("asks service type then goes straight to the photo, taking the procedure from the description", async () => {
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
    expect(messaging.messages.at(-1)?.text).toContain("Qual o tipo de serviço?");

    // Após escolher o tipo de serviço vai direto para a foto — sem perguntar o procedimento.
    await deliverWaha(service, textWebhook("2"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedTipoServico: "Hidráulica",
      selectedNumeroProcedimento: null
    });
    expect(messaging.messages.at(-1)?.text).toContain("Obra: Obra Residencial Aurora");
    expect(messaging.messages.at(-1)?.text).toContain("Hidráulica");
    expect(messaging.messages.at(-1)?.text).toContain("envie uma foto");
    // Não faz mais a pergunta dedicada do procedimento antes da foto.
    expect(messaging.messages.at(-1)?.text).not.toContain("Qual o número do procedimento");
    expect(messaging.messages.at(-1)?.text).not.toContain("Faltou você informar");

    await deliverWaha(service, photoWebhook());
    // A descrição traz o código do procedimento (PS-031) — o sistema aceita e conclui.
    await deliverWaha(service, textWebhook("Parede norte concretada (PS-031)"));

    expect(storage.uploads).toHaveLength(1);
    expect(storage.uploads[0].path).toContain("entradas/10/obras/1/");
    expect(store.entradas).toMatchObject([
      {
        userId: 7,
        empresaId: 10n,
        obraId: 1,
        tipo: "Inspecao de servico",
        tipoServico: "Hidráulica",
        description: "Parede norte concretada (PS-031)"
      }
    ]);
    expect(store.media[0].mediaUrl).toBe(storage.uploads[0].path);
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_POST_SAVE_CHOICE",
      selectedObraId: 1
    });
    expect(messaging.messages.at(-1)?.text).toContain("Registro salvo");
    expect(messaging.messages.at(-1)?.text).toContain("Incluir outro registro");
  });

  it("asks for the procedure number only when the description does not contain a code", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook());
    // Descrição sem código de procedimento.
    await deliverWaha(service, textWebhook("Parede norte concretada"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PROCEDURE_NUMBER",
      pendingEntradaId: 1n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Faltou você informar o número do procedimento");

    // Usuário informa o número no fallback — vira o procedureNumber do registro.
    await deliverWaha(service, textWebhook("PS-031"));

    expect(store.entradas).toMatchObject([
      {
        description: "Parede norte concretada",
        numeroProcedimento: "PS-031"
      }
    ]);
    expect(store.states.get(CHAT_ID)).toMatchObject({ step: "AWAITING_POST_SAVE_CHOICE" });
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
    expect(messaging.messages.at(-1)?.text).toContain("Incluir outro registro");
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

  it("asks for the procedure number when the caption has no code", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, photoWebhook("photo-1", "foto.jpg", "Parede norte concretada"));

    expect(store.entradas).toMatchObject([{ description: "Parede norte concretada" }]);
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PROCEDURE_NUMBER",
      pendingEntradaId: 1n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Faltou você informar o número do procedimento");
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

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("2"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("6"));
    await deliverWaha(service, photoWebhook());
    await deliverWaha(service, textWebhook("Concretagem da laje 14 (PS-001)"));

    expect(store.entradas).toMatchObject([
      {
        userId: 7,
        empresaId: 10n,
        obraId: 4,
        tipo: "Inspecao de servico",
        tipoServico: "Concretagem",
        description: "Concretagem da laje 14 (PS-001)"
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

  it("re-shows the service type menu after an invalid service option", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("8"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Não entendi. Digite um numero de 1 a 7.");
  });

  it("re-prompts when the procedure number is blank in the fallback step", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await deliverWaha(service, textWebhook("oi"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("1"));
    await deliverWaha(service, textWebhook("4"));
    await deliverWaha(service, photoWebhook());
    // Descrição sem código -> cai no fallback pedindo o procedimento.
    await deliverWaha(service, textWebhook("Limpeza do canteiro"));
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_PROCEDURE_NUMBER");

    // Resposta em branco no fallback deve repetir a pergunta.
    await deliverWaha(service, textWebhook("   "));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PROCEDURE_NUMBER",
      selectedTipoServico: "Organização e Limpeza"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Faltou você informar o número do procedimento");
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
    await deliverWaha(service, textWebhook("6"));
    await deliverWaha(service, photoWebhook());

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedTipoServico: "Concretagem",
      selectedNumeroProcedimento: null
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
    expect(messaging.messages.at(-1)?.text).toContain("Qual o tipo de serviço?");
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
    // Entrada já criada, aguardando o procedimento no passo de fallback.
    store.entradas.push({
      id: 1n,
      userId: 7,
      empresaId: 10n,
      obraId: 1,
      tipo: "Inspecao de servico",
      tipoServico: "Alvenaria",
      numeroProcedimento: null,
      description: "Parede norte concretada"
    });
    store.states.set(CHAT_ID, {
      chatId: CHAT_ID,
      phoneE164: PHONE,
      step: "AWAITING_PROCEDURE_NUMBER",
      stepKey: "AWAITING_PROCEDURE_NUMBER",
      selectedObraId: 1,
      selectedObraNome: "Obra Residencial Aurora",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n,
      selectedTipoServico: "Alvenaria",
      pendingEntradaId: 1n,
      updatedAt: new Date(Date.now() - 59 * 60 * 1000)
    });

    await deliverWaha(service, textWebhook("PS-045"));

    // Sessão mantida: o procedimento foi gravado e o registro concluído.
    expect(store.entradas[0]).toMatchObject({ numeroProcedimento: "PS-045" });
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
