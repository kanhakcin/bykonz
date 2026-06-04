import { PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { SupabaseObjectStorage } from "../src/lib/supabaseStorage";

describe("SupabaseObjectStorage", () => {
  it("uploads objects with S3 PutObjectCommand", async () => {
    const sent: PutObjectCommand[] = [];
    const storage = new SupabaseObjectStorage(
      {
        send: async (command: PutObjectCommand) => {
          sent.push(command);
        }
      },
      "tatacon"
    );

    await storage.uploadPrivateObject({
      path: "entradas/10/7/2026-06-04/photo.jpg",
      body: Buffer.from("image-bytes"),
      contentType: "image/jpeg"
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].input).toMatchObject({
      Bucket: "tatacon",
      Key: "entradas/10/7/2026-06-04/photo.jpg",
      ContentType: "image/jpeg"
    });
    expect(sent[0].input.Body).toEqual(Buffer.from("image-bytes"));
  });
});
