import type { AppConfig } from "../config/env";
import type { MediaDownloader, MessagingClient } from "../services/conversationService";

export class WahaClient implements MessagingClient, MediaDownloader {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly session: string
  ) {}

  static fromConfig(config: AppConfig): WahaClient {
    return new WahaClient(config.wahaBaseUrl, config.wahaApiKey, config.wahaSession);
  }

  async sendText(chatId: string, text: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/sendText`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        session: this.session,
        chatId,
        text
      })
    });

    if (!response.ok) {
      throw new Error(`WAHA sendText failed with ${response.status}: ${await response.text()}`);
    }
  }

  async download(url: string): Promise<Buffer> {
    const downloadUrl = this.resolveMediaUrl(url);
    const response = await fetch(downloadUrl, {
      headers: this.headers()
    });

    if (!response.ok) {
      throw new Error(`WAHA media download failed with ${response.status}: ${await response.text()}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private resolveMediaUrl(url: string): string {
    const base = new URL(this.baseUrl);
    const parsed = new URL(url, base);

    if (isLocalHost(parsed.hostname)) {
      parsed.protocol = base.protocol;
      parsed.hostname = base.hostname;
      parsed.port = base.port;
    }

    return parsed.toString();
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "X-Api-Key": this.apiKey,
      ...extra
    };
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";
}
