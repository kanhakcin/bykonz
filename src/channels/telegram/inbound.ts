import type { IncomingMediaRef, IncomingMessage } from "../../types/message";
import type { TelegramMessage, TelegramUpdate } from "../../types/telegram";

/** Prefixo de namespacing do chatId Telegram (ver §4 do plano). */
export const TELEGRAM_CHAT_PREFIX = "tg:";

/**
 * Borda de entrada do canal Telegram: traduz um Update cru para o tipo neutro
 * `IncomingMessage`, ou devolve `null` quando o update deve ser ignorado.
 *
 * v1 = conversa privada 1:1. Updates sem `message` (edições, callbacks etc.),
 * mensagens de bots ou de chats que não sejam privados são ignorados.
 */
export function telegramUpdateToIncomingMessage(update: TelegramUpdate): IncomingMessage | null {
  const message = update.message;
  if (!message) {
    return null;
  }

  if (message.chat.type !== "private") {
    return null;
  }

  const from = message.from;
  if (!from || from.is_bot) {
    return null;
  }

  return {
    channel: "telegram",
    chatId: `${TELEGRAM_CHAT_PREFIX}${message.chat.id}`,
    messageId: String(message.message_id),
    text: message.text ?? message.caption ?? "",
    media: extractMedia(message),
    identity: {
      kind: "telegram",
      value: String(from.id),
      raw: from as unknown as Record<string, unknown>
    }
  };
}

function extractMedia(message: TelegramMessage): IncomingMediaRef | null {
  // O `ref` recebe o mesmo prefixo `tg:` do chatId para que o
  // ChannelRouterClient consiga rotear `download(ref)` para o TelegramClient
  // (o file_id cru não carrega marca de canal). O TelegramClient remove o
  // prefixo antes de chamar getFile.
  if (message.photo && message.photo.length > 0) {
    // O Telegram entrega várias resoluções; a última é a maior.
    const largest = message.photo[message.photo.length - 1];
    return {
      ref: `${TELEGRAM_CHAT_PREFIX}${largest.file_id}`,
      // Fotos vêm sempre como JPEG; o Telegram não informa mimetype aqui.
      mimetype: "image/jpeg",
      filename: null
    };
  }

  if (message.document) {
    return {
      ref: `${TELEGRAM_CHAT_PREFIX}${message.document.file_id}`,
      mimetype: message.document.mime_type ?? null,
      filename: message.document.file_name ?? null
    };
  }

  return null;
}
