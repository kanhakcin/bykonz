import { describe, expect, it } from "vitest";
import { loadConfig, normalizeUrlOriginAndPath } from "../src/config/env";

describe("env config", () => {
  it("normalizes URLs while preserving path", () => {
    expect(
      normalizeUrlOriginAndPath("https://project-ref.storage.supabase.co/storage/v1/s3/", "ENDPOINT")
    ).toBe(
      "https://project-ref.storage.supabase.co/storage/v1/s3"
    );
  });

  it("loads S3 storage config", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://user:pass@example.com:5432/postgres",
      ENDPOINT: "https://project-ref.storage.supabase.co/storage/v1/s3/",
      REGION: "sa-east-1",
      ACCESS_KEY_ID: "access-key",
      SECRET_ACCESS_KEY: "secret-key",
      S3_BUCKET: "tatacon",
      WAHA_BASE_URL: "http://localhost:3000/",
      WAHA_API_KEY: "waha-key",
      WAHA_SESSION: "default"
    });

    expect(config.s3Endpoint).toBe("https://project-ref.storage.supabase.co/storage/v1/s3");
    expect(config.s3Region).toBe("sa-east-1");
    expect(config.s3AccessKeyId).toBe("access-key");
    expect(config.s3SecretAccessKey).toBe("secret-key");
    expect(config.wahaBaseUrl).toBe("http://localhost:3000");
  });
});
