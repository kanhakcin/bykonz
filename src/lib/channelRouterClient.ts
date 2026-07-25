import type { MediaDownloader, MessagingClient } from "../services/conversationService";
import { TELEGRAM_CHAT_PREFIX } from "../channels/telegram/inbound";

type ChannelClient = MessagingClient & MediaDownloader;

/**
 * Router que despacha `sendText`/`sendFile`/`download` para o cliente do canal
 * correto pelo prefixo do `chatId`/`ref`:
 *   - `tg:` → Telegram;
 *   - caso contrário → WAHA (WhatsApp).
 *
 * Assim o ConversationService e o fluxo continuam chamando
 * `messaging`/`mediaDownloader` sem saber de canal (ver §9 do plano). Cada
 * cliente subjacente é opcional — só existe se o canal estiver configurado.
 */
export class ChannelRouterClient implements MessagingClient, MediaDownloader {
  constructor(
    private readonly deps: {
      waha?: ChannelClient | null;
      telegram?: ChannelClient | null;
    }
  ) {
    if (!deps.waha && !deps.telegram) {
      throw new Error("ChannelRouterClient requires at least one channel client");
    }
  }

  async sendText(chatId: string, text: string): Promise<void> {
    return this.pick(chatId).sendText(chatId, text);
  }

  async sendFile(
    chatId: string,
    file: { mimetype: string; filename: string; data: string },
    caption?: string
  ): Promise<void> {
    return this.pick(chatId).sendFile(chatId, file, caption);
  }

  async sendImage(
    chatId: string,
    file: { mimetype: string; filename?: string; data: string },
    caption?: string
  ): Promise<void> {
    return this.pick(chatId).sendImage(chatId, file, caption);
  }

  async download(ref: string): Promise<Buffer> {
    return this.pick(ref).download(ref);
  }

  private pick(ref: string): ChannelClient {
    const isTelegram = ref.startsWith(TELEGRAM_CHAT_PREFIX);
    const client = isTelegram ? this.deps.telegram : this.deps.waha;
    if (!client) {
      throw new Error(
        `No channel client configured for ${isTelegram ? "telegram" : "whatsapp"} (ref="${ref}")`
      );
    }
    return client;
  }
}
