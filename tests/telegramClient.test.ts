import { afterEach, describe, expect, it, vi } from "vitest";
import { TelegramClient } from "../src/lib/telegramClient";
import { TELEGRAM_CHAT_PREFIX } from "../src/channels/telegram/inbound";

const TOKEN = "123:ABC";

describe("TelegramClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends text via sendMessage, stripping the tg: prefix from chatId", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new TelegramClient(TOKEN);
    await client.sendText(`${TELEGRAM_CHAT_PREFIX}555`, "oi");

    expect(fetchMock).toHaveBeenCalledWith(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: "555", text: "oi" })
    });
  });

  it("sends a document via multipart sendDocument", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new TelegramClient(TOKEN);
    await client.sendFile(
      `${TELEGRAM_CHAT_PREFIX}555`,
      { mimetype: "application/pdf", filename: "diario.pdf", data: Buffer.from("pdf-bytes").toString("base64") },
      "Diário de obra"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendDocument`);
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("chat_id")).toBe("555");
    expect(form.get("caption")).toBe("Diário de obra");
    expect(form.get("document")).toBeInstanceOf(Blob);
  });

  it("downloads media via getFile then the file endpoint, stripping the tg: prefix", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { file_id: "f1", file_unique_id: "u", file_path: "photos/x.jpg" } }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response("image-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new TelegramClient(TOKEN);
    const buffer = await client.download(`${TELEGRAM_CHAT_PREFIX}f1`);

    expect(buffer.toString()).toBe("image-bytes");
    expect(fetchMock).toHaveBeenNthCalledWith(1, `https://api.telegram.org/bot${TOKEN}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: "f1" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, `https://api.telegram.org/file/bot${TOKEN}/photos/x.jpg`);
  });

  it("throws when getFile returns no file_path", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new TelegramClient(TOKEN);
    await expect(client.download("tg:f1")).rejects.toThrow("no file_path");
  });
});
