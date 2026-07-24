/**
 * Contrato de mensagem channel-agnóstico consumido pelo núcleo
 * (ConversationService + DiarioDasObrasFlow). Cada canal traduz seu payload
 * cru para este tipo num adapter de entrada (src/channels/<canal>/inbound.ts).
 */

export type Channel = "whatsapp" | "telegram";

export interface IncomingMediaRef {
  /**
   * Referência opaca resolvida pelo MediaDownloader do canal.
   * WAHA: a URL da mídia. Telegram: o file_id.
   */
  ref: string;
  mimetype?: string | null;
  filename?: string | null;
}

export type IncomingIdentity =
  | { kind: "phone"; value: string; raw?: Record<string, unknown> }
  | { kind: "telegram"; value: string; raw?: Record<string, unknown> };

/**
 * Contato compartilhado pelo operador (Telegram `request_contact`). Usado para
 * o auto-vínculo do `telegramUserId`: o operador toca em "compartilhar telefone"
 * e o backend casa o `phone` com um `User` já cadastrado. `belongsToSender` diz
 * se o contato é o do próprio remetente (o Telegram garante isso no botão de
 * request_contact — `contact.user_id === from.id`); só nesse caso vinculamos.
 */
export interface SharedContact {
  phone: string;
  belongsToSender: boolean;
}

export interface IncomingMessage {
  channel: Channel;
  /**
   * Destino para responder, já namespaced por canal (ver §4 do plano).
   * WhatsApp mantém o JID atual; Telegram usa o prefixo `tg:<chat_id>`.
   */
  chatId: string;
  messageId?: string;
  text: string;
  media?: IncomingMediaRef | null;
  /** Identidade crua para o resolvedor do canal (telefone-digits ou telegram id). */
  identity: IncomingIdentity;
  /** Presente quando o operador compartilhou um contato (onboarding Telegram). */
  sharedContact?: SharedContact | null;
}
