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
  wahaBaseUrl: string;
  wahaApiKey: string;
  wahaSession: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const required = [
    "DATABASE_URL",
    "WAHA_BASE_URL",
    "WAHA_API_KEY",
    "WAHA_SESSION"
  ] as const;

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
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
    wahaBaseUrl: env.WAHA_BASE_URL!.replace(/\/+$/, ""),
    wahaApiKey: env.WAHA_API_KEY!,
    wahaSession: env.WAHA_SESSION!
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
