import { describe, expect, it, vi } from "vitest";
import { runDailyReportJob, type DailyReportJobDeps } from "../src/jobs/dailyReportJob";
import type { DailyReportService } from "../src/services/dailyReportService";
import type { MessagingClient, ObraForReport } from "../src/services/conversationService";

function makeObra(overrides: Partial<ObraForReport> = {}): ObraForReport {
  return {
    id: 1,
    nome: "Obra Residencial Aurora",
    whatsappGroupId: "1203630xxxxx@g.us",
    whatsappAutoReportEnabled: true,
    status: "ACTIVE",
    ...overrides
  };
}

function makeMessaging(): MessagingClient & {
  messages: Array<{ chatId: string; text: string }>;
  files: Array<{ chatId: string; file: { mimetype: string; filename: string; data: string } }>;
} {
  return {
    messages: [],
    files: [],
    async sendText(chatId, text) {
      this.messages.push({ chatId, text });
    },
    async sendFile(chatId, file) {
      this.files.push({ chatId, file });
    }
  };
}

describe("runDailyReportJob", () => {
  it("skips an obra without a whatsappGroupId and logs an error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const dailyReportService = { generateForObraDay: vi.fn() } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: { findObrasForAutoReport: async () => [makeObra({ whatsappGroupId: null })] },
      messaging
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(dailyReportService.generateForObraDay).not.toHaveBeenCalled();
    expect(messaging.messages).toHaveLength(0);
    expect(messaging.files).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("sends a text notice when the obra has no records that day", async () => {
    const messaging = makeMessaging();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 0 })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: { findObrasForAutoReport: async () => [makeObra()] },
      messaging
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(messaging.files).toHaveLength(0);
    expect(messaging.messages).toHaveLength(1);
    expect(messaging.messages[0].chatId).toBe("1203630xxxxx@g.us");
    expect(messaging.messages[0].text).toContain("nenhum registro");
  });

  it("sends the PDF file when the obra has records that day", async () => {
    const messaging = makeMessaging();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF-content"), totalEntradas: 3 })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: { findObrasForAutoReport: async () => [makeObra()] },
      messaging
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(messaging.files).toHaveLength(1);
    expect(messaging.files[0].chatId).toBe("1203630xxxxx@g.us");
    expect(messaging.files[0].file.mimetype).toBe("application/pdf");
    expect(Buffer.from(messaging.files[0].file.data, "base64").toString()).toBe("%PDF-content");
    expect(messaging.messages).toHaveLength(1);
    expect(messaging.messages[0].chatId).toBe("1203630xxxxx@g.us");
    expect(messaging.messages[0].text).toBe("✅ Diário de obra gerado e enviado automaticamente.");
  });

  it("continues processing remaining obras when one fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const dailyReportService = {
      generateForObraDay: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce({ buffer: Buffer.from("%PDF"), totalEntradas: 1 })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ id: 1, nome: "Obra Quebrada" }),
          makeObra({ id: 2, nome: "Obra OK", whatsappGroupId: "9999@g.us" })
        ]
      },
      messaging
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(messaging.files).toHaveLength(1);
    expect(messaging.files[0].chatId).toBe("9999@g.us");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("logs an error and skips when the obra is not found", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue(null)
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: { findObrasForAutoReport: async () => [makeObra()] },
      messaging
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(messaging.messages).toHaveLength(0);
    expect(messaging.files).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
