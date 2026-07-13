/**
 * Manager-panel service: aggregates the diary of a day (entries, mentions,
 * alerts, AI triage and KPIs) and executes panel actions. Pure logic on top
 * of the PanelStore port — DB access lives in prismaPanelStore.ts.
 *
 * API contract is English; user-facing strings inside the data (titles,
 * descriptions) remain pt-BR content.
 */

import bcrypt from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

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

// ---- Projects (obras) registry ---------------------------------------------

export interface ProjectListItem {
  id: number;
  code: string;
  name: string;
  context: string | null;
  active: boolean;
  /** URL relativa da capa (`/projects/:id/cover`) quando a obra tem imagem; senão null. */
  coverImage: string | null;
  whatsappGroupId: string | null;
  whatsappAutoReportEnabled: boolean;
}

export interface ProjectInput {
  code: string;
  name: string;
  context: string | null;
  active: boolean;
  whatsappGroupId: string | null;
  whatsappAutoReportEnabled: boolean;
}

export interface ProjectListInput {
  search?: string;
  page: number;
  size: number;
  /** Retorna apenas obras ativas (usado pelo seletor do painel). */
  activeOnly?: boolean;
}

export interface ProjectListResult {
  data: ProjectListItem[];
  totalCount: number;
}

// ---- Standards registry ----------------------------------------------------

export interface StandardRecord {
  id: number;
  code: string;
  title: string;
  description: string | null;
  version: string | null;
  active: boolean;
}

export interface StandardInput {
  code: string;
  title: string;
  description: string | null;
  version: string | null;
  active: boolean;
}

export interface StandardListInput {
  search?: string;
  page: number;
  size: number;
}

export interface StandardListResult {
  data: StandardRecord[];
  totalCount: number;
}

// ---- Assets registry -------------------------------------------------------

export interface AssetRecord {
  id: number;
  code: string;
  name: string;
  assetTypeId: number;
  assetTypeName: string;
  projectId: number;
  active: boolean;
}

export interface AssetInput {
  code: string;
  name: string;
  assetTypeId: number;
  projectId: number;
  active: boolean;
}

export interface AssetListInput {
  search?: string;
  page: number;
  size: number;
}

export interface AssetListResult {
  data: AssetRecord[];
  totalCount: number;
}

/** Tipo de ativo do setor, para popular o select do formulário. */
export interface AssetTypeRef {
  id: number;
  code: string;
  name: string;
  level: number;
  parentTypeId: number | null;
}

// ---- People registry -------------------------------------------------------

export type PersonStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED";

export interface PersonRecord {
  id: number;
  name: string;
  registrationCode: string | null;
  role: string | null;
  status: PersonStatus;
  projectId: number | null;
}

export interface PersonInput {
  name: string;
  registrationCode: string | null;
  role: string | null;
  status: PersonStatus;
  projectId: number | null;
}

export interface PersonListInput {
  search?: string;
  page: number;
  size: number;
}

export interface PersonListResult {
  data: PersonRecord[];
  totalCount: number;
}

// ---- Panel users (manager panel accounts) ----------------------------------

export type PanelUserRole = "ADMIN" | "MANAGER";

export interface PanelUserRecord {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: PanelUserRole;
  active: boolean;
}

export interface PanelUserListItem {
  id: number;
  email: string;
  name: string;
  role: PanelUserRole;
  active: boolean;
}

export interface PanelUserInput {
  email: string;
  name: string;
  role: PanelUserRole;
  active: boolean;
  /** Senha em texto plano; hash é responsabilidade do PanelService. */
  password?: string;
}

export interface PanelUserListInput {
  search?: string;
  page: number;
  size: number;
}

export interface PanelUserListResult {
  data: PanelUserListItem[];
  totalCount: number;
}

// ---- Usuários WhatsApp (tabela users — quem o bot responde) -----------------

export interface CompanyRef {
  /** BigInt serializado como string para o JSON da API. */
  id: string;
  name: string | null;
}

export interface WhatsappUserListItem {
  id: number;
  name: string | null;
  /** Telefone em E.164 (ex: +5547999999999). */
  phoneE164: string;
  role: string | null;
  active: boolean;
  companies: CompanyRef[];
}

export interface WhatsappUserInput {
  name: string;
  /** Telefone livre (com ou sem máscara); normalização é do PanelService. */
  phone: string;
  role?: string | null;
  active: boolean;
  /** Empresas que o usuário pode selecionar no fluxo (user_companies). */
  companyIds: string[];
}

export interface WhatsappUserListResult {
  data: WhatsappUserListItem[];
  totalCount: number;
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
  listStandards(input: StandardListInput): Promise<StandardListResult>;
  findStandardById(id: number): Promise<StandardRecord | null>;
  createStandard(input: StandardInput): Promise<StandardRecord>;
  updateStandard(id: number, input: StandardInput): Promise<StandardRecord | null>;
  deleteStandard(id: number): Promise<boolean>;
  listAssets(input: AssetListInput): Promise<AssetListResult>;
  findAssetById(id: number): Promise<AssetRecord | null>;
  createAsset(input: AssetInput): Promise<AssetRecord>;
  updateAsset(id: number, input: AssetInput): Promise<AssetRecord | null>;
  deleteAsset(id: number): Promise<boolean>;
  listAssetTypes(): Promise<AssetTypeRef[]>;
  listPeople(input: PersonListInput): Promise<PersonListResult>;
  findPersonById(id: number): Promise<PersonRecord | null>;
  createPerson(input: PersonInput): Promise<PersonRecord>;
  updatePerson(id: number, input: PersonInput): Promise<PersonRecord | null>;
  deletePerson(id: number): Promise<boolean>;
  listProjects(input: ProjectListInput): Promise<ProjectListResult>;
  findProjectItemById(id: number): Promise<ProjectListItem | null>;
  createProject(input: ProjectInput): Promise<ProjectListItem>;
  updateProject(id: number, input: ProjectInput): Promise<ProjectListItem | null>;
  deleteProject(id: number): Promise<boolean>;
  /** Grava a key S3 da capa em attributes.coverImage; retorna false se a obra não existe. */
  setProjectCoverKey(id: number, key: string): Promise<boolean>;
  /** Lê a key S3 da capa (attributes.coverImage) ou null se a obra não tem capa. */
  findProjectCoverKey(id: number): Promise<string | null>;
  listPanelUsers(input: PanelUserListInput): Promise<PanelUserListResult>;
  findPanelUserById(id: number): Promise<PanelUserListItem | null>;
  findPanelUserByEmail(email: string): Promise<PanelUserRecord | null>;
  createPanelUser(input: { email: string; name: string; role: PanelUserRole; active: boolean; passwordHash: string }): Promise<PanelUserListItem>;
  updatePanelUser(
    id: number,
    input: { email: string; name: string; role: PanelUserRole; active: boolean; passwordHash?: string }
  ): Promise<PanelUserListItem | null>;
  deletePanelUser(id: number): Promise<boolean>;
  countActivePanelUsers(excludingId?: number): Promise<number>;
  listWhatsappUsers(input: PanelUserListInput): Promise<WhatsappUserListResult>;
  findWhatsappUserById(id: number): Promise<WhatsappUserListItem | null>;
  createWhatsappUser(input: {
    phoneE164: string;
    name: string;
    role: string | null;
    active: boolean;
    companyIds: bigint[];
  }): Promise<WhatsappUserListItem>;
  updateWhatsappUser(
    id: number,
    input: { phoneE164: string; name: string; role: string | null; active: boolean; companyIds: bigint[] }
  ): Promise<WhatsappUserListItem | null>;
  /** Lança WhatsappUserHasEntriesError se o usuário tem registros no diário. */
  deleteWhatsappUser(id: number): Promise<boolean>;
  listCompanies(): Promise<CompanyRef[]>;
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
  uploadPrivateObject(input: { path: string; body: Buffer; contentType: string }): Promise<void>;
}

export interface DiaryMedia {
  body: Buffer;
  contentType: string;
}

export interface DailyReportGenerator {
  generateForObraDay(input: { obraId: number; date: string }): Promise<{ buffer: Buffer; totalEntradas: number } | null>;
}

export class PanelService {
  constructor(
    private readonly store: PanelStore,
    private readonly options: {
      timezoneOffset?: string;
      mediaStorage?: PanelMediaStorage;
      dailyReportService?: DailyReportGenerator;
    } = {}
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

  listStandards(input: StandardListInput): Promise<StandardListResult> {
    return this.store.listStandards(input);
  }

  getStandard(id: number): Promise<StandardRecord | null> {
    return this.store.findStandardById(id);
  }

  createStandard(input: StandardInput): Promise<StandardRecord> {
    return this.store.createStandard(input);
  }

  updateStandard(id: number, input: StandardInput): Promise<StandardRecord | null> {
    return this.store.updateStandard(id, input);
  }

  deleteStandard(id: number): Promise<boolean> {
    return this.store.deleteStandard(id);
  }

  listAssets(input: AssetListInput): Promise<AssetListResult> {
    return this.store.listAssets(input);
  }

  getAsset(id: number): Promise<AssetRecord | null> {
    return this.store.findAssetById(id);
  }

  createAsset(input: AssetInput): Promise<AssetRecord> {
    return this.store.createAsset(input);
  }

  updateAsset(id: number, input: AssetInput): Promise<AssetRecord | null> {
    return this.store.updateAsset(id, input);
  }

  deleteAsset(id: number): Promise<boolean> {
    return this.store.deleteAsset(id);
  }

  listAssetTypes(): Promise<AssetTypeRef[]> {
    return this.store.listAssetTypes();
  }

  listPeople(input: PersonListInput): Promise<PersonListResult> {
    return this.store.listPeople(input);
  }

  getPerson(id: number): Promise<PersonRecord | null> {
    return this.store.findPersonById(id);
  }

  createPerson(input: PersonInput): Promise<PersonRecord> {
    return this.store.createPerson(input);
  }

  updatePerson(id: number, input: PersonInput): Promise<PersonRecord | null> {
    return this.store.updatePerson(id, input);
  }

  deletePerson(id: number): Promise<boolean> {
    return this.store.deletePerson(id);
  }

  listProjects(input: ProjectListInput): Promise<ProjectListResult> {
    return this.store.listProjects(input);
  }

  getProjectItem(id: number): Promise<ProjectListItem | null> {
    return this.store.findProjectItemById(id);
  }

  createProject(input: ProjectInput): Promise<ProjectListItem> {
    return this.store.createProject(input);
  }

  updateProject(id: number, input: ProjectInput): Promise<ProjectListItem | null> {
    return this.store.updateProject(id, input);
  }

  deleteProject(id: number): Promise<boolean> {
    return this.store.deleteProject(id);
  }

  /**
   * Sobe a imagem de capa da obra para o storage privado (S3) e persiste a key
   * em attributes.coverImage. A key é montada pelo router (inclui timestamp) para
   * manter este método determinístico/testável. Retorna false se a obra não existe.
   */
  async uploadProjectCover(id: number, input: { key: string; body: Buffer; contentType: string }): Promise<boolean> {
    if (!this.options.mediaStorage) {
      throw new Error("Panel media storage is not configured");
    }

    await this.options.mediaStorage.uploadPrivateObject({
      path: input.key,
      body: input.body,
      contentType: input.contentType
    });
    return this.store.setProjectCoverKey(id, input.key);
  }

  /** Lê a imagem de capa da obra do storage privado; null se a obra não tem capa. */
  async getProjectCover(id: number): Promise<DiaryMedia | null> {
    if (!this.options.mediaStorage) {
      throw new Error("Panel media storage is not configured");
    }

    const key = await this.store.findProjectCoverKey(id);
    if (!key) {
      return null;
    }

    return {
      body: await this.options.mediaStorage.downloadPrivateObject(key),
      contentType: contentTypeFromPath(key)
    };
  }

  async verifyPanelUserCredentials(email: string, password: string): Promise<PanelUserListItem | null> {
    const user = await this.store.findPanelUserByEmail(email.trim().toLowerCase());
    if (!user || !user.active) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role, active: user.active };
  }

  listPanelUsers(input: PanelUserListInput): Promise<PanelUserListResult> {
    return this.store.listPanelUsers(input);
  }

  getPanelUser(id: number): Promise<PanelUserListItem | null> {
    return this.store.findPanelUserById(id);
  }

  async createPanelUser(input: PanelUserInput): Promise<PanelUserListItem> {
    if (!input.password) {
      throw new PanelUserPasswordRequiredError();
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
    return this.store.createPanelUser({
      email: input.email.trim().toLowerCase(),
      name: input.name,
      role: input.role,
      active: input.active,
      passwordHash
    });
  }

  async updatePanelUser(id: number, input: PanelUserInput): Promise<PanelUserListItem | null> {
    if (!input.active) {
      const activeOthers = await this.store.countActivePanelUsers(id);
      if (activeOthers === 0) {
        throw new LastActivePanelUserError();
      }
    }

    const passwordHash = input.password ? await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS) : undefined;
    return this.store.updatePanelUser(id, {
      email: input.email.trim().toLowerCase(),
      name: input.name,
      role: input.role,
      active: input.active,
      passwordHash
    });
  }

  async deletePanelUser(id: number): Promise<boolean> {
    const activeOthers = await this.store.countActivePanelUsers(id);
    if (activeOthers === 0) {
      throw new LastActivePanelUserError();
    }
    return this.store.deletePanelUser(id);
  }

  // ---- Usuários WhatsApp (liberados para o bot) -----------------------------

  listWhatsappUsers(input: PanelUserListInput): Promise<WhatsappUserListResult> {
    return this.store.listWhatsappUsers(input);
  }

  getWhatsappUser(id: number): Promise<WhatsappUserListItem | null> {
    return this.store.findWhatsappUserById(id);
  }

  createWhatsappUser(input: WhatsappUserInput): Promise<WhatsappUserListItem> {
    return this.store.createWhatsappUser(this.normalizeWhatsappUserInput(input));
  }

  updateWhatsappUser(id: number, input: WhatsappUserInput): Promise<WhatsappUserListItem | null> {
    return this.store.updateWhatsappUser(id, this.normalizeWhatsappUserInput(input));
  }

  deleteWhatsappUser(id: number): Promise<boolean> {
    return this.store.deleteWhatsappUser(id);
  }

  listCompanies(): Promise<CompanyRef[]> {
    return this.store.listCompanies();
  }

  private normalizeWhatsappUserInput(input: WhatsappUserInput): {
    phoneE164: string;
    name: string;
    role: string | null;
    active: boolean;
    companyIds: bigint[];
  } {
    // Aceita máscara ((47) 99999-9999) e prefixa o DDI 55 quando o número
    // vier no formato nacional — o bot busca pelo número internacional.
    let digits = input.phone.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`;
    }
    if (digits.length < 12 || digits.length > 15) {
      throw new InvalidWhatsappPhoneError(input.phone);
    }

    return {
      phoneE164: `+${digits}`,
      name: input.name.trim(),
      role: input.role?.trim() || null,
      active: input.active,
      companyIds: input.companyIds.map((id) => BigInt(id))
    };
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

  async getDailyReportPdf(input: { projectId: number; date: string }): Promise<{ buffer: Buffer; totalEntradas: number } | null> {
    if (!this.options.dailyReportService) {
      throw new Error("Daily report service is not configured");
    }

    return this.options.dailyReportService.generateForObraDay({ obraId: input.projectId, date: input.date });
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

/** A standard with the same code already exists in the sector. */
export class DuplicateStandardCodeError extends Error {
  constructor(code: string) {
    super(`Standard code already exists: ${code}`);
    this.name = "DuplicateStandardCodeError";
  }
}

/** The standard is referenced by competencies and cannot be deleted. */
export class StandardInUseError extends Error {
  constructor(id: number) {
    super(`Standard ${id} is referenced and cannot be deleted`);
    this.name = "StandardInUseError";
  }
}

/** An asset with the same code already exists in the sector. */
export class DuplicateAssetCodeError extends Error {
  constructor(code: string) {
    super(`Asset code already exists: ${code}`);
    this.name = "DuplicateAssetCodeError";
  }
}

/** The asset is referenced (inspections/entries) and cannot be deleted. */
export class AssetInUseError extends Error {
  constructor(id: number) {
    super(`Asset ${id} is referenced and cannot be deleted`);
    this.name = "AssetInUseError";
  }
}

/** A person with the same registration code already exists in the sector. */
export class DuplicatePersonCodeError extends Error {
  constructor(code: string) {
    super(`Person registration code already exists: ${code}`);
    this.name = "DuplicatePersonCodeError";
  }
}

/** The person is referenced (competencies/inspections) and cannot be deleted. */
export class PersonInUseError extends Error {
  constructor(id: number) {
    super(`Person ${id} is referenced and cannot be deleted`);
    this.name = "PersonInUseError";
  }
}

/** A project with the same code already exists for the company. */
export class DuplicateProjectCodeError extends Error {
  constructor(code: string) {
    super(`Project code already exists: ${code}`);
    this.name = "DuplicateProjectCodeError";
  }
}

/** The project has diary entries and cannot be deleted. */
export class ProjectInUseError extends Error {
  constructor(id: number) {
    super(`Project ${id} has diary entries and cannot be deleted`);
    this.name = "ProjectInUseError";
  }
}

/** A panel user with the same email already exists. */
export class DuplicatePanelUserEmailError extends Error {
  constructor(email: string) {
    super(`Panel user email already exists: ${email}`);
    this.name = "DuplicatePanelUserEmailError";
  }
}

/** Password is required when creating a panel user. */
export class PanelUserPasswordRequiredError extends Error {
  constructor() {
    super("Password is required to create a panel user");
    this.name = "PanelUserPasswordRequiredError";
  }
}

/** The last active panel user cannot be deactivated or deleted (would lock out the panel). */
export class LastActivePanelUserError extends Error {
  constructor() {
    super("Cannot deactivate or delete the last active panel user");
    this.name = "LastActivePanelUserError";
  }
}

/** A WhatsApp user with the same phone already exists. */
export class DuplicateWhatsappUserPhoneError extends Error {
  constructor(phoneE164: string) {
    super(`WhatsApp user phone already exists: ${phoneE164}`);
    this.name = "DuplicateWhatsappUserPhoneError";
  }
}

/** Phone is not a valid WhatsApp number (expects DDI+DDD+number, 12-15 digits). */
export class InvalidWhatsappPhoneError extends Error {
  constructor(phone: string) {
    super(`Invalid WhatsApp phone: ${phone}`);
    this.name = "InvalidWhatsappPhoneError";
  }
}

/** WhatsApp users with diary entries cannot be deleted (deactivate instead). */
export class WhatsappUserHasEntriesError extends Error {
  constructor(id: number) {
    super(`WhatsApp user ${id} has diary entries and cannot be deleted`);
    this.name = "WhatsappUserHasEntriesError";
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
