import { describe, expect, it, vi } from "vitest";
import { runDailyReportJob, type DailyReportJobDeps } from "../src/jobs/dailyReportJob";
import type { DailyReportService } from "../src/services/dailyReportService";
import type { AuditLogEntry, AuditLogger, Mailer, MessagingClient, ObraForReport } from "../src/services/conversationService";

function makeObra(overrides: Partial<ObraForReport> = {}): ObraForReport {
  return {
    id: 1,
    nome: "Obra Residencial Aurora",
    whatsappGroupId: "1203630xxxxx@g.us",
    whatsappAutoReportEnabled: true,
    reportEmailRecipients: [],
    emailAutoReportEnabled: false,
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

function makeMailer(): Mailer & {
  sent: Array<{ to: string[]; subject: string; text: string; html?: string; attachments?: unknown[] }>;
} {
  return {
    sent: [],
    async sendMail(input) {
      this.sent.push(input);
    }
  };
}

function makeAuditLogger(): AuditLogger & { entries: AuditLogEntry[] } {
  return {
    entries: [],
    async record(entry) {
      this.entries.push(entry);
    }
  };
}

const actions = (logger: { entries: AuditLogEntry[] }) => logger.entries.map((e) => e.action);

describe("runDailyReportJob", () => {
  it("skips the WhatsApp channel (logging) when auto-report is on but whatsappGroupId is empty", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 2 })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: { findObrasForAutoReport: async () => [makeObra({ whatsappGroupId: null })] },
      messaging
    };

    await runDailyReportJob(deps, "2026-07-06");

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
      generateForObraDay: vi
        .fn()
        .mockResolvedValue({ buffer: Buffer.from("%PDF-content"), totalEntradas: 3, filename: "MRH - DO 133 - 06-07-26.pdf" })
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
    expect(messaging.files[0].file.filename).toBe("MRH - DO 133 - 06-07-26.pdf");
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

  it("sends only email for an obra with email enabled and WhatsApp disabled", async () => {
    const messaging = makeMessaging();
    const mailer = makeMailer();
    const dailyReportService = {
      generateForObraDay: vi
        .fn()
        .mockResolvedValue({ buffer: Buffer.from("%PDF-mail"), totalEntradas: 2, filename: "MRH - DO 5 - 06-07-26.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({
            whatsappAutoReportEnabled: false,
            whatsappGroupId: null,
            emailAutoReportEnabled: true,
            reportEmailRecipients: ["eng@empresa.com.br", "cliente@empresa.com.br"]
          })
        ]
      },
      messaging,
      mailer
    };

    await runDailyReportJob(deps, "2026-07-06");

    // Não tocou no WhatsApp.
    expect(messaging.files).toHaveLength(0);
    expect(messaging.messages).toHaveLength(0);
    // Enviou o e-mail com o PDF anexado para os destinatários.
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toEqual(["eng@empresa.com.br", "cliente@empresa.com.br"]);
    expect(mailer.sent[0].subject).toContain("Obra Residencial Aurora");
    // Corpo apresentável (HTML) + anexo do PDF.
    expect(mailer.sent[0].html).toContain("Diário de Obra");
    expect(mailer.sent[0].attachments).toHaveLength(1);
    expect((mailer.sent[0].attachments?.[0] as { filename: string }).filename).toBe("MRH - DO 5 - 06-07-26.pdf");
  });

  it("sends to both channels when both are enabled", async () => {
    const messaging = makeMessaging();
    const mailer = makeMailer();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 1, filename: "f.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ emailAutoReportEnabled: true, reportEmailRecipients: ["a@b.com"] })
        ]
      },
      messaging,
      mailer
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(messaging.files).toHaveLength(1);
    expect(mailer.sent).toHaveLength(1);
  });

  it("does not send email on an empty day (but WhatsApp still notices)", async () => {
    const messaging = makeMessaging();
    const mailer = makeMailer();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 0 })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ emailAutoReportEnabled: true, reportEmailRecipients: ["a@b.com"] })
        ]
      },
      messaging,
      mailer
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(mailer.sent).toHaveLength(0);
    // WhatsApp mantém o aviso de texto do dia vazio.
    expect(messaging.messages).toHaveLength(1);
    expect(messaging.messages[0].text).toContain("nenhum registro");
  });

  it("email failure does not block the WhatsApp channel", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const mailer: Mailer = {
      async sendMail() {
        throw new Error("smtp down");
      }
    };
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 1, filename: "f.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ emailAutoReportEnabled: true, reportEmailRecipients: ["a@b.com"] })
        ]
      },
      messaging,
      mailer
    };

    await runDailyReportJob(deps, "2026-07-06");

    // WhatsApp foi enviado mesmo com o e-mail falhando.
    expect(messaging.files).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not send email when enabled but recipients list is empty", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const mailer = makeMailer();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 1, filename: "f.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ whatsappAutoReportEnabled: false, emailAutoReportEnabled: true, reportEmailRecipients: [] })
        ]
      },
      messaging,
      mailer
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(mailer.sent).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not send email when the mailer is not configured (null)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 1, filename: "f.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ whatsappAutoReportEnabled: false, emailAutoReportEnabled: true, reportEmailRecipients: ["a@b.com"] })
        ]
      },
      messaging,
      mailer: null
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(messaging.files).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("audita geração + envio por canal (email e whatsapp)", async () => {
    const messaging = makeMessaging();
    const mailer = makeMailer();
    const audit = makeAuditLogger();
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 3, filename: "f.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ emailAutoReportEnabled: true, reportEmailRecipients: ["a@b.com"] })
        ]
      },
      messaging,
      mailer,
      auditLogger: audit
    };

    await runDailyReportJob(deps, "2026-07-06");

    expect(actions(audit)).toEqual(["report.generated", "report.whatsapp.sent", "report.email.sent"]);
    const email = audit.entries.find((e) => e.action === "report.email.sent");
    expect(email?.status).toBe("OK");
    expect(email?.actorType).toBe("SYSTEM");
    expect(email?.metadata).toMatchObject({ recipients: ["a@b.com"], filename: "f.pdf" });
  });

  it("audita falha de envio com status ERROR e não bloqueia o outro canal", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    const audit = makeAuditLogger();
    const mailer: Mailer = {
      async sendMail() {
        throw new Error("smtp down");
      }
    };
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 1, filename: "f.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: {
        findObrasForAutoReport: async () => [
          makeObra({ emailAutoReportEnabled: true, reportEmailRecipients: ["a@b.com"] })
        ]
      },
      messaging,
      mailer,
      auditLogger: audit
    };

    await runDailyReportJob(deps, "2026-07-06");

    // WhatsApp foi enviado (sent); e-mail falhou (failed com ERROR).
    expect(messaging.files).toHaveLength(1);
    expect(actions(audit)).toContain("report.whatsapp.sent");
    const failed = audit.entries.find((e) => e.action === "report.email.failed");
    expect(failed?.status).toBe("ERROR");
    expect(failed?.metadata).toMatchObject({ error: "smtp down" });
    errorSpy.mockRestore();
  });

  it("uma falha ao GRAVAR o log de auditoria não quebra o envio", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messaging = makeMessaging();
    // O contrato do AuditLogger é best-effort, mas o job não deve depender disso:
    // mesmo um logger que lança não pode derrubar o envio.
    const audit: AuditLogger = {
      async record() {
        throw new Error("db down");
      }
    };
    const dailyReportService = {
      generateForObraDay: vi.fn().mockResolvedValue({ buffer: Buffer.from("%PDF"), totalEntradas: 1, filename: "f.pdf" })
    } as unknown as DailyReportService;
    const deps: DailyReportJobDeps = {
      dailyReportService,
      store: { findObrasForAutoReport: async () => [makeObra()] },
      messaging,
      auditLogger: audit
    };

    await runDailyReportJob(deps, "2026-07-06");

    // O WhatsApp foi enviado apesar do logger lançar.
    expect(messaging.files).toHaveLength(1);
    errorSpy.mockRestore();
  });
});
