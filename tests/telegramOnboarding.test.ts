import { describe, expect, it, vi } from "vitest";
import {
  ConversationService,
  type ChannelOnboarding,
  type ConversationStore,
  type UserRecord
} from "../src/services/conversationService";
import { telegramUpdateToIncomingMessage } from "../src/channels/telegram/inbound";
import type { TelegramUpdate } from "../src/types/telegram";
import type { IncomingMessage } from "../src/types/message";

const TG_FROM_ID = 1287616915;
const CHAT_ID = `tg:${TG_FROM_ID}`;
const PHONE_DIGITS = "5547996222708";

function makeStore(): {
  store: ConversationStore;
  users: Map<string, UserRecord>;
  usersByTelegramId: Map<string, UserRecord>;
} {
  const users = new Map<string, UserRecord>();
  const usersByTelegramId = new Map<string, UserRecord>();
  const store: Partial<ConversationStore> = {
    findUserByPhone: async (p) => users.get(p) ?? null,
    findUserByTelegramId: async (id) => usersByTelegramId.get(id) ?? null,
    linkTelegramIdByPhone: async ({ phoneCandidates, telegramUserId }) => {
      for (const candidate of phoneCandidates) {
        const user = users.get(candidate);
        if (!user) continue;
        if (user.telegramUserId && user.telegramUserId !== telegramUserId) {
          return { user: null, alreadyLinked: true };
        }
        const linked = { ...user, telegramUserId };
        users.set(candidate, linked);
        usersByTelegramId.set(telegramUserId, linked);
        return { user: linked, alreadyLinked: false };
      }
      return { user: null, alreadyLinked: false };
    },
    findObrasAtivas: async () => [],
    getState: async () => null,
    saveState: async (i) => i,
    clearState: async () => {}
  };
  return { store: store as ConversationStore, users, usersByTelegramId };
}

class FakeOnboarding implements ChannelOnboarding {
  prompted: string[] = [];
  confirmed: Array<{ chatId: string; name?: string | null }> = [];
  async promptShareContact(chatId: string): Promise<void> {
    this.prompted.push(chatId);
  }
  async confirmContactLinked(chatId: string, userName?: string | null): Promise<void> {
    this.confirmed.push({ chatId, name: userName });
  }
}

function makeService(store: ConversationStore, onboarding?: ChannelOnboarding) {
  const sent: Array<{ chatId: string; text: string }> = [];
  const service = new ConversationService({
    store,
    messaging: {
      sendText: async (chatId, text) => {
        sent.push({ chatId, text });
      },
      sendFile: async () => {},
      sendImage: async () => {}
    },
    mediaDownloader: { download: async () => Buffer.from("") },
    objectStorage: {} as never,
    pdfGenerator: {} as never,
    dailyReport: {} as never,
    channelOnboarding: onboarding
  });
  return { service, sent };
}

function textUpdate(text: string): IncomingMessage {
  const update: TelegramUpdate = {
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: TG_FROM_ID, type: "private" },
      from: { id: TG_FROM_ID, first_name: "Op", is_bot: false },
      date: 0,
      text
    }
  };
  return telegramUpdateToIncomingMessage(update)!;
}

function contactUpdate(phone: string, contactUserId = TG_FROM_ID): IncomingMessage {
  const update: TelegramUpdate = {
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: TG_FROM_ID, type: "private" },
      from: { id: TG_FROM_ID, first_name: "Op", is_bot: false },
      date: 0,
      contact: { phone_number: phone, user_id: contactUserId }
    }
  };
  return telegramUpdateToIncomingMessage(update)!;
}

describe("Telegram onboarding (auto-vínculo por contato)", () => {
  it("offers the share-contact button when an unknown Telegram user writes", async () => {
    const { store } = makeStore();
    const onboarding = new FakeOnboarding();
    const { service, sent } = makeService(store, onboarding);

    await service.handleWebhook(textUpdate("oi"));

    expect(onboarding.prompted).toEqual([CHAT_ID]);
    // Não usa a mensagem genérica de "não cadastrado".
    expect(sent).toHaveLength(0);
  });

  it("falls back to the generic message when no onboarding is configured", async () => {
    const { store } = makeStore();
    const { service, sent } = makeService(store);

    await service.handleWebhook(textUpdate("oi"));

    expect(sent[0]?.text).toContain("Numero nao cadastrado");
  });

  it("links the telegram id when the shared phone matches a registered user", async () => {
    const { store, users, usersByTelegramId } = makeStore();
    users.set(PHONE_DIGITS, { id: 3, phoneE164: PHONE_DIGITS, telegramUserId: null, nome: "Victor" });
    const onboarding = new FakeOnboarding();
    const { service } = makeService(store, onboarding);

    await service.handleWebhook(contactUpdate(`+${PHONE_DIGITS}`));

    expect(usersByTelegramId.get(String(TG_FROM_ID))?.id).toBe(3);
    expect(onboarding.confirmed).toEqual([{ chatId: CHAT_ID, name: "Victor" }]);
  });

  it("normalizes a free-form phone (spaces/dashes) before matching", async () => {
    const { store, users, usersByTelegramId } = makeStore();
    users.set(PHONE_DIGITS, { id: 3, phoneE164: PHONE_DIGITS, telegramUserId: null, nome: "Victor" });
    const { service } = makeService(store, new FakeOnboarding());

    await service.handleWebhook(contactUpdate("+55 (47) 99622-2708"));

    expect(usersByTelegramId.get(String(TG_FROM_ID))?.id).toBe(3);
  });

  it("rejects a contact that is not the sender's own", async () => {
    const { store, users, usersByTelegramId } = makeStore();
    users.set(PHONE_DIGITS, { id: 3, phoneE164: PHONE_DIGITS, telegramUserId: null, nome: "Victor" });
    const { service, sent } = makeService(store, new FakeOnboarding());

    // contact.user_id diferente do from.id => belongsToSender = false
    await service.handleWebhook(contactUpdate(`+${PHONE_DIGITS}`, 999999));

    expect(usersByTelegramId.size).toBe(0);
    expect(sent[0]?.text).toContain("Compartilhe o seu próprio contato");
  });

  it("tells the operator when the shared phone is not registered", async () => {
    const { store } = makeStore();
    const { service, sent } = makeService(store, new FakeOnboarding());

    await service.handleWebhook(contactUpdate("+5511000000000"));

    expect(sent[0]?.text).toContain("Seu telefone nao esta cadastrado");
  });

  it("refuses to overwrite a user already linked to another telegram id", async () => {
    const { store, users } = makeStore();
    users.set(PHONE_DIGITS, { id: 3, phoneE164: PHONE_DIGITS, telegramUserId: "999888", nome: "Victor" });
    const { service, sent } = makeService(store, new FakeOnboarding());

    await service.handleWebhook(contactUpdate(`+${PHONE_DIGITS}`));

    expect(sent[0]?.text).toContain("ja esta vinculado a outra conta");
  });

  it("just confirms when a linked operator shares the contact again", async () => {
    const { store, users, usersByTelegramId } = makeStore();
    const linked = { id: 3, phoneE164: PHONE_DIGITS, telegramUserId: String(TG_FROM_ID), nome: "Victor" };
    users.set(PHONE_DIGITS, linked);
    usersByTelegramId.set(String(TG_FROM_ID), linked);
    const onboarding = new FakeOnboarding();
    const { service } = makeService(store, onboarding);

    await service.handleWebhook(contactUpdate(`+${PHONE_DIGITS}`));

    expect(onboarding.confirmed).toEqual([{ chatId: CHAT_ID, name: "Victor" }]);
  });
});
