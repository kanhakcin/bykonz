import type { IncomingMessage } from "../../types/message";
import type { WahaMessagePayload, WahaWebhook } from "../../types/waha";
import { extractPhoneFromWahaPayload } from "../../utils/phone";

/**
 * Borda de entrada do canal WhatsApp (WAHA): traduz o webhook cru para o tipo
 * neutro `IncomingMessage`, ou devolve `null` quando o evento deve ser ignorado
 * (evento não suportado, mensagem própria, mensagem de grupo, chat ausente).
 *
 * Toda a especificidade de WAHA que antes vivia no ConversationService
 * (isSupportedWebhook, filtro de grupo, extração de telefone) foi movida p/ cá.
 */
export function wahaWebhookToIncomingMessage(webhook: WahaWebhook): IncomingMessage | null {
  if (!isSupportedWebhook(webhook)) {
    return null;
  }

  const payload = webhook.payload;
  const chatId = payload.from ?? payload.chatId;
  if (!chatId) {
    return null;
  }

  // Grupos (ex. usados para o relatório automático) ficam em standby: o bot
  // nunca responde lá, só recebe o PDF automático.
  if (chatId.endsWith("@g.us")) {
    return null;
  }

  const phoneDigits = extractPhoneFromWahaPayload(payload);

  const media =
    payload.hasMedia && payload.media?.url
      ? {
          ref: payload.media.url,
          mimetype: payload.media.mimetype ?? null,
          filename: payload.media.filename ?? null
        }
      : null;

  return {
    channel: "whatsapp",
    chatId,
    messageId: payload.id,
    text: payload.body ?? "",
    media,
    identity: {
      kind: "phone",
      value: phoneDigits,
      raw: payload._data
    }
  };
}

function isSupportedWebhook(
  webhook: WahaWebhook
): webhook is WahaWebhook & { payload: WahaMessagePayload } {
  if (webhook.event !== "message" && webhook.event !== "message.any") {
    return false;
  }

  if (!webhook.payload) {
    return false;
  }

  if (webhook.payload.fromMe || webhook.payload.source === "api") {
    return false;
  }

  return true;
}
