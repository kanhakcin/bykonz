import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { TelegramClient } from "../lib/telegramClient";
import { loadConfig, type AppConfig } from "../config/env";

/**
 * Serviço de gerenciamento do Telegram para o painel.
 *
 * Consolida as operações de administração do bot: dashboard, configurações
 * (token protegido/mascarado), conversas, mensagens, canais e logs. Usa os
 * modelos Prisma existentes (BotConversation, BotMessage, BotSetting, BotLog)
 * e o TelegramClient para operações no Bot API.
 *
 * O token nunca é exposto: o dashboard devolve apenas um valor mascarado e o
 * frontend nunca recebe o token completo.
 */
export class TelegramManagementService {
  private readonly prisma: PrismaClient;
  private readonly config: AppConfig;

  constructor(prismaClient: PrismaClient = prisma, config: AppConfig = loadConfig()) {
    this.prisma = prismaClient;
    this.config = config;
  }

  private getClient(): TelegramClient | null {
    try {
      return this.config.telegramBotToken ? TelegramClient.fromConfig(this.config) : null;
    } catch {
      return null;
    }
  }

  // ---- Dashboard ------------------------------------------------------------

  async getDashboard() {
    const settings = await this.getSettingsMap();
    const tokenConfigured = Boolean(settings.bot_token);
    const enabled = settings.integration_enabled !== "false";

// Bot online: tenta getMe se token presente; senão offline (sem token).
    let botInfo: { online: boolean; name: string | null; username: string | null; lastConnection: string | null } =
      { online: false, name: null, username: null, lastConnection: null };
    if (tokenConfigured) {
      const client = this.getClient();
      if (client) {
        try {
          const me = await this.callGetMe(client);
          botInfo = {
            online: true,
            name: me?.first_name ?? null,
            username: me?.username ?? null,
            lastConnection: settings.last_connection ?? null
          };
        } catch {
          this.log("ERROR", null, "Falha ao consultar status do bot (getMe).", undefined);
          botInfo = { online: false, name: null, username: null, lastConnection: settings.last_connection ?? null };
        }
      }
    }

    const [sentCount, receivedCount, conversationCount, chatCount] = await Promise.all([
      this.prisma.botMessage.count({ where: { direction: "OUTBOUND" } }),
      this.prisma.botMessage.count({ where: { direction: "INBOUND" } }),
      this.prisma.botConversation.count(),
      this.prisma.botConversation.count()
    ]);

    return {
      status: enableStatus(enabled, botInfo.online),
      botName: botInfo.name,
      username: botInfo.username,
      tokenConfigured,
      tokenMasked: tokenConfigured ? maskToken(settings.bot_token!) : null,
      lastConnection: botInfo.lastConnection,
      enabled,
      counts: {
        sent: sentCount,
        received: receivedCount,
        conversations: conversationCount,
        chats: chatCount
      }
    };
  }

  // ---- Configurações --------------------------------------------------------

  private async getSettingsMap(): Promise<Record<string, string>> {
    const rows = await this.prisma.botSetting.findMany();
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value ?? "";
    }
    return map;
  }

  private async setSetting(key: string, value: string): Promise<void> {
    await this.prisma.botSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value }
    });
  }

  async getSettings() {
    const map = await this.getSettingsMap();
    return {
      tokenConfigured: Boolean(map.bot_token),
      tokenMasked: map.bot_token ? maskToken(map.bot_token) : null,
      enabled: map.integration_enabled !== "false",
      lastConnection: map.last_connection ?? null,
      lastError: map.last_error ?? null
    };
  }

  /** Salva o token (write-only) e opcionalmente ativa/desativa a integração. */
  async updateSettings(input: { token?: string; enabled?: boolean }) {
    if (input.token !== undefined) {
      const token = input.token.trim();
      if (token) {
        await this.setSetting("bot_token", token);
      }
    }
    if (input.enabled !== undefined) {
      await this.setSetting("integration_enabled", input.enabled ? "true" : "false");
      this.log("SYSTEM", null, `Integração ${input.enabled ? "ativada" : "desativada"}.`, undefined);
    }
    return this.getSettings();
  }

  /** Testa a conexão com o Telegram chamando getMe. */
  async testConnection() {
    const client = this.getClient();
    if (!client) {
      return { ok: false, error: "Token não configurado." };
    }
    try {
      const me = await this.callGetMe(client);
      await this.setSetting("last_connection", new Date().toISOString());
      await this.setSetting("last_error", "");
      this.log("SYSTEM", null, "Conexão com o Telegram OK (getMe).", { name: me?.first_name, username: me?.username });
      return { ok: true, bot: { name: me?.first_name ?? null, username: me?.username ?? null } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.setSetting("last_error", msg);
      this.log("ERROR", null, "Falha no teste de conexão (getMe).", { error: msg });
      return { ok: false, error: msg };
    }
  }

  // ---- Conversas e mensagens ------------------------------------------------

  async listConversations(input: { search?: string; page?: number; size?: number }) {
    const page = input.page ?? 0;
    const size = Math.min(Math.max(input.size ?? 20, 1), 100);
    const where = input.search
      ? {
          OR: [
            { firstName: { contains: input.search, mode: "insensitive" as const } },
            { lastName: { contains: input.search, mode: "insensitive" as const } },
            { username: { contains: input.search, mode: "insensitive" as const } },
            { chatId: { contains: input.search } }
          ]
        }
      : {};

    const [data, totalCount] = await Promise.all([
      this.prisma.botConversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: page * size,
        take: size
      }),
      this.prisma.botConversation.count({ where })
    ]);

    return { data, totalCount };
  }

  async getConversation(conversationId: number) {
    const conversation = await this.prisma.botConversation.findUnique({
      where: { id: conversationId }
    });
    if (!conversation) {
      return null;
    }
    const messages = await this.prisma.botMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" }
    });
    return { conversation, messages };
  }

async listMessages(input: { conversationId?: number; search?: string; from?: string; to?: string; page?: number; size?: number }) {
    const page = input.page ?? 0;
    const size = Math.min(Math.max(input.size ?? 20, 1), 100);
    const where: Prisma.BotMessageWhereInput = {};
    if (input.conversationId) {
      where.conversationId = input.conversationId;
    }
    if (input.search) {
      where.text = { contains: input.search, mode: "insensitive" };
    }
    if (input.from || input.to) {
      where.createdAt = {};
      if (input.from) where.createdAt.gte = new Date(input.from);
      if (input.to) where.createdAt.lte = new Date(input.to);
    }

    const [data, totalCount] = await Promise.all([
      this.prisma.botMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page * size,
        take: size,
        include: { conversation: true }
      }),
      this.prisma.botMessage.count({ where })
    ]);

    return { data, totalCount };
  }

  // ---- Canais / chats -------------------------------------------------------

  async listChats() {
    const conversations = await this.prisma.botConversation.findMany({
      orderBy: { lastMessageAt: "desc" }
    });
    // Na v1, os chats derivam das conversas 1:1. Grupos/canais podem ser
    // adicionados depois conforme o uso.
    return conversations.map((c) => ({
      id: c.id,
      chatId: c.chatId,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.username || c.chatId,
      username: c.username,
      type: "private",
      status: c.isActive ? "active" : "inactive",
      lastMessageAt: c.lastMessageAt
    }));
  }

  // ---- Envio ----------------------------------------------------------------

  async sendMessage(input: { chatId: string; text?: string; media?: { type: string; mime: string; filename: string; data: string } }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("telegram_not_configured");
    }
    const chatId = normalizeChatId(input.chatId);
    try {
      if (input.media) {
        if (input.media.type === "image") {
          await client.sendImage(chatId, {
            mimetype: input.media.mime,
            filename: input.media.filename,
            data: input.media.data
          }, input.text);
        } else {
          await client.sendFile(chatId, {
            mimetype: input.media.mime,
            filename: input.media.filename,
            data: input.media.data
          }, input.text);
        }
      } else if (input.text) {
        await client.sendText(chatId, input.text);
      } else {
        throw new Error("invalid_payload");
      }

      await this.persistOutbound(chatId, input.text ?? null, input.media);
      this.log("SENT", chatId, "Mensagem enviada.", { text: input.text });
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log("ERROR", chatId, "Falha no envio de mensagem.", { error: msg });
      throw error;
    }
  }

  private async persistOutbound(
    chatId: string,
    text: string | null,
    media?: { type: string; mime: string; filename: string; data: string }
  ) {
    const conversation = await this.prisma.botConversation.upsert({
      where: { chatId },
      create: { chatId, channel: "telegram" },
      update: {}
    });
    await this.prisma.botMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        text,
        chatId,
        mediaType: media ? (media.type === "image" ? "image" : "document") : null
      }
    });
    await this.prisma.botConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), lastMessageText: text, lastDirection: "OUTBOUND" }
    });
  }

  // ---- Logs -----------------------------------------------------------------

  async listLogs(input: { type?: string; page?: number; size?: number }) {
    const page = input.page ?? 0;
    const size = Math.min(Math.max(input.size ?? 20, 1), 100);
    const where = input.type ? { type: input.type as never } : {};
    const [data, totalCount] = await Promise.all([
      this.prisma.botLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page * size,
        take: size
      }),
      this.prisma.botLog.count({ where })
    ]);
    return { data, totalCount };
  }

  // ---- Helpers --------------------------------------------------------------

  private async callGetMe(client: TelegramClient) {
    // getMe não está exposto no TelegramClient; usa o endpoint diretamente.
    const token = this.config.telegramBotToken!;
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!response.ok) {
      throw new Error(`getMe failed with ${response.status}`);
    }
    const payload = (await response.json()) as { ok: boolean; result?: { first_name?: string; username?: string } };
    if (!payload.ok) {
      throw new Error("getMe returned not ok");
    }
    return payload.result;
  }

  private async log(type: "SENT" | "RECEIVED" | "ERROR" | "SYSTEM", chatId: string | null, message: string, details?: unknown) {
    try {
      await this.prisma.botLog.create({
        data: {
          type: type as never,
          chatId,
          message,
          details: details ?? undefined
        }
      });
    } catch (error) {
      console.error("[telegram] Falha ao gravar log:", error);
    }
  }
}

function enableStatus(enabled: boolean, online: boolean): string {
  if (!enabled) return "disabled";
  return online ? "online" : "offline";
}

/** Mascara o token, exibindo apenas os 4 primeiros e 4 últimos caracteres. */
export function maskToken(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
}

function normalizeChatId(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("tg:") ? trimmed : trimmed;
}
