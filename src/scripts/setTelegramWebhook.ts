import "dotenv/config";

/**
 * Registra (uma vez) a URL do webhook do bot Telegram via `setWebhook`.
 * https://core.telegram.org/bots/api#setwebhook
 *
 * Uso:
 *   npm run telegram:set-webhook -- https://seu-dominio.com/webhooks/telegram
 *
 * Lê TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET do ambiente (.env). O secret
 * passa a ser devolvido pelo Telegram no header X-Telegram-Bot-Api-Secret-Token
 * a cada chamada, e é validado pela rota /webhooks/telegram.
 */
async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  const url = process.argv[2];
  if (!url) {
    throw new Error(
      "Missing webhook URL. Usage: npm run telegram:set-webhook -- https://<host>/webhooks/telegram"
    );
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret || undefined,
      // v1 = conversa privada 1:1: só nos interessam mensagens.
      allowed_updates: ["message"]
    })
  });

  const payload = (await response.json()) as { ok: boolean; description?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(`setWebhook failed (${response.status}): ${payload.description ?? "unknown error"}`);
  }

  console.log(`Telegram webhook registered at ${url}${secret ? " (with secret token)" : ""}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
