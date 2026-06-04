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
});
