import { describe, expect, it } from "vitest";
import { telegramUpdateToIncomingMessage, TELEGRAM_CHAT_PREFIX } from "../src/channels/telegram/inbound";
import type { TelegramUpdate } from "../src/types/telegram";

function baseMessage(overrides: Partial<TelegramUpdate["message"]> = {}): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 100,
      chat: { id: 555, type: "private" },
      from: { id: 777, first_name: "Op", is_bot: false },
      date: 0,
      ...overrides
    }
  } as TelegramUpdate;
}

describe("telegramUpdateToIncomingMessage", () => {
  it("maps a private text message to a neutral IncomingMessage", () => {
    const msg = telegramUpdateToIncomingMessage(baseMessage({ text: "menu" }));

    expect(msg).toEqual({
      channel: "telegram",
      chatId: `${TELEGRAM_CHAT_PREFIX}555`,
      messageId: "100",
      text: "menu",
      media: null,
      identity: { kind: "telegram", value: "777", raw: expect.any(Object) },
      sharedContact: null
    });
  });

  it("uses the caption when there is no text (photo with caption)", () => {
    const msg = telegramUpdateToIncomingMessage(
      baseMessage({
        caption: "obra concluida",
        photo: [
          { file_id: "small", file_unique_id: "u1", width: 90, height: 90 },
          { file_id: "large", file_unique_id: "u2", width: 1280, height: 1280 }
        ]
      })
    );

    expect(msg?.text).toBe("obra concluida");
    // Pega o file_id da MAIOR resolução, com prefixo de canal para roteamento.
    expect(msg?.media).toEqual({
      ref: `${TELEGRAM_CHAT_PREFIX}large`,
      mimetype: "image/jpeg",
      filename: null
    });
  });

  it("maps a document to a media ref with mimetype and filename", () => {
    const msg = telegramUpdateToIncomingMessage(
      baseMessage({
        document: { file_id: "doc1", file_unique_id: "u3", file_name: "relatorio.pdf", mime_type: "application/pdf" }
      })
    );

    expect(msg?.media).toEqual({
      ref: `${TELEGRAM_CHAT_PREFIX}doc1`,
      mimetype: "application/pdf",
      filename: "relatorio.pdf"
    });
  });

  it("extracts a shared contact belonging to the sender", () => {
    const msg = telegramUpdateToIncomingMessage(
      baseMessage({ contact: { phone_number: "+5547996222708", user_id: 777 } })
    );
    expect(msg?.sharedContact).toEqual({ phone: "+5547996222708", belongsToSender: true });
  });

  it("flags a shared contact that is not the sender's own", () => {
    const msg = telegramUpdateToIncomingMessage(
      baseMessage({ contact: { phone_number: "+5547996222708", user_id: 999 } })
    );
    expect(msg?.sharedContact).toEqual({ phone: "+5547996222708", belongsToSender: false });
  });

  it("has no sharedContact on a plain text message", () => {
    const msg = telegramUpdateToIncomingMessage(baseMessage({ text: "oi" }));
    expect(msg?.sharedContact).toBeNull();
  });

  it("ignores updates without a message", () => {
    expect(telegramUpdateToIncomingMessage({ update_id: 1 })).toBeNull();
  });

  it("ignores non-private chats (groups fica para fase futura)", () => {
    const update = baseMessage({ text: "oi" });
    update.message!.chat.type = "group";
    expect(telegramUpdateToIncomingMessage(update)).toBeNull();
  });

  it("ignores messages from bots", () => {
    const update = baseMessage({ text: "oi" });
    update.message!.from!.is_bot = true;
    expect(telegramUpdateToIncomingMessage(update)).toBeNull();
  });
});
