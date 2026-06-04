import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppConfig } from "../config/env";
import type { ObjectStorage } from "../services/conversationService";

interface S3Sender {
  send(command: PutObjectCommand): Promise<unknown>;
}

export class SupabaseObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3Sender,
    private readonly bucket: string
  ) {}

  static fromConfig(config: AppConfig): SupabaseObjectStorage {
    const client = new S3Client({
      forcePathStyle: true,
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey
      }
    });

    return new SupabaseObjectStorage(client, config.supabaseStorageBucket);
  }

  async uploadPrivateObject(input: {
    path: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.path,
          Body: input.body,
          ContentType: input.contentType
        })
      );
    } catch (error) {
      throw new Error(`Supabase S3 upload failed: ${formatStorageError(error)}`);
    }
  }
}

function formatStorageError(error: unknown): string {
  if (!isRecord(error)) {
    return String(error);
  }

  const fields = [
    ["name", error.name],
    ["code", error.Code],
    ["bucket", error.BucketName],
    ["key", error.Key],
    ["status", error.status],
    ["statusCode", error.statusCode],
    ["httpStatusCode", isRecord(error.$metadata) ? error.$metadata.httpStatusCode : undefined],
    ["error", error.error],
    ["message", error.message]
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`);

  return fields.length > 0 ? fields.join(" ") : JSON.stringify(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
