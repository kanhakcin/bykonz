import "dotenv/config";

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  s3Endpoint: string | undefined;
  s3Region: string | undefined;
  s3AccessKeyId: string | undefined;
  s3SecretAccessKey: string | undefined;
  s3Bucket: string | undefined;
  webhookSecret: string | undefined;
  /** WAHA (WhatsApp) — opcional; presente apenas se o canal estiver configurado. */
  wahaBaseUrl: string | undefined;
  wahaApiKey: string | undefined;
  wahaSession: string | undefined;
  /** Telegram — opcional; presente apenas se o canal estiver configurado. */
  telegramBotToken: string | undefined;
  telegramWebhookSecret: string | undefined;
  panelJwtSecret: string | undefined;
  /** Uma ou mais origens permitidas (separadas por vírgula no env). */
  panelCorsOrigins: string[];
  panelTimezoneOffset: string;
  dailyReportCron: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = ["DATABASE_URL"] as const;

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  // Canais WAHA e Telegram são opcionais e independentes, mas exige-se pelo
  // menos um configurado (ambos podem rodar ao mesmo tempo). Ver Revisão v1.1.
  const wahaConfigured = Boolean(env.WAHA_BASE_URL && env.WAHA_API_KEY && env.WAHA_SESSION);
  const telegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN);
  if (!wahaConfigured && !telegramConfigured) {
    throw new Error(
      "No messaging channel configured: set WAHA_BASE_URL/WAHA_API_KEY/WAHA_SESSION (WhatsApp) and/or TELEGRAM_BOT_TOKEN (Telegram)."
    );
  }

  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return {
    nodeEnv: env.NODE_ENV ?? "development",
    port,
    databaseUrl: env.DATABASE_URL!,
    s3Endpoint: env.ENDPOINT ? normalizeUrlOriginAndPath(env.ENDPOINT, "ENDPOINT") : undefined,
    s3Region: env.REGION,
    s3AccessKeyId: env.ACCESS_KEY_ID,
    s3SecretAccessKey: env.SECRET_ACCESS_KEY,
    s3Bucket: env.S3_BUCKET,
    webhookSecret: env.WEBHOOK_SECRET,
    wahaBaseUrl: wahaConfigured ? env.WAHA_BASE_URL!.replace(/\/+$/, "") : undefined,
    wahaApiKey: wahaConfigured ? env.WAHA_API_KEY! : undefined,
    wahaSession: wahaConfigured ? env.WAHA_SESSION! : undefined,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    panelJwtSecret: env.PANEL_JWT_SECRET,
    panelCorsOrigins: (env.PANEL_CORS_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    panelTimezoneOffset: env.PANEL_TZ_OFFSET ?? "-03:00",
    dailyReportCron: env.DAILY_REPORT_CRON ?? "0 18 * * *"
  };
}

export function normalizeUrlOriginAndPath(value: string, name: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}
