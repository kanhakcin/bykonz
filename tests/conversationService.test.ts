import { describe, expect, it } from "vitest";
import {
  ConversationService,
  type ConversationStateRecord,
  type ConversationStore,
  type CreateEntradaInput,
  type EmpresaRecord,
  type MessagingClient,
  type ObjectStorage,
  type UserRecord
} from "../src/services/conversationService";
import type { WahaWebhook } from "../src/types/waha";

const CHAT_ID = "5511999999999@c.us";
const PHONE = "5511999999999";

class FakeStore implements ConversationStore {
  users = new Map<string, UserRecord>();
  empresasByUser = new Map<number, EmpresaRecord[]>();
  states = new Map<string, ConversationStateRecord>();
  entradas: Array<CreateEntradaInput & { id: bigint }> = [];
  media: Array<{ entradaId: bigint; mediaUrl: string }> = [];

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

  async addEntradaMedia(input: { entradaId: bigint; mediaUrl: string }): Promise<void> {
    this.media.push(input);
  }

  async updateEntradaDescription(entradaId: bigint, description: string): Promise<void> {
    const entrada = this.entradas.find((item) => item.id === entradaId);
    if (entrada) {
      entrada.description = description;
    }
  }
}

class FakeMessaging implements MessagingClient {
  messages: Array<{ chatId: string; text: string }> = [];

  async sendText(chatId: string, text: string): Promise<void> {
    this.messages.push({ chatId, text });
  }
}

class FakeStorage implements ObjectStorage {
  uploads: Array<{ path: string; body: Buffer; contentType: string }> = [];

  async uploadPrivateObject(input: { path: string; body: Buffer; contentType: string }): Promise<void> {
    this.uploads.push(input);
  }
}

function createHarness(overrides: { download?: () => Promise<Buffer> } = {}) {
  const store = new FakeStore();
  const messaging = new FakeMessaging();
  const storage = new FakeStorage();
  const service = new ConversationService({
    store,
    messaging,
    mediaDownloader: {
      download: overrides.download ?? (async () => Buffer.from("fake-image"))
    },
    objectStorage: storage
  });

  store.users.set(PHONE, { id: 7, phoneE164: PHONE, nome: "Usuario Teste" });

  return { service, store, messaging, storage };
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

describe("ConversationService", () => {
  it("starts known users at the main menu", async () => {
    const { service, store, messaging } = createHarness();

    await service.handleWebhook(textWebhook("oi"));

    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("1) Diario de obra");
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
      text: expect.stringContaining("1) Diario de obra")
    });
  });

  it("rejects unknown users", async () => {
    const { service, messaging } = createHarness();

    await service.handleWebhook(textWebhook("oi", "5511888888888@c.us"));

    expect(messaging.messages.at(-1)?.text).toContain("Numero nao cadastrado");
  });

  it("adds a photo first and then saves the description", async () => {
    const { service, store, messaging, storage } = createHarness();
    store.empresasByUser.set(7, [{ id: 10n, nome: "Obra Centro" }]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("2"));
    await service.handleWebhook(photoWebhook());
    await service.handleWebhook(textWebhook("Parede norte concretada"));

    expect(storage.uploads).toHaveLength(1);
    expect(storage.uploads[0].path).toContain("entradas/10/7/");
    expect(store.entradas).toMatchObject([
      {
        userId: 7,
        empresaId: 10n,
        tipo: "Diario de obra",
        description: "Parede norte concretada"
      }
    ]);
    expect(store.media[0].mediaUrl).toBe(storage.uploads[0].path);
    expect(store.states.has(CHAT_ID)).toBe(false);
    expect(messaging.messages.at(-1)?.text).toContain("Registro salvo");
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
    await service.handleWebhook(textWebhook("2"));
    await service.handleWebhook(photoWebhook());

    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_PHOTO");
    expect(messaging.messages.at(-1)?.text).toContain("Nao consegui processar a foto");
  });

  it("asks users with multiple companies to choose one", async () => {
    const { service, store, messaging } = createHarness();
    store.empresasByUser.set(7, [
      { id: 10n, nome: "Obra Centro" },
      { id: 20n, nome: "Obra Sul" }
    ]);

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("2"));
    await service.handleWebhook(textWebhook("2"));

    expect(store.states.get(CHAT_ID)?.step).toBe("SELECT_EMPRESA");
    expect(messaging.messages.at(-1)?.text).toContain("2) Obra Sul");

    await service.handleWebhook(textWebhook("2"));

    expect(store.states.get(CHAT_ID)?.step).toBe("AWAITING_PHOTO");
    expect(store.states.get(CHAT_ID)?.selectedEmpresaId).toBe(20n);
  });

  it("stubs the inspect flow after a selected date", async () => {
    const { service, messaging, store } = createHarness();

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("04/06/2026"));

    expect(messaging.messages.at(-1)?.text).toContain("PDF ainda nao implementado");
    expect(store.states.has(CHAT_ID)).toBe(false);
  });

  it("resets the flow from any step", async () => {
    const { service, store, messaging } = createHarness();

    await service.handleWebhook(textWebhook("oi"));
    await service.handleWebhook(textWebhook("1"));
    await service.handleWebhook(textWebhook("cancelar"));

    expect(store.states.get(CHAT_ID)?.step).toBe("MAIN_MENU");
    expect(messaging.messages.at(-1)?.text).toContain("1) Diario de obra");
  });
});
