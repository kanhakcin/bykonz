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
  type PdfGenerator,
  type ReportInput,
  type UserRecord
} from "../src/services/conversationService";
import type { WahaWebhook } from "../src/types/waha";

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
  states = new Map<string, ConversationStateRecord>();
  entradas: Array<CreateEntradaInput & { id: bigint }> = [];
  treinamentos: Array<CreateTreinamentoInput & { id: number; entradaId: bigint }> = [];
  media: Array<{ entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }> = [];
  reportEntradas: EntradaForReport[] = [];

  async findUserByPhone(phoneDigits: string): Promise<UserRecord | null> {
    return this.users.get(phoneDigits) ?? null;
  }

  async findEmpresasByUser(userId: number): Promise<EmpresaRecord[]> {
    return this.empresasByUser.get(userId) ?? [];
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

  async findEntradasForReport(_input: {
    empresaId: bigint;
    tipo: string;
    dateStart: Date;
    dateEnd: Date;
  }): Promise<EntradaForReport[]> {
    return this.reportEntradas;
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

  async generateReport(input: ReportInput): Promise<Buffer> {
    this.calls.push(input);
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
    pdfGenerator
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

function photoWebhook(): WahaWebhook {
  return {
    event: "message",
    session: "default",
    payload: {
      id: "photo-1",
      from: CHAT_ID,
      body: "",
      hasMedia: true,
      media: {
        url: "http://waha.local/api/files/photo-1.jpg",
        mimetype: "image/jpeg",
        filename: "foto.jpg"
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

    await service.handleWebhook(textWebhook("oi"));

    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("1) Inspecao de servico");
    expect(messaging.messages.at(-1)?.text).toContain("6) Treinamento");
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("uses nested WAHA SenderAlt fields for phone lookup when from is a lid", async () => {
    const { service, store, messaging } = createHarness();
    const lidChatId = "999999999999999@lid";

    await service.handleWebhook({
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

    await service.handleWebhook(textWebhook("oi", shortChatId));

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

    await service.handleWebhook(textWebhook("oi"));

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

    await service.handleWebhook(textWebhook("oi", shortChatId));

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

    await service.handleWebhook(textWebhook("oi", deviceChatId));

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

    await service.handleWebhook(textWebhook("oi", deviceChatId));

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
      await service.handleWebhook(textWebhook("oi"));

      expect(infoSpy).toHaveBeenCalledWith(
        "WAHA webhook phone lookup started",
        expect.objectContaining({
          event: "message",
          session: "default",
          chatId: CHAT_ID,
          payloadFrom: CHAT_ID,
          payloadChatId: null,
          wahaPhoneDigits: PHONE,
          phoneLookupCandidates: [PHONE, PHONE_WITHOUT_NINTH]
        })
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "WAHA phone lookup matched registered user",
        expect.objectContaining({
          chatId: CHAT_ID,
          matchedPhoneE164: PHONE,
          userId: 7
        })
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "WAHA conversation state loaded",
        expect.objectContaining({
          chatId: CHAT_ID,
          stateStep: null,
          textLength: 2
        })
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "WAHA conversation state created",
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
    const { service, messaging } = createHarness();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      await service.handleWebhook(textWebhook("oi", "5511888888888@c.us"));
      expect(messaging.messages.at(-1)?.text).toContain("Numero nao cadastrado");
      expect(warnSpy).toHaveBeenCalledWith("WAHA phone lookup did not match a registered user", {
        event: "message",
        session: "default",
        chatId: "5511888888888@c.us",
        payloadFrom: "5511888888888@c.us",
        payloadChatId: null,
        sender: null,
        senderAlt: null,
        wahaPhoneDigits: "5511888888888",
        phoneLookupCandidates: ["5511888888888"]
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it.each(CONSULTA_ACTION_MENU_CATEGORY_OPTIONS)(
    "selects %s as %s and shows the consulta/incluir action menu",
    async (option, tipo) => {
      const { service, store, messaging } = createHarness();

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook(option));

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

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "ACTION_MENU",
      selectedTipo: "Inspecao de servico"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Inspecao de servico");
    expect(messaging.messages.at(-1)?.text).toContain("1) Incluir");
    expect(messaging.messages.at(-1)?.text).not.toContain("Consulta");
    expect(messaging.messages.at(-1)?.text).not.toContain("2) Incluir");
  });

  it("routes a first message main-menu selection instead of re-sending the main menu", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("6"));

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
    expect(messaging.messages).toHaveLength(1);
    expect(messaging.messages.at(-1)?.text).toContain("tema do treinamento");
    expect(messaging.messages.at(-1)?.text).not.toContain("O que voce quer acessar?");
  });

  it("routes first-message Gerar diario de obra selection into the report flow", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("7"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_REPORT_DATE",
      flowKey: "diario-das-obras",
      stepKey: "AWAITING_REPORT_DATE",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n,
      flowData: expect.objectContaining({
        selectedTipo: "Inspecao de servico",
        selectedEmpresaId: "10"
      })
    });
    expect(messaging.messages).toHaveLength(1);
    expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA");
    expect(messaging.messages.at(-1)?.text).not.toContain("O que voce quer acessar?");
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
        selectedEmpresaId: "10"
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

    await service.handleWebhook(textWebhook("NR-18 Canteiro de obras"));

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

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("6"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_TEMA",
      selectedTipo: "Treinamento",
      selectedEmpresaId: 10n
    });
    expect(messaging.messages.at(-1)?.text).toContain("tema do treinamento");

    await service.handleWebhook(textWebhook("NR-35 Trabalho em altura"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_PARTICIPANTS",
      selectedTreinamentoTema: "NR-35 Trabalho em altura"
    });
    expect(messaging.messages.at(-1)?.text).toContain("nomes e CPFs");

    await service.handleWebhook(textWebhook("Ana Silva - 123.456.789-00\nBruno Souza - 987.654.321-00"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_DATES",
      selectedTreinamentoParticipantes: "Ana Silva - 123.456.789-00\nBruno Souza - 987.654.321-00"
    });
    expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA HH:mm");

    await service.handleWebhook(textWebhook("25/06/2026 08:00 - 25/06/2026 10:30"));
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

    await service.handleWebhook(photoWebhook());
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

    await service.handleWebhook(textWebhook("OK"));
    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_TRAINING_FILE");
    expect(messaging.messages.at(-1)?.text).toContain("PDF ou foto");

    await service.handleWebhook(fileWebhook());

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
    expect(messaging.messages.at(-1)?.text).toContain("Treinamento salvo");
  });

  it("asks users with multiple companies to choose one before the Treinamento details", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [
      { id: 10n, nome: "Obra Centro" },
      { id: 20n, nome: "Obra Sul" }
    ]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("6"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "SELECT_EMPRESA_FOR_TRAINING",
      selectedTipo: "Treinamento"
    });
    expect(messaging.messages.at(-1)?.text).toContain("2) Obra Sul");

    await service.handleWebhook(textWebhook("2"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_TRAINING_TEMA",
      selectedEmpresaId: 20n
    });
    expect(messaging.messages.at(-1)?.text).toContain("tema do treinamento");
  });

  it("re-prompts when Treinamento dates are invalid", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("6"));
    await service.handleWebhook(textWebhook("NR-35 Trabalho em altura"));
    await service.handleWebhook(textWebhook("Ana Silva - 123.456.789-00"));
    await service.handleWebhook(textWebhook("25/06/2026 10:30 - 25/06/2026 08:00"));

    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_TRAINING_DATES");
    expect(store.treinamentos).toHaveLength(0);
    expect(messaging.messages.at(-1)?.text).toContain("Data/hora invalida");
  });

  it("re-shows the main menu after an invalid category", async () => {
    const { service, store, messaging } = createHarness();

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("8"));

    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("Opcao invalida");
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  it("re-shows the include-only action menu after an invalid Inspecao action", async () => {
    const { service, store, messaging } = createHarness();

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("9"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "ACTION_MENU",
      selectedTipo: "Inspecao de servico"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Opcao invalida");
    expect(messaging.messages.at(-1)?.text).toContain("1) Incluir");
    expect(messaging.messages.at(-1)?.text).not.toContain("Consulta");
  });

  it("re-shows the consulta/incluir action menu after an invalid regular action", async () => {
    const { service, store, messaging } = createHarness();

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("2"));
    await service.handleWebhook(textWebhook("9"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "ACTION_MENU",
      selectedTipo: "Abrir nao conformidade"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Opcao invalida");
    expect(messaging.messages.at(-1)?.text).toContain("1) Consulta");
    expect(messaging.messages.at(-1)?.text).toContain("2) Incluir");
  });

  it("asks service type and procedure number before photo, then saves the description", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("1"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Escolha o tipo de serviço");

    await service.handleWebhook(textWebhook("2"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PROCEDURE_NUMBER",
      selectedTipoServico: "Hidráulica"
    });
    expect(messaging.messages.at(-1)?.text).toContain("número do procedimento");

    await service.handleWebhook(textWebhook("PROC-45/2026"));
    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedNumeroProcedimento: "PROC-45/2026"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Hidráulica");
    expect(messaging.messages.at(-1)?.text).toContain("PROC-45/2026");

    await service.handleWebhook(photoWebhook());
    await service.handleWebhook(textWebhook("Parede norte concretada"));

    expect(storage.uploads).toHaveLength(1);
    expect(storage.uploads[0].path).toContain("entradas/10/7/");
    expect(store.entradas).toMatchObject([
      {
        userId: 7,
        empresaId: 10n,
        tipo: "Inspecao de servico",
        tipoServico: "Hidráulica",
        numeroProcedimento: "PROC-45/2026",
        description: "Parede norte concretada"
      }
    ]);
    expect(store.media[0].mediaUrl).toBe(storage.uploads[0].path);
    expect(store.states.has(CHAT_ID)).toBe(false);
    expect(messaging.messages.at(-1)?.text).toContain("Registro salvo");
  });

  it("re-shows the service type menu after an invalid service option", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("8"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: "Inspecao de servico",
      selectedEmpresaId: 10n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Opcao invalida");
    expect(messaging.messages.at(-1)?.text).toContain("7) Outros");
  });

  it("re-prompts when the procedure number is blank", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("4"));
    await service.handleWebhook(textWebhook("   "));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PROCEDURE_NUMBER",
      selectedTipoServico: "Organização e Limpeza"
    });
    expect(messaging.messages.at(-1)?.text).toContain("número do procedimento");
    expect(store.entradas).toHaveLength(0);
  });

  it("responds to the user when photo processing fails", async () => {
    const { service, store, messaging } = createHarness({
      download: async () => {
        throw new Error("ECONNREFUSED");
      }
    });
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("6"));
    await service.handleWebhook(textWebhook("99-A"));
    await service.handleWebhook(photoWebhook());

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_PHOTO",
      selectedTipoServico: "Concretagem",
      selectedNumeroProcedimento: "99-A"
    });
    expect(messaging.messages.at(-1)?.text).toContain("Nao consegui processar a foto");
  });

  it("asks users with multiple companies to choose one", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [
      { id: 10n, nome: "Obra Centro" },
      { id: 20n, nome: "Obra Sul" }
    ]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("4"));
    await service.handleWebhook(textWebhook("2"));

    expect(store.states.get(CHAT_ID)?.step).toBe("SELECT_EMPRESA");
    expect(store.states.get(CHAT_ID)?.selectedTipo).toBe("Plano de manutencao");
    expect(messaging.messages.at(-1)?.text).toContain("2) Obra Sul");

    await service.handleWebhook(textWebhook("2"));

    expect(store.states.get(CHAT_ID)).toMatchObject({
      step: "AWAITING_SERVICE_TYPE",
      selectedEmpresaId: 20n
    });
    expect(messaging.messages.at(-1)?.text).toContain("Escolha o tipo de serviço");
  });

  it("resets the flow from any step", async () => {
    const { service, store, messaging } = createHarness();

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("cancelar"));

    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
  });

  describe("Gerar diario de obra flow", () => {
    it("with one empresa goes directly to AWAITING_REPORT_DATE and asks for date", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));

      expect(store.states.get(CHAT_ID)).toMatchObject({
        step: "AWAITING_REPORT_DATE",
        selectedTipo: "Inspecao de servico",
        selectedEmpresaId: 10n
      });
      expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA");
    });

    it("with multiple empresas shows SELECT_EMPRESA_FOR_REPORT then transitions to date prompt", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, [
        { id: 10n, nome: "Obra Centro" },
        { id: 20n, nome: "Obra Sul" }
      ]);

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));

      expect(store.states.get(CHAT_ID)?.step).toBe("SELECT_EMPRESA_FOR_REPORT");
      expect(messaging.messages.at(-1)?.text).toContain("1) Obra Centro");
      expect(messaging.messages.at(-1)?.text).toContain("2) Obra Sul");

      await service.handleWebhook(textWebhook("2"));

      expect(store.states.get(CHAT_ID)).toMatchObject({
        step: "AWAITING_REPORT_DATE",
        selectedEmpresaId: 20n
      });
      expect(messaging.messages.at(-1)?.text).toContain("DD/MM/AAAA");
    });

    it("rejects invalid date formats and stays in AWAITING_REPORT_DATE", async () => {
      const { service, store, messaging, pdfGenerator } = createHarness();
      store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));
      await service.handleWebhook(textWebhook("32/13/2026"));

      expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_REPORT_DATE");
      expect(messaging.messages.at(-1)?.text).toContain("Data invalida");
      expect(pdfGenerator.calls).toHaveLength(0);
    });

    it("rejects impossible calendar dates and stays in AWAITING_REPORT_DATE", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));
      await service.handleWebhook(textWebhook("31/04/2026"));

      expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_REPORT_DATE");
      expect(messaging.messages.at(-1)?.text).toContain("Data invalida");
    });

    it("sends text only when no records found and resets to main menu", async () => {
      const { service, store, messaging, pdfGenerator } = createHarness();
      store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
      store.reportEntradas = [];

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));
      await service.handleWebhook(textWebhook("22/06/2026"));

      expect(store.states.has(CHAT_ID)).toBe(false);
      expect(pdfGenerator.calls).toHaveLength(0);
      expect(messaging.files).toHaveLength(0);
      const lastMsg = messaging.messages.at(-1)?.text ?? "";
      expect(lastMsg).toContain("Nenhum registro encontrado");
      expect(lastMsg).toContain("7) Gerar diario de obra");
    });

    it("generates and sends a PDF when records are found, then resets to main menu", async () => {
      const { service, store, messaging, pdfGenerator } = createHarness();
      store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
      store.reportEntradas = [
        {
          id: 1n,
          description: "Parede concretada",
          createdAt: new Date("2026-06-22T10:00:00Z"),
          tipo: "Inspecao de servico",
          tipoServico: "Concretagem",
          numeroProcedimento: "PROC-45/2026",
          empresaNome: "Obra Centro",
          usuarioNome: "Joao",
          mediaUrls: []
        }
      ];

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));
      await service.handleWebhook(textWebhook("22/06/2026"));

      expect(pdfGenerator.calls).toHaveLength(1);
      expect(pdfGenerator.calls[0]).toMatchObject({
        categoria: "Inspecao de servico",
        empresaNome: "Obra Centro",
        reportDate: "22/06/2026",
        entradas: [
          expect.objectContaining({
            tipoServico: "Concretagem",
            numeroProcedimento: "PROC-45/2026"
          })
        ]
      });
      expect(messaging.files).toHaveLength(1);
      expect(messaging.files[0].file.mimetype).toBe("application/pdf");
      expect(messaging.files[0].file.filename).toMatch(/\.pdf$/);
      expect(messaging.files[0].file.data).toBeTruthy();
      expect(store.states.has(CHAT_ID)).toBe(false);
      expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
    });

    it("sends 'Gerando relatorio' before fetching entries", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);
      store.reportEntradas = [];

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));
      await service.handleWebhook(textWebhook("22/06/2026"));

      const allTexts = messaging.messages.map((m) => m.text);
      const generandoIdx = allTexts.findIndex((t) => t.includes("Gerando relatorio"));
      expect(generandoIdx).toBeGreaterThanOrEqual(0);
    });

    it("reset commands work from SELECT_EMPRESA_FOR_REPORT state", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, [
        { id: 10n, nome: "Obra Centro" },
        { id: 20n, nome: "Obra Sul" }
      ]);

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));
      await service.handleWebhook(textWebhook("cancelar"));

      expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
      expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
    });

    it("reset commands work from AWAITING_REPORT_DATE state", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));
      await service.handleWebhook(textWebhook("0"));

      expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
      expect(messaging.messages.at(-1)?.text).toContain("7) Gerar diario de obra");
    });

    it("rejects consulta when user has no empresa", async () => {
      const { service, store, messaging } = createHarness();
      store.empresasByUser.set(7, []);

      await service.handleWebhook(textWebhook("oi"));
      await service.handleWebhook(textWebhook("7"));

      expect(store.states.has(CHAT_ID)).toBe(false);
      expect(messaging.messages.at(-1)?.text).toContain("Nenhuma empresa vinculada");
    });
  });
});
