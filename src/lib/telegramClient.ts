import type { AppConfig } from "../config/env";
import type { MediaDownloader, MessagingClient } from "../services/conversationService";
import type { TelegramFile } from "../types/telegram";
import { TELEGRAM_CHAT_PREFIX } from "../channels/telegram/inbound";

/**
 * Cliente do Telegram Bot API (https://core.telegram.org/bots/api) que
 * implementa os mesmos ports do WahaClient (`MessagingClient` + `MediaDownloader`).
 * Usa `fetch` nativo, padrão do projeto.
 *
 * O `chatId` chega namespaced (`tg:<chat_id>`); o prefixo é removido ao enviar,
 * consistente com o namespacing da §4 do plano.
 */
export class TelegramClient implements MessagingClient, MediaDownloader {
  private readonly apiBase: string;
  private readonly fileBase: string;

  constructor(private readonly token: string) {
    this.apiBase = `https://api.telegram.org/bot${token}`;
    this.fileBase = `https://api.telegram.org/file/bot${token}`;
  }

  static fromConfig(config: AppConfig): TelegramClient {
    if (!config.telegramBotToken) {
      throw new Error("TelegramClient requires TELEGRAM_BOT_TOKEN");
    }
    return new TelegramClient(config.telegramBotToken);
  }

  async sendText(chatId: string, text: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: stripPrefix(chatId),
        text
      })
    });

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed with ${response.status}: ${await response.text()}`);
    }
  }

  async sendFile(
    chatId: string,
    file: { mimetype: string; filename: string; data: string },
    caption?: string
  ): Promise<void> {
    const form = new FormData();
    form.append("chat_id", stripPrefix(chatId));
    if (caption) {
      form.append("caption", caption);
    }
    const buffer = Buffer.from(file.data, "base64");
    const blob = new Blob([buffer], { type: file.mimetype });
    form.append("document", blob, file.filename);

    const response = await fetch(`${this.apiBase}/sendDocument`, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      throw new Error(`Telegram sendDocument failed with ${response.status}: ${await response.text()}`);
    }
  }

  /**
   * O Telegram não entrega URL: entrega um `file_id` que precisa ser resolvido
   * em `file_path` via `getFile` antes de baixar do endpoint de arquivos.
   */
  async download(ref: string): Promise<Buffer> {
    const fileId = stripPrefix(ref);
    const getFileResponse = await fetch(`${this.apiBase}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId })
    });

    if (!getFileResponse.ok) {
      throw new Error(`Telegram getFile failed with ${getFileResponse.status}: ${await getFileResponse.text()}`);
    }

    const payload = (await getFileResponse.json()) as { ok: boolean; result?: TelegramFile };
    const filePath = payload.result?.file_path;
    if (!payload.ok || !filePath) {
      throw new Error(`Telegram getFile returned no file_path for ${fileId}`);
    }

    const fileResponse = await fetch(`${this.fileBase}/${filePath}`);
    if (!fileResponse.ok) {
      throw new Error(`Telegram file download failed with ${fileResponse.status}: ${await fileResponse.text()}`);
    }

    return Buffer.from(await fileResponse.arrayBuffer());
  }
}

function stripPrefix(chatId: string): string {
  return chatId.startsWith(TELEGRAM_CHAT_PREFIX) ? chatId.slice(TELEGRAM_CHAT_PREFIX.length) : chatId;
}
