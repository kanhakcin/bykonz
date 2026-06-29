import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { S3ObjectStorage } from "../src/lib/s3Storage";

describe("S3ObjectStorage", () => {
  it("uploads objects with S3 PutObjectCommand", async () => {
    const sent: Array<PutObjectCommand | GetObjectCommand> = [];
    const storage = new S3ObjectStorage(
      {
        send: async (command: PutObjectCommand | GetObjectCommand) => {
          sent.push(command);
          return {};
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
    expect((sent[0] as PutObjectCommand).input.Body).toEqual(Buffer.from("image-bytes"));
  });

  it("downloads objects with S3 GetObjectCommand", async () => {
    const imageData = Buffer.from("image-bytes");
    const sent: Array<PutObjectCommand | GetObjectCommand> = [];

    const storage = new S3ObjectStorage(
      {
        send: async (command: PutObjectCommand | GetObjectCommand) => {
          sent.push(command);
          if (command instanceof GetObjectCommand) {
            return {
              Body: (async function* () {
                yield imageData;
              })()
            };
          }
          return {};
        }
      },
      "tatacon"
    );

    const result = await storage.downloadPrivateObject("entradas/10/7/2026-06-04/photo.jpg");

    expect(result).toEqual(imageData);
    expect(sent).toHaveLength(1);
    expect(sent[0].input).toMatchObject({
      Bucket: "tatacon",
      Key: "entradas/10/7/2026-06-04/photo.jpg"
    });
  });

  it("throws when download returns no body", async () => {
    const storage = new S3ObjectStorage(
      {
        send: async () => ({ Body: undefined })
      },
      "tatacon"
    );

    await expect(storage.downloadPrivateObject("some/path.jpg")).rejects.toThrow("empty body");
  });
});
