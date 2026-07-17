import type { ChannelOnboarding } from "../services/conversationService";
import type { TelegramClient } from "./telegramClient";

const SHARE_CONTACT_PROMPT =
  "👋 Bem-vindo! Para liberar seu acesso, toque no botão abaixo e compartilhe o seu telefone.\n\n" +
  "Seu número precisa já estar cadastrado pelo administrador.";

const SHARE_CONTACT_BUTTON = "📱 Compartilhar meu telefone";

/**
 * Onboarding do Telegram: mostra o botão request_contact para o operador
 * compartilhar o telefone e, uma vez vinculado, remove o teclado e confirma.
 * Isola a UX específica de Telegram (reply_markup) fora do ConversationService.
 */
export class TelegramOnboardingClient implements ChannelOnboarding {
  constructor(private readonly client: TelegramClient) {}

  async promptShareContact(chatId: string): Promise<void> {
    await this.client.sendMessage(chatId, SHARE_CONTACT_PROMPT, {
      keyboard: [[{ text: SHARE_CONTACT_BUTTON, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    });
  }

  async confirmContactLinked(chatId: string, userName?: string | null): Promise<void> {
    const greeting = userName ? `✅ Acesso vinculado, ${userName}!` : "✅ Acesso vinculado!";
    await this.client.sendMessage(chatId, `${greeting} Digite *menu* para começar.`, {
      remove_keyboard: true
    });
  }
}
