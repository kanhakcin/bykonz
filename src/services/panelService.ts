/**
 * Manager-panel service: aggregates the diary of a day (entries, mentions,
 * alerts, AI triage and KPIs) and executes panel actions. Pure logic on top
 * of the PanelStore port — DB access lives in prismaPanelStore.ts.
 *
 * API contract is English; user-facing strings inside the data (titles,
 * descriptions) remain pt-BR content.
 */

export type EntityType = "STANDARD" | "PERSON" | "MACHINE" | "ASSET";
export type MentionSource = "CODE" | "AI" | "MANUAL" | "QR";
export type AlertType =
  | "PERSON_NOT_TRAINED"
  | "MACHINE_NO_INSPECTION"
  | "MACHINE_INSPECTION_EXPIRED"
  | "STANDARD_NOT_FOUND";
export type AlertSeverity = "WARNING" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type EntryStatus = "COMPLIANT" | "ALERT" | "CRITICAL";

// ---- Store records (what the port returns) --------------------------------

export interface ProjectRecord {
  id: number;
  name: string;
  attributes: unknown;
  sector: { code: string; name: string };
}

export interface MentionRecord {
  id: number;
  entityType: EntityType;
  entityId: number | null;
  source: MentionSource;
  confidence: number | null;
  matchedText: string | null;
  confirmed: boolean;
}

export interface EntryRecord {
  id: bigint;
  createdAt: Date;
  description: string | null;
  authorName: string | null;
  mentions: MentionRecord[];
  media: { id: bigint; mediaType: string | null } | null;
  mediaCount: number;
}

export interface MediaRecord {
  id: bigint;
  mediaUrl: string;
  mediaType: string | null;
}

export interface AlertRecord {
  id: number;
  entryId: bigint;
  mentionId: number | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string | null;
  status: AlertStatus;
}

export interface PersonRef {
  id: number;
  name: string;
  registrationCode: string | null;
}

export interface CodeRef {
  id: number;
  code: string;
}

export interface PanelStore {
  getProject(projectId?: number): Promise<ProjectRecord | null>;
  findEntriesForDay(input: { projectId: number; start: Date; end: Date }): Promise<EntryRecord[]>;
  findAlertsForEntries(entryIds: bigint[]): Promise<AlertRecord[]>;
  findMediaById(id: bigint): Promise<MediaRecord | null>;
  findStandardsByIds(ids: number[]): Promise<CodeRef[]>;
  findPeopleByIds(ids: number[]): Promise<PersonRef[]>;
  findMachinesByIds(ids: number[]): Promise<CodeRef[]>;
  findAssetsByIds(ids: number[]): Promise<CodeRef[]>;
  resolveAlert(id: number): Promise<boolean>;
  acknowledgeAlert(id: number): Promise<boolean>;
  confirmMention(id: number): Promise<boolean>;
  rejectMention(id: number): Promise<boolean>;
}

// ---- API DTOs ---------------------------------------------------------------

export interface DiaryMention {
  id: number;
  entityType: EntityType;
  entityId: number | null;
  label: string;
  source: MentionSource;
  confidence: number | null;
  confirmed: boolean;
}

export interface DiaryEntry {
  id: number;
  recordedAt: string;
  description: string;
  author: { name: string; initials: string };
  mentions: DiaryMention[];
  status: EntryStatus;
  mediaUrl: string | null;
  mediaCount: number;
}

export interface DiaryAlert {
  id: number;
  entryId: number;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string | null;
  reference: string;
  status: AlertStatus;
}

export interface DiaryTriageItem {
  id: number;
  entryId: number;
  matchedText: string;
  suggestion: string;
  confidence: number;
  reference: string;
}

export interface DiaryKpis {
  entries: number;
  compliant: number;
  compliancePct: number;
  openAlerts: number;
  pendingTriage: number;
  linkedStandards: number;
}

export interface DiaryDay {
  date: string;
  project: {
    id: number;
    name: string;
    context: string | null;
    sector: { code: string; name: string };
  };
  kpis: DiaryKpis;
  entries: DiaryEntry[];
  alerts: DiaryAlert[];
  triage: DiaryTriageItem[];
}

export interface PanelMediaStorage {
  downloadPrivateObject(path: string): Promise<Buffer>;
}

export interface DiaryMedia {
  body: Buffer;
  contentType: string;
}

export class PanelService {
  constructor(
    private readonly store: PanelStore,
    private readonly options: { timezoneOffset?: string; mediaStorage?: PanelMediaStorage } = {}
  ) {}

  private get tzOffset(): string {
    return this.options.timezoneOffset ?? "-03:00";
  }

  async getDiaryDay(input: { date?: string; projectId?: number }): Promise<DiaryDay | null> {
    const date = input.date ?? this.todayISODate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new InvalidDateError(date);
    }

    const project = await this.store.getProject(input.projectId);
    if (!project) {
      return null;
    }

    const start = new Date(`${date}T00:00:00${this.tzOffset}`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const entries = await this.store.findEntriesForDay({ projectId: project.id, start, end });
    const alerts = await this.store.findAlertsForEntries(entries.map((e) => e.id));
    const labels = await this.resolveLabels(entries);

    const openAlerts = alerts.filter((a) => a.status === "OPEN");
    const openByEntry = new Map<string, AlertRecord[]>();
    for (const alert of openAlerts) {
      const key = alert.entryId.toString();
      openByEntry.set(key, [...(openByEntry.get(key) ?? []), alert]);
    }

    const entryTimes = new Map(entries.map((e) => [e.id.toString(), this.formatTime(e.createdAt)]));

    const diaryEntries: DiaryEntry[] = entries.map((entry) => {
      const open = openByEntry.get(entry.id.toString()) ?? [];
      const status: EntryStatus = open.some((a) => a.severity === "CRITICAL")
        ? "CRITICAL"
        : open.length > 0
          ? "ALERT"
          : "COMPLIANT";

      return {
        id: Number(entry.id),
        recordedAt: entry.createdAt.toISOString(),
        description: entry.description ?? "",
        author: {
          name: entry.authorName ?? "—",
          initials: initialsOf(entry.authorName)
        },
        mentions: entry.mentions.map((m) => ({
          id: m.id,
          entityType: m.entityType,
          entityId: m.entityId,
          label: labels.labelFor(m),
          source: m.source,
          confidence: m.confidence,
          confirmed: m.confirmed
        })),
        status,
        mediaUrl: entry.media ? `/media/${entry.media.id.toString()}` : null,
        mediaCount: entry.mediaCount
      };
    });

    const diaryAlerts: DiaryAlert[] = openAlerts.map((alert) => {
      const time = entryTimes.get(alert.entryId.toString()) ?? "--:--";
      const person = labels.personForMention(alert.mentionId);
      const reference =
        person?.registrationCode != null
          ? `Registro ${time} · ${person.registrationCode}`
          : `Registro ${time}`;

      return {
        id: alert.id,
        entryId: Number(alert.entryId),
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        reference,
        status: alert.status
      };
    });

    const triage: DiaryTriageItem[] = [];
    for (const entry of entries) {
      for (const mention of entry.mentions) {
        if (mention.source !== "AI" || mention.confirmed) {
          continue;
        }
        const person = mention.entityType === "PERSON" ? labels.personById(mention.entityId) : null;
        const suggestion = person
          ? person.registrationCode
            ? `${person.name} (${person.registrationCode})`
            : person.name
          : labels.labelFor(mention);
        triage.push({
          id: mention.id,
          entryId: Number(entry.id),
          matchedText: `"${mention.matchedText ?? "?"}"`,
          suggestion,
          confidence: mention.confidence ?? 0,
          reference: `Registro ${entryTimes.get(entry.id.toString()) ?? "--:--"}`
        });
      }
    }

    const compliant = diaryEntries.filter((e) => e.status === "COMPLIANT").length;
    const linkedStandards = new Set(
      diaryEntries.flatMap((e) => e.mentions.filter((m) => m.entityType === "STANDARD").map((m) => m.label))
    ).size;

    const attributes = project.attributes;
    const context =
      attributes && typeof attributes === "object" && !Array.isArray(attributes)
        ? stringOrNull((attributes as Record<string, unknown>).context)
        : null;

    return {
      date,
      project: {
        id: project.id,
        name: project.name,
        context,
        sector: project.sector
      },
      kpis: {
        entries: diaryEntries.length,
        compliant,
        compliancePct: diaryEntries.length ? Math.round((compliant / diaryEntries.length) * 100) : 100,
        openAlerts: diaryAlerts.length,
        pendingTriage: triage.length,
        linkedStandards
      },
      entries: diaryEntries,
      alerts: diaryAlerts,
      triage
    };
  }

  resolveAlert(id: number): Promise<boolean> {
    return this.store.resolveAlert(id);
  }

  acknowledgeAlert(id: number): Promise<boolean> {
    return this.store.acknowledgeAlert(id);
  }

  confirmMention(id: number): Promise<boolean> {
    return this.store.confirmMention(id);
  }

  rejectMention(id: number): Promise<boolean> {
    return this.store.rejectMention(id);
  }

  async getMedia(id: bigint): Promise<DiaryMedia | null> {
    if (!this.options.mediaStorage) {
      throw new Error("Panel media storage is not configured");
    }

    const media = await this.store.findMediaById(id);
    if (!media) {
      return null;
    }

    return {
      body: await this.options.mediaStorage.downloadPrivateObject(media.mediaUrl),
      contentType: media.mediaType ?? contentTypeFromPath(media.mediaUrl)
    };
  }

  private todayISODate(): string {
    return this.shiftToPanelTz(new Date()).toISOString().slice(0, 10);
  }

  /** HH:MM no fuso do painel. */
  private formatTime(date: Date): string {
    return this.shiftToPanelTz(date).toISOString().slice(11, 16);
  }

  private shiftToPanelTz(date: Date): Date {
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(this.tzOffset);
    if (!match) {
      return date;
    }
    const sign = match[1] === "-" ? -1 : 1;
    const offsetMs = sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
    return new Date(date.getTime() + offsetMs);
  }

  private async resolveLabels(entries: EntryRecord[]) {
    const idsByType = new Map<EntityType, Set<number>>();
    const mentionById = new Map<number, MentionRecord>();
    for (const entry of entries) {
      for (const mention of entry.mentions) {
        mentionById.set(mention.id, mention);
        if (mention.entityId != null) {
          const set = idsByType.get(mention.entityType) ?? new Set<number>();
          set.add(mention.entityId);
          idsByType.set(mention.entityType, set);
        }
      }
    }

    const [standards, people, machines, assets] = await Promise.all([
      this.store.findStandardsByIds([...(idsByType.get("STANDARD") ?? [])]),
      this.store.findPeopleByIds([...(idsByType.get("PERSON") ?? [])]),
      this.store.findMachinesByIds([...(idsByType.get("MACHINE") ?? [])]),
      this.store.findAssetsByIds([...(idsByType.get("ASSET") ?? [])])
    ]);

    const codeMaps: Record<Exclude<EntityType, "PERSON">, Map<number, string>> = {
      STANDARD: new Map(standards.map((s) => [s.id, s.code])),
      MACHINE: new Map(machines.map((m) => [m.id, m.code])),
      ASSET: new Map(assets.map((a) => [a.id, a.code]))
    };
    const peopleMap = new Map(people.map((p) => [p.id, p]));

    return {
      labelFor(mention: MentionRecord): string {
        if (mention.entityId == null) {
          return mention.matchedText ?? "?";
        }
        if (mention.entityType === "PERSON") {
          return peopleMap.get(mention.entityId)?.name ?? mention.matchedText ?? "?";
        }
        return codeMaps[mention.entityType].get(mention.entityId) ?? mention.matchedText ?? "?";
      },
      personById(id: number | null): PersonRef | null {
        return id != null ? (peopleMap.get(id) ?? null) : null;
      },
      personForMention: (mentionId: number | null): PersonRef | null => {
        if (mentionId == null) {
          return null;
        }
        const mention = mentionById.get(mentionId);
        if (!mention || mention.entityType !== "PERSON" || mention.entityId == null) {
          return null;
        }
        return peopleMap.get(mention.entityId) ?? null;
      }
    };
  }
}

export class InvalidDateError extends Error {
  constructor(value: string) {
    super(`Invalid date: ${value} (expected YYYY-MM-DD)`);
    this.name = "InvalidDateError";
  }
}

function initialsOf(name: string | null): string {
  if (!name) {
    return "—";
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const meaningful = parts.filter((p) => !/^(eng|téc|tec|sr|sra|dr|dra)\.?$/i.test(p));
  const source = meaningful.length > 0 ? meaningful : parts;
  const first = source[0]?.[0] ?? "";
  const last = source.length > 1 ? (source[source.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "—";
}

function contentTypeFromPath(path: string): string {
  const clean = path.toLowerCase().split("?")[0] ?? "";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
