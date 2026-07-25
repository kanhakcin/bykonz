import { afterEach, describe, expect, it, vi } from "vitest";
import { WahaClient } from "../src/lib/wahaClient";

describe("WahaClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads media using WAHA_BASE_URL when WAHA returns a localhost URL", async () => {
    const fetchMock = vi.fn(async () => new Response("image-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WahaClient("http://waha:3000", "secret", "default");

    await client.download("http://localhost:3000/api/files/photo.jpg");

    expect(fetchMock).toHaveBeenCalledWith("http://waha:3000/api/files/photo.jpg", {
      headers: {
        "X-Api-Key": "secret"
      }
    });
  });

  it("downloads media using WAHA_BASE_URL for relative media URLs", async () => {
    const fetchMock = vi.fn(async () => new Response("image-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WahaClient("http://waha:3000", "secret", "default");

    await client.download("/api/files/photo.jpg");

    expect(fetchMock).toHaveBeenCalledWith("http://waha:3000/api/files/photo.jpg", {
      headers: {
        "X-Api-Key": "secret"
      }
    });
  });

  it("sends a file via POST /api/sendFile with application/pdf", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WahaClient("http://waha:3000", "secret", "default");

    await client.sendFile(
      "5511999@c.us",
      { mimetype: "application/pdf", filename: "relatorio.pdf", data: "base64data" }
    );

    expect(fetchMock).toHaveBeenCalledWith("http://waha:3000/api/sendFile", {
      method: "POST",
      headers: {
        "X-Api-Key": "secret",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session: "default",
        chatId: "5511999@c.us",
        file: { mimetype: "application/pdf", filename: "relatorio.pdf", data: "base64data" },
        caption: ""
      })
    });
  });

  it("throws when sendFile response is not ok", async () => {
    const fetchMock = vi.fn(async () => new Response("Bad Request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WahaClient("http://waha:3000", "secret", "default");

    await expect(
      client.sendFile("5511999@c.us", { mimetype: "application/pdf", filename: "r.pdf", data: "x" })
    ).rejects.toThrow("400");
  });

  it("sends an inline image via POST /api/sendImage (not as document)", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WahaClient("http://waha:3000", "secret", "default");

    await client.sendImage("123@g.us", { mimetype: "image/jpeg", filename: "foto.jpg", data: "base64img" }, "legenda");

    expect(fetchMock).toHaveBeenCalledWith("http://waha:3000/api/sendImage", {
      method: "POST",
      headers: {
        "X-Api-Key": "secret",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session: "default",
        chatId: "123@g.us",
        file: { mimetype: "image/jpeg", filename: "foto.jpg", data: "base64img" },
        caption: "legenda"
      })
    });
  });

  it("defaults the image filename when omitted", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WahaClient("http://waha:3000", "secret", "default");
    await client.sendImage("123@g.us", { mimetype: "image/jpeg", data: "x" });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.file.filename).toBe("foto.jpg");
    expect(body.caption).toBe("");
  });

  it("throws when sendImage response is not ok", async () => {
    const fetchMock = vi.fn(async () => new Response("Bad Request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new WahaClient("http://waha:3000", "secret", "default");

    await expect(client.sendImage("123@g.us", { mimetype: "image/jpeg", data: "x" })).rejects.toThrow("400");
  });
});
