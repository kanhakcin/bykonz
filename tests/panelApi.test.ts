import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp, type WebhookHandler } from "../src/app";
import { createPanelRouter } from "../src/api/panelRouter";
import {
  PanelService,
  type AlertRecord,
  type CodeRef,
  type EntryRecord,
  type PanelStore,
  type PersonRef,
  type ProjectRecord
} from "../src/services/panelService";

const TOKEN = "test-token";
const ORIGIN = "http://localhost:5173";

class FakeWebhookHandler implements WebhookHandler {
  async handleWebhook(): Promise<void> {}
}

function dateAt(time: string): Date {
  return new Date(`2026-07-03T${time}:00-03:00`);
}

class FakePanelStore implements PanelStore {
  project: ProjectRecord | null = {
    id: 1,
    name: "Obra Residencial Aurora",
    attributes: { context: "Apto 1403 · Laje tipo 04" },
    sector: { code: "CIVIL", name: "Construção civil" }
  };

  entries: EntryRecord[] = [];
  alerts: AlertRecord[] = [];
  standards: CodeRef[] = [{ id: 24, code: "PS-024" }];
  people: PersonRef[] = [{ id: 118, name: "José Pereira", registrationCode: "MAT-118" }];
  machines: CodeRef[] = [{ id: 7, code: "MX-007" }];
  assets: CodeRef[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.entries = [
      {
        id: 1n,
        createdAt: dateAt("09:14"),
        description: "Grauteamento da canaleta inferior.",
        authorName: "Eng. Marina Alves",
        media: { id: 101n, mediaType: "image/jpeg" },
        mediaCount: 1,
        mentions: [
          {
            id: 11,
            entityType: "STANDARD",
            entityId: 24,
            source: "CODE",
            confidence: null,
            matchedText: "(PS-024)",
            confirmed: true
          }
        ]
      },
      {
        id: 2n,
        createdAt: dateAt("09:16"),
        description: "José está realizando o grauteamento.",
        authorName: "Eng. Marina Alves",
        media: null,
        mediaCount: 1,
        mentions: [
          {
            id: 22,
            entityType: "PERSON",
            entityId: 118,
            source: "AI",
            confidence: 0.82,
            matchedText: "José",
            confirmed: false
          }
        ]
      },
      {
        id: 4n,
        createdAt: dateAt("10:02"),
        description: "Misturadora em operação.",
        authorName: "Téc. Paulo Reis",
        media: { id: 104n, mediaType: null },
        mediaCount: 1,
        mentions: [
          {
            id: 41,
            entityType: "MACHINE",
            entityId: 7,
            source: "CODE",
            confidence: null,
            matchedText: "(MX-007)",
            confirmed: true
          }
        ]
      }
    ];

    this.alerts = [
      {
        id: 1,
        entryId: 2n,
        mentionId: 22,
        type: "PERSON_NOT_TRAINED",
        severity: "WARNING",
        title: "José Pereira não treinado",
        detail: "Competência ausente para a norma PS-024.",
        status: "OPEN"
      },
      {
        id: 2,
        entryId: 4n,
        mentionId: 41,
        type: "MACHINE_INSPECTION_EXPIRED",
        severity: "CRITICAL",
        title: "Misturadora MX-007 — vistoria vencida",
        detail: "Última vistoria em 02/05.",
        status: "OPEN"
      }
    ];
  }

  async getProject(projectId?: number): Promise<ProjectRecord | null> {
    if (projectId && projectId !== this.project?.id) {
      return null;
    }
    return this.project;
  }

  async findEntriesForDay(input: { start: Date; end: Date }): Promise<EntryRecord[]> {
    return this.entries.filter((e) => e.createdAt >= input.start && e.createdAt < input.end);
  }

  async findAlertsForEntries(entryIds: bigint[]): Promise<AlertRecord[]> {
    const ids = new Set(entryIds.map((id) => id.toString()));
    return this.alerts.filter((a) => ids.has(a.entryId.toString()));
  }

  async findMediaById(id: bigint) {
    if (id === 101n) {
      return { id, mediaUrl: "entries/1/photo.jpg", mediaType: "image/jpeg" };
    }
    if (id === 104n) {
      return { id, mediaUrl: "entries/4/photo.png", mediaType: null };
    }
    return null;
  }

  async findStandardsByIds(ids: number[]): Promise<CodeRef[]> {
    return this.standards.filter((s) => ids.includes(s.id));
  }

  async findPeopleByIds(ids: number[]): Promise<PersonRef[]> {
    return this.people.filter((p) => ids.includes(p.id));
  }

  async findMachinesByIds(ids: number[]): Promise<CodeRef[]> {
    return this.machines.filter((m) => ids.includes(m.id));
  }

  async findAssetsByIds(ids: number[]): Promise<CodeRef[]> {
    return this.assets.filter((a) => ids.includes(a.id));
  }

  async resolveAlert(id: number): Promise<boolean> {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) {
      return false;
    }
    alert.status = "RESOLVED";
    return true;
  }

  async acknowledgeAlert(id: number): Promise<boolean> {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) {
      return false;
    }
    alert.status = "ACKNOWLEDGED";
    return true;
  }

  async confirmMention(id: number): Promise<boolean> {
    for (const entry of this.entries) {
      const mention = entry.mentions.find((m) => m.id === id);
      if (mention) {
        mention.confirmed = true;
        return true;
      }
    }
    return false;
  }

  async rejectMention(id: number): Promise<boolean> {
    for (const entry of this.entries) {
      const index = entry.mentions.findIndex((m) => m.id === id);
      if (index >= 0) {
        entry.mentions.splice(index, 1);
        return true;
      }
    }
    return false;
  }
}

let store: FakePanelStore;
const storage = {
  downloads: [] as string[],
  async downloadPrivateObject(path: string): Promise<Buffer> {
    this.downloads.push(path);
    return Buffer.from(`image:${path}`);
  }
};

function buildApp() {
  store = new FakePanelStore();
  storage.downloads = [];
  const service = new PanelService(store, { timezoneOffset: "-03:00", mediaStorage: storage });
  const panelRouter = createPanelRouter(service, {
    token: TOKEN,
    corsOrigins: [ORIGIN],
    user: { name: "Ricardo Tanen", role: "Gestor de obra" }
  });
  return createApp(new FakeWebhookHandler(), undefined, { panelRouter });
}

const auth = { Authorization: `Bearer ${TOKEN}` };

describe("panel API auth", () => {
  it("rejects requests without a bearer token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/diary");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a wrong token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/diary").set("Authorization", "Bearer wrong");
    expect(res.status).toBe(401);
  });

  it("logs in with the panel token as password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "gestor@tanen.com.br", password: TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe(TOKEN);
    expect(res.body.user).toMatchObject({
      name: "Ricardo Tanen",
      initials: "RT",
      role: "Gestor de obra",
      email: "gestor@tanen.com.br"
    });
  });

  it("rejects login with a wrong password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "gestor@tanen.com.br", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
  });

  it("answers CORS preflight for the configured origin", async () => {
    const app = buildApp();
    const res = await request(app)
      .options("/api/v1/diary")
      .set("Origin", ORIGIN)
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Authorization");

    expect(res.status).toBeLessThan(300);
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
  });
});

describe("GET /api/v1/diary", () => {
  it("returns the aggregated day with KPIs, statuses, labels and triage", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/diary?date=2026-07-03").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-07-03");
    expect(res.body.project).toMatchObject({
      id: 1,
      name: "Obra Residencial Aurora",
      context: "Apto 1403 · Laje tipo 04",
      sector: { code: "CIVIL" }
    });

    expect(res.body.kpis).toEqual({
      entries: 3,
      compliant: 1,
      compliancePct: 33,
      openAlerts: 2,
      pendingTriage: 1,
      linkedStandards: 1
    });

    const statuses = Object.fromEntries(
      res.body.entries.map((e: { id: number; status: string }) => [e.id, e.status])
    );
    expect(statuses).toEqual({ "1": "COMPLIANT", "2": "ALERT", "4": "CRITICAL" });

    const labels = res.body.entries.flatMap((e: { mentions: Array<{ label: string }> }) =>
      e.mentions.map((m) => m.label)
    );
    expect(labels).toEqual(["PS-024", "José Pereira", "MX-007"]);

    const entry1 = res.body.entries.find((e: { id: number }) => e.id === 1);
    const entry2 = res.body.entries.find((e: { id: number }) => e.id === 2);
    expect(entry1.mediaUrl).toBe("/media/101");
    expect(entry2.mediaUrl).toBeNull();

    const personAlert = res.body.alerts.find((a: { id: number }) => a.id === 1);
    expect(personAlert.reference).toBe("Registro 09:16 · MAT-118");
    const machineAlert = res.body.alerts.find((a: { id: number }) => a.id === 2);
    expect(machineAlert.reference).toBe("Registro 10:02");

    expect(res.body.triage).toEqual([
      {
        id: 22,
        entryId: 2,
        matchedText: '"José"',
        suggestion: "José Pereira (MAT-118)",
        confidence: 0.82,
        reference: "Registro 09:16"
      }
    ]);
  });

  it("falls back to matchedText when the entity id cannot be resolved", async () => {
    const app = buildApp();
    store.standards = [];
    const res = await request(app).get("/api/v1/diary?date=2026-07-03").set(auth);

    const entry1 = res.body.entries.find((e: { id: number }) => e.id === 1);
    expect(entry1.mentions[0].label).toBe("(PS-024)");
  });

  it("returns 400 for an invalid date", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/diary?date=03/07/2026").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_date");
  });

  it("returns 404 when the project does not exist", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/diary?date=2026-07-03&projectId=99").set(auth);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/media/:id", () => {
  it("serves a private media object through the authenticated proxy", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/media/101").set(auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(res.headers["cache-control"]).toBe("private, max-age=300");
    expect(res.body).toEqual(Buffer.from("image:entries/1/photo.jpg"));
    expect(storage.downloads).toEqual(["entries/1/photo.jpg"]);
  });

  it("infers the content type when the media row has no type", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/media/104").set(auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
  });

  it("does not serve media without authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/media/101");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown media object", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/media/999").set(auth);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("media_not_found");
  });

  it("returns 400 for an invalid media id", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/media/abc").set(auth);
    expect(res.status).toBe(400);
  });
});

describe("panel actions", () => {
  beforeEach(() => {
    // buildApp resets the store per test via constructor
  });

  it("resolves an alert and removes it from the open list", async () => {
    const app = buildApp();
    const action = await request(app).post("/api/v1/alerts/1/resolve").set(auth);
    expect(action.status).toBe(200);
    expect(store.alerts.find((a) => a.id === 1)?.status).toBe("RESOLVED");

    const res = await request(app).get("/api/v1/diary?date=2026-07-03").set(auth);
    expect(res.body.kpis.openAlerts).toBe(1);
    const entry2 = res.body.entries.find((e: { id: number }) => e.id === 2);
    expect(entry2.status).toBe("COMPLIANT");
  });

  it("acknowledges an alert", async () => {
    const app = buildApp();
    const action = await request(app).post("/api/v1/alerts/2/acknowledge").set(auth);
    expect(action.status).toBe(200);
    expect(store.alerts.find((a) => a.id === 2)?.status).toBe("ACKNOWLEDGED");
  });

  it("confirms an AI mention and clears the triage", async () => {
    const app = buildApp();
    const action = await request(app).post("/api/v1/mentions/22/confirm").set(auth);
    expect(action.status).toBe(200);

    const res = await request(app).get("/api/v1/diary?date=2026-07-03").set(auth);
    expect(res.body.kpis.pendingTriage).toBe(0);
    expect(res.body.triage).toEqual([]);
  });

  it("rejects an AI mention by deleting it", async () => {
    const app = buildApp();
    const action = await request(app).post("/api/v1/mentions/22/reject").set(auth);
    expect(action.status).toBe(200);

    const entry2 = store.entries.find((e) => e.id === 2n);
    expect(entry2?.mentions).toEqual([]);
  });

  it("returns 404 for unknown action targets", async () => {
    const app = buildApp();
    for (const path of [
      "/api/v1/alerts/999/resolve",
      "/api/v1/alerts/999/acknowledge",
      "/api/v1/mentions/999/confirm",
      "/api/v1/mentions/999/reject"
    ]) {
      const res = await request(app).post(path).set(auth);
      expect(res.status).toBe(404);
    }
  });

  it("returns 400 for a non-numeric id", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/v1/alerts/abc/resolve").set(auth);
    expect(res.status).toBe(400);
  });
});
