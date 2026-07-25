import { describe, expect, it, beforeEach, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp, type WebhookHandler } from "../src/app";
import { createPanelRouter } from "../src/api/panelRouter";
import { signPanelToken } from "../src/api/panelAuth";
import {
  AssetInUseError,
  DuplicateAssetCodeError,
  DuplicatePanelUserEmailError,
  DuplicatePersonCodeError,
  DuplicateProjectCodeError,
  DuplicateStandardCodeError,
  PanelService,
  PersonInUseError,
  ProjectInUseError,
  StandardInUseError,
  DuplicateWhatsappUserPhoneError,
  WhatsappUserHasEntriesError,
  type AlertRecord,
  type AssetInput,
  type AssetListInput,
  type AuditLogListInput,
  type AuditLogListResult,
  type AuditLogRecord,
  type AssetListResult,
  type AssetRecord,
  type AssetTypeRef,
  type CodeRef,
  type PersonInput,
  type PersonListInput,
  type PersonListResult,
  type PersonRecord,
  type DailyReportGenerator,
  type EntryRecord,
  type PanelStore,
  type PanelUserListInput,
  type PanelUserListItem,
  type PanelUserListResult,
  type PanelUserRecord,
  type PanelMailer,
  type PanelUserRole,
  type PersonRef,
  type ProjectInput,
  type ProjectListInput,
  type ProjectListItem,
  type ProjectListResult,
  type ProjectRecord,
  type StandardInput,
  type StandardListInput,
  type StandardListResult,
  type StandardRecord,
  type CompanyRef,
  type WhatsappUserListItem,
  type WhatsappUserListResult
} from "../src/services/panelService";
import { InvalidReportDateError } from "../src/services/dailyReportService";

const JWT_SECRET = "test-secret";
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
  standardRecords: StandardRecord[] = [];
  standardsInUse = new Set<number>();
  auditLogRecords: AuditLogRecord[] = [
    {
      id: "2",
      actorType: "SYSTEM",
      actorId: null,
      actorLabel: "Auto-report (agendado)",
      action: "report.email.sent",
      status: "OK",
      entityType: "PROJECT",
      entityId: "1",
      metadata: { recipients: ["a@b.com"], filename: "f.pdf" },
      createdAt: new Date("2026-07-06T21:00:00Z")
    },
    {
      id: "1",
      actorType: "PANEL_USER",
      actorId: "1",
      actorLabel: "gestor@tanen.com.br",
      action: "report.downloaded.panel",
      status: "OK",
      entityType: "PROJECT",
      entityId: "1",
      metadata: { date: "2026-07-06", filename: "f.pdf" },
      createdAt: new Date("2026-07-06T20:00:00Z")
    }
  ];
  private nextStandardId = 1;
  assetRecords: AssetRecord[] = [];
  assetTypes: AssetTypeRef[] = [];
  assetsInUse = new Set<number>();
  private nextAssetId = 1;
  personRecords: PersonRecord[] = [];
  peopleInUse = new Set<number>();
  private nextPersonId = 1;
  projectItems: ProjectListItem[] = [];
  projectsInUse = new Set<number>();
  projectCoverKeys = new Map<number, string>();
  private nextProjectId = 1;
  people: PersonRef[] = [{ id: 118, name: "José Pereira", registrationCode: "MAT-118" }];
  machines: CodeRef[] = [{ id: 7, code: "MX-007" }];
  assets: CodeRef[] = [];
  panelUsers: PanelUserRecord[] = [];
  private nextPanelUserId = 1;
  whatsappUsers: WhatsappUserListItem[] = [];
  whatsappUsersWithEntries = new Set<number>();
  companies: CompanyRef[] = [{ id: "10", name: "Construtora Tanen" }, { id: "20", name: "AND Construções" }];
  private nextWhatsappUserId = 1;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.nextWhatsappUserId = 1;
    this.whatsappUsersWithEntries = new Set([1]);
    this.whatsappUsers = [
      {
        id: this.nextWhatsappUserId++,
        name: "Roberto Costa",
        phoneE164: "+5547999990000",
        role: "Engenheiro",
        active: true,
        companies: [{ id: "10", name: "Construtora Tanen" }]
      }
    ];

    this.nextPanelUserId = 1;
    this.panelUsers = [
      {
        id: this.nextPanelUserId++,
        email: "gestor@tanen.com.br",
        passwordHash: bcrypt.hashSync("correct-password", 4),
        name: "Ricardo Tanen",
        role: "ADMIN",
        active: true
      },
      {
        id: this.nextPanelUserId++,
        email: "inativo@tanen.com.br",
        passwordHash: bcrypt.hashSync("correct-password", 4),
        name: "Usuário Inativo",
        role: "MANAGER",
        active: false
      }
    ];

    this.nextProjectId = 1;
    this.projectsInUse = new Set([1]);
    this.projectItems = [
      this.buildProject({
        code: "AUR",
        name: "Obra Residencial Aurora",
        context: "Apto 1403 · Laje tipo 04",
        active: true,
        whatsappGroupId: null,
        whatsappAutoReportEnabled: false
      }),
      this.buildProject({
        code: "BSV",
        name: "Obra Boulevard Sete Vidas",
        context: null,
        active: false,
        whatsappGroupId: null,
        whatsappAutoReportEnabled: false
      })
    ];

    this.nextStandardId = 1;
    this.standardsInUse = new Set();
    this.standardRecords = [
      this.buildStandard({ code: "PS-024", title: "Grauteamento", description: null, version: "3", active: true }),
      this.buildStandard({ code: "PS-031", title: "Solda estrutural", description: "Procedimento de solda.", version: null, active: false })
    ];

    this.assetTypes = [
      { id: 1, code: "OBRA", name: "Obra", level: 1, parentTypeId: null },
      { id: 2, code: "TORRE", name: "Torre", level: 2, parentTypeId: 1 }
    ];
    this.nextAssetId = 1;
    this.assetsInUse = new Set();
    this.assetRecords = [
      this.buildAsset({ code: "AT-001", name: "Torre A", assetTypeId: 2, projectId: 1, active: true }),
      this.buildAsset({ code: "AT-002", name: "Betoneira 5", assetTypeId: 1, projectId: 1, active: false })
    ];

    this.nextPersonId = 1;
    this.peopleInUse = new Set();
    this.personRecords = [
      this.buildPerson({ name: "José Pereira", registrationCode: "MAT-118", role: "Pedreiro", status: "ACTIVE", projectId: 1 }),
      this.buildPerson({ name: "Ana Souza", registrationCode: "MAT-200", role: "Engenheira", status: "ON_LEAVE", projectId: null })
    ];

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

  async listStandards(input: StandardListInput): Promise<StandardListResult> {
    const search = input.search?.toLowerCase();
    const filtered = this.standardRecords
      .filter((s) => !search || s.code.toLowerCase().includes(search) || s.title.toLowerCase().includes(search))
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      data: filtered.slice(input.page * input.size, (input.page + 1) * input.size),
      totalCount: filtered.length
    };
  }

  async listAuditLogs(input: AuditLogListInput): Promise<AuditLogListResult> {
    const filtered = this.auditLogRecords
      .filter((log) => !input.action || log.action === input.action)
      .filter(
        (log) =>
          !input.search ||
          (log.actorLabel ?? "").toLowerCase().includes(input.search.toLowerCase()) ||
          (log.entityId ?? "").toLowerCase().includes(input.search.toLowerCase())
      );

    return {
      data: filtered.slice(input.page * input.size, (input.page + 1) * input.size),
      totalCount: filtered.length
    };
  }

  async findStandardById(id: number): Promise<StandardRecord | null> {
    return this.standardRecords.find((s) => s.id === id) ?? null;
  }

  async createStandard(input: StandardInput): Promise<StandardRecord> {
    this.assertUniqueCode(input.code);
    const standard = this.buildStandard(input);
    this.standardRecords.push(standard);
    return standard;
  }

  async updateStandard(id: number, input: StandardInput): Promise<StandardRecord | null> {
    const standard = this.standardRecords.find((s) => s.id === id);
    if (!standard) {
      return null;
    }
    this.assertUniqueCode(input.code, id);
    Object.assign(standard, input);
    return standard;
  }

  async deleteStandard(id: number): Promise<boolean> {
    if (this.standardsInUse.has(id)) {
      throw new StandardInUseError(id);
    }
    const index = this.standardRecords.findIndex((s) => s.id === id);
    if (index < 0) {
      return false;
    }
    this.standardRecords.splice(index, 1);
    return true;
  }

  private buildStandard(input: StandardInput): StandardRecord {
    return { id: this.nextStandardId++, ...input };
  }

  private assertUniqueCode(code: string, exceptId?: number): void {
    if (this.standardRecords.some((s) => s.code === code && s.id !== exceptId)) {
      throw new DuplicateStandardCodeError(code);
    }
  }

  async listAssets(input: AssetListInput): Promise<AssetListResult> {
    const search = input.search?.toLowerCase();
    const filtered = this.assetRecords
      .filter((a) => !search || a.code.toLowerCase().includes(search) || a.name.toLowerCase().includes(search))
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      data: filtered.slice(input.page * input.size, (input.page + 1) * input.size),
      totalCount: filtered.length
    };
  }

  async findAssetById(id: number): Promise<AssetRecord | null> {
    return this.assetRecords.find((a) => a.id === id) ?? null;
  }

  async createAsset(input: AssetInput): Promise<AssetRecord> {
    this.assertUniqueAssetCode(input.code);
    const asset = this.buildAsset(input);
    this.assetRecords.push(asset);
    return asset;
  }

  async updateAsset(id: number, input: AssetInput): Promise<AssetRecord | null> {
    const asset = this.assetRecords.find((a) => a.id === id);
    if (!asset) {
      return null;
    }
    this.assertUniqueAssetCode(input.code, id);
    Object.assign(asset, input, { assetTypeName: this.assetTypeName(input.assetTypeId) });
    return asset;
  }

  async deleteAsset(id: number): Promise<boolean> {
    if (this.assetsInUse.has(id)) {
      throw new AssetInUseError(id);
    }
    const index = this.assetRecords.findIndex((a) => a.id === id);
    if (index < 0) {
      return false;
    }
    this.assetRecords.splice(index, 1);
    return true;
  }

  async listAssetTypes(): Promise<AssetTypeRef[]> {
    return this.assetTypes;
  }

  private buildAsset(input: AssetInput): AssetRecord {
    return { id: this.nextAssetId++, ...input, assetTypeName: this.assetTypeName(input.assetTypeId) };
  }

  private assetTypeName(assetTypeId: number): string {
    return this.assetTypes.find((t) => t.id === assetTypeId)?.name ?? "";
  }

  private assertUniqueAssetCode(code: string, exceptId?: number): void {
    if (this.assetRecords.some((a) => a.code === code && a.id !== exceptId)) {
      throw new DuplicateAssetCodeError(code);
    }
  }

  async listPeople(input: PersonListInput): Promise<PersonListResult> {
    const search = input.search?.toLowerCase();
    const filtered = this.personRecords
      .filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search) ||
          (p.registrationCode?.toLowerCase().includes(search) ?? false) ||
          (p.role?.toLowerCase().includes(search) ?? false)
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data: filtered.slice(input.page * input.size, (input.page + 1) * input.size),
      totalCount: filtered.length
    };
  }

  async findPersonById(id: number): Promise<PersonRecord | null> {
    return this.personRecords.find((p) => p.id === id) ?? null;
  }

  async createPerson(input: PersonInput): Promise<PersonRecord> {
    this.assertUniquePersonCode(input.registrationCode);
    const person = this.buildPerson(input);
    this.personRecords.push(person);
    return person;
  }

  async updatePerson(id: number, input: PersonInput): Promise<PersonRecord | null> {
    const person = this.personRecords.find((p) => p.id === id);
    if (!person) {
      return null;
    }
    this.assertUniquePersonCode(input.registrationCode, id);
    Object.assign(person, input);
    return person;
  }

  async deletePerson(id: number): Promise<boolean> {
    if (this.peopleInUse.has(id)) {
      throw new PersonInUseError(id);
    }
    const index = this.personRecords.findIndex((p) => p.id === id);
    if (index < 0) {
      return false;
    }
    this.personRecords.splice(index, 1);
    return true;
  }

  private buildPerson(input: PersonInput): PersonRecord {
    return { id: this.nextPersonId++, ...input };
  }

  private assertUniquePersonCode(code: string | null, exceptId?: number): void {
    if (code && this.personRecords.some((p) => p.registrationCode === code && p.id !== exceptId)) {
      throw new DuplicatePersonCodeError(code);
    }
  }

  async listProjects(input: ProjectListInput): Promise<ProjectListResult> {
    const search = input.search?.toLowerCase();
    const filtered = this.projectItems
      .filter((p) => !input.activeOnly || p.active)
      .filter((p) => !search || p.code.toLowerCase().includes(search) || p.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data: filtered.slice(input.page * input.size, (input.page + 1) * input.size),
      totalCount: filtered.length
    };
  }

  async findProjectItemById(id: number): Promise<ProjectListItem | null> {
    return this.projectItems.find((p) => p.id === id) ?? null;
  }

  async createProject(input: ProjectInput): Promise<ProjectListItem> {
    this.assertUniqueProjectCode(input.code);
    const project = this.buildProject(input);
    this.projectItems.push(project);
    return project;
  }

  async updateProject(id: number, input: ProjectInput): Promise<ProjectListItem | null> {
    const project = this.projectItems.find((p) => p.id === id);
    if (!project) {
      return null;
    }
    this.assertUniqueProjectCode(input.code, id);
    Object.assign(project, input);
    return project;
  }

  async deleteProject(id: number): Promise<boolean> {
    if (this.projectsInUse.has(id)) {
      throw new ProjectInUseError(id);
    }
    const index = this.projectItems.findIndex((p) => p.id === id);
    if (index < 0) {
      return false;
    }
    this.projectItems.splice(index, 1);
    return true;
  }

  async setProjectCoverKey(id: number, key: string): Promise<boolean> {
    const project = this.projectItems.find((p) => p.id === id);
    if (!project) {
      return false;
    }
    this.projectCoverKeys.set(id, key);
    project.coverImage = `/projects/${id}/cover`;
    return true;
  }

  async findProjectCoverKey(id: number): Promise<string | null> {
    return this.projectCoverKeys.get(id) ?? null;
  }

  private buildProject(input: ProjectInput): ProjectListItem {
    return {
      id: this.nextProjectId++,
      coverImage: null,
      reportEmailRecipients: [],
      emailAutoReportEnabled: false,
      ...input
    };
  }

  private assertUniqueProjectCode(code: string, exceptId?: number): void {
    if (this.projectItems.some((p) => p.code === code && p.id !== exceptId)) {
      throw new DuplicateProjectCodeError(code);
    }
  }

  async listPanelUsers(input: PanelUserListInput): Promise<PanelUserListResult> {
    const search = input.search?.toLowerCase();
    const filtered = this.panelUsers
      .filter((u) => !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      data: filtered.slice(input.page * input.size, (input.page + 1) * input.size).map(toPanelUserListItem),
      totalCount: filtered.length
    };
  }

  async findPanelUserById(id: number): Promise<PanelUserListItem | null> {
    const user = this.panelUsers.find((u) => u.id === id);
    return user ? toPanelUserListItem(user) : null;
  }

  async findPanelUserByEmail(email: string): Promise<PanelUserRecord | null> {
    return this.panelUsers.find((u) => u.email === email) ?? null;
  }

  async createPanelUser(input: { email: string; name: string; role: PanelUserRole; active: boolean; passwordHash: string }): Promise<PanelUserListItem> {
    this.assertUniquePanelUserEmail(input.email);
    const user: PanelUserRecord = { id: this.nextPanelUserId++, ...input };
    this.panelUsers.push(user);
    return toPanelUserListItem(user);
  }

  async updatePanelUser(
    id: number,
    input: { email: string; name: string; role: PanelUserRole; active: boolean; passwordHash?: string }
  ): Promise<PanelUserListItem | null> {
    const user = this.panelUsers.find((u) => u.id === id);
    if (!user) {
      return null;
    }
    this.assertUniquePanelUserEmail(input.email, id);
    user.email = input.email;
    user.name = input.name;
    user.role = input.role;
    user.active = input.active;
    if (input.passwordHash) {
      user.passwordHash = input.passwordHash;
    }
    return toPanelUserListItem(user);
  }

  async deletePanelUser(id: number): Promise<boolean> {
    const index = this.panelUsers.findIndex((u) => u.id === id);
    if (index < 0) {
      return false;
    }
    this.panelUsers.splice(index, 1);
    return true;
  }

  async countActivePanelUsers(excludingId?: number): Promise<number> {
    return this.panelUsers.filter((u) => u.active && u.id !== excludingId).length;
  }

  private assertUniquePanelUserEmail(email: string, exceptId?: number): void {
    if (this.panelUsers.some((u) => u.email === email && u.id !== exceptId)) {
      throw new DuplicatePanelUserEmailError(email);
    }
  }

  async listWhatsappUsers(input: PanelUserListInput): Promise<WhatsappUserListResult> {
    const search = input.search?.toLowerCase();
    const filtered = this.whatsappUsers
      .filter((u) => !search || (u.name ?? "").toLowerCase().includes(search) || u.phoneE164.includes(search))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    return {
      data: filtered.slice(input.page * input.size, (input.page + 1) * input.size),
      totalCount: filtered.length
    };
  }

  async findWhatsappUserById(id: number): Promise<WhatsappUserListItem | null> {
    return this.whatsappUsers.find((u) => u.id === id) ?? null;
  }

  async createWhatsappUser(input: {
    phoneE164: string;
    name: string;
    role: string | null;
    active: boolean;
    companyIds: bigint[];
  }): Promise<WhatsappUserListItem> {
    this.assertUniqueWhatsappPhone(input.phoneE164);
    const user: WhatsappUserListItem = {
      id: this.nextWhatsappUserId++,
      name: input.name,
      phoneE164: input.phoneE164,
      role: input.role,
      active: input.active,
      companies: this.companiesByIds(input.companyIds)
    };
    this.whatsappUsers.push(user);
    return user;
  }

  async updateWhatsappUser(
    id: number,
    input: { phoneE164: string; name: string; role: string | null; active: boolean; companyIds: bigint[] }
  ): Promise<WhatsappUserListItem | null> {
    const user = this.whatsappUsers.find((u) => u.id === id);
    if (!user) {
      return null;
    }
    this.assertUniqueWhatsappPhone(input.phoneE164, id);
    user.phoneE164 = input.phoneE164;
    user.name = input.name;
    user.role = input.role;
    user.active = input.active;
    user.companies = this.companiesByIds(input.companyIds);
    return user;
  }

  async deleteWhatsappUser(id: number): Promise<boolean> {
    if (this.whatsappUsersWithEntries.has(id)) {
      throw new WhatsappUserHasEntriesError(id);
    }
    const index = this.whatsappUsers.findIndex((u) => u.id === id);
    if (index < 0) {
      return false;
    }
    this.whatsappUsers.splice(index, 1);
    return true;
  }

  async listCompanies(): Promise<CompanyRef[]> {
    return this.companies;
  }

  private companiesByIds(ids: bigint[]): CompanyRef[] {
    return this.companies.filter((c) => ids.some((id) => id.toString() === c.id));
  }

  private assertUniqueWhatsappPhone(phoneE164: string, exceptId?: number): void {
    if (this.whatsappUsers.some((u) => u.phoneE164 === phoneE164 && u.id !== exceptId)) {
      throw new DuplicateWhatsappUserPhoneError(phoneE164);
    }
  }
}

function toPanelUserListItem(user: PanelUserRecord): PanelUserListItem {
  return { id: user.id, email: user.email, name: user.name, role: user.role, active: user.active };
}

let store: FakePanelStore;
const storage = {
  downloads: [] as string[],
  uploads: [] as { path: string; body: Buffer; contentType: string }[],
  async downloadPrivateObject(path: string): Promise<Buffer> {
    this.downloads.push(path);
    return Buffer.from(`image:${path}`);
  },
  async uploadPrivateObject(input: { path: string; body: Buffer; contentType: string }): Promise<void> {
    this.uploads.push(input);
  }
};

class FakeDailyReportGenerator implements DailyReportGenerator {
  async generateForObraDay(
    input: { obraId: number; date: string }
  ): Promise<{ buffer: Buffer; totalEntradas: number; filename: string | null } | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new InvalidReportDateError(input.date);
    }
    if (input.obraId !== 1) {
      return null;
    }
    return { buffer: Buffer.from("%PDF-fake"), totalEntradas: 2, filename: "MRH - DO 133 - 14-07-26.pdf" };
  }
}

/** Mailer de teste do painel: captura os envios ou força falha, conforme o caso. */
let mailerSent: Array<{ to: string[]; subject: string; text: string; html?: string }> = [];
function buildApp(options: { mailer?: PanelMailer | null } = {}) {
  store = new FakePanelStore();
  storage.downloads = [];
  storage.uploads = [];
  mailerSent = [];
  const defaultMailer: PanelMailer = {
    async sendMail(input) {
      mailerSent.push(input);
    }
  };
  const service = new PanelService(store, {
    timezoneOffset: "-03:00",
    mediaStorage: storage,
    dailyReportService: new FakeDailyReportGenerator(),
    mailer: options.mailer === undefined ? defaultMailer : options.mailer
  });
  const panelRouter = createPanelRouter(service, {
    jwtSecret: JWT_SECRET,
    corsOrigins: [ORIGIN]
  });
  return createApp(new FakeWebhookHandler(), undefined, { panelRouter });
}

function tokenFor(user: { id: number; email: string; name: string; role: PanelUserRole }): string {
  return signPanelToken({ sub: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET);
}

const adminToken = tokenFor({ id: 1, email: "gestor@tanen.com.br", name: "Ricardo Tanen", role: "ADMIN" });
const auth = { Authorization: `Bearer ${adminToken}` };

describe("panel API auth", () => {
  it("rejects requests without a bearer token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/diary");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/diary").set("Authorization", "Bearer wrong");
    expect(res.status).toBe(401);
  });

  it("logs in with a valid email and password, returning a signed token", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "gestor@tanen.com.br", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({
      id: 1,
      name: "Ricardo Tanen",
      initials: "RT",
      role: "ADMIN",
      email: "gestor@tanen.com.br"
    });

    const me = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: 1, email: "gestor@tanen.com.br", role: "ADMIN" });
  });

  it("rejects login with a wrong password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "gestor@tanen.com.br", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
  });

  it("rejects login for an inactive user", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "inativo@tanen.com.br", password: "correct-password" });

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

describe("standards CRUD", () => {
  it("lists standards ordered by code with the total count", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/standards").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.data.map((s: { code: string }) => s.code)).toEqual(["PS-024", "PS-031"]);
    expect(res.body.data[0]).toMatchObject({
      code: "PS-024",
      title: "Grauteamento",
      description: null,
      version: "3",
      active: true
    });
  });

  it("filters by search and paginates", async () => {
    const app = buildApp();

    const searched = await request(app).get("/api/v1/standards?search=solda").set(auth);
    expect(searched.body.totalCount).toBe(1);
    expect(searched.body.data[0].code).toBe("PS-031");

    const paged = await request(app).get("/api/v1/standards?page=1&size=1").set(auth);
    expect(paged.body.totalCount).toBe(2);
    expect(paged.body.data.map((s: { code: string }) => s.code)).toEqual(["PS-031"]);
  });

  it("rejects an invalid page size", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/standards?size=0").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_pagination");
  });

  it("returns a single standard and 404 for unknown ids", async () => {
    const app = buildApp();

    const found = await request(app).get("/api/v1/standards/1").set(auth);
    expect(found.status).toBe(200);
    expect(found.body.code).toBe("PS-024");

    const missing = await request(app).get("/api/v1/standards/999").set(auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("standard_not_found");
  });

  it("creates a standard normalizing optional fields", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/standards")
      .set(auth)
      .send({ code: " PS-040 ", title: " Içamento de cargas ", description: "", version: "  " });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: "PS-040",
      title: "Içamento de cargas",
      description: null,
      version: null,
      active: true
    });
    expect(store.standardRecords).toHaveLength(3);
  });

  it("rejects an invalid payload", async () => {
    const app = buildApp();
    for (const payload of [{}, { code: "PS-041" }, { code: "", title: "x" }, { code: "PS-041", title: "x", active: "yes" }]) {
      const res = await request(app).post("/api/v1/standards").set(auth).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_payload");
    }
  });

  it("returns 409 with an i18n code for duplicated standard codes", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/standards")
      .set(auth)
      .send({ code: "PS-024", title: "Duplicada" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "duplicate_code", code: "standard.duplicated" });
  });

  it("updates a standard", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/standards/2")
      .set(auth)
      .send({ code: "PS-031", title: "Solda estrutural rev. 2", version: "2", active: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, title: "Solda estrutural rev. 2", version: "2", active: true });
  });

  it("returns 404 when updating an unknown standard", async () => {
    const app = buildApp();
    const res = await request(app).put("/api/v1/standards/999").set(auth).send({ code: "X", title: "Y" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when updating to a code that already exists", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/standards/2")
      .set(auth)
      .send({ code: "PS-024", title: "Solda estrutural" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("standard.duplicated");
  });

  it("deletes a standard", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/standards/1").set(auth);

    expect(res.status).toBe(200);
    expect(store.standardRecords.map((s) => s.id)).toEqual([2]);

    const again = await request(app).delete("/api/v1/standards/1").set(auth);
    expect(again.status).toBe(404);
  });

  it("returns 409 when deleting a standard in use", async () => {
    const app = buildApp();
    store.standardsInUse.add(1);

    const res = await request(app).delete("/api/v1/standards/1").set(auth);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "standard_in_use", code: "standard.inUse" });
  });

  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/standards");
    expect(res.status).toBe(401);
  });
});

describe("assets CRUD", () => {
  it("lists assets ordered by code with the total count", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/assets").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.data.map((a: { code: string }) => a.code)).toEqual(["AT-001", "AT-002"]);
    expect(res.body.data[0]).toMatchObject({
      code: "AT-001",
      name: "Torre A",
      assetTypeId: 2,
      assetTypeName: "Torre",
      projectId: 1,
      active: true
    });
  });

  it("filters by search and paginates", async () => {
    const app = buildApp();

    const searched = await request(app).get("/api/v1/assets?search=betoneira").set(auth);
    expect(searched.body.totalCount).toBe(1);
    expect(searched.body.data[0].code).toBe("AT-002");

    const paged = await request(app).get("/api/v1/assets?page=1&size=1").set(auth);
    expect(paged.body.totalCount).toBe(2);
    expect(paged.body.data.map((a: { code: string }) => a.code)).toEqual(["AT-002"]);
  });

  it("rejects an invalid page size", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/assets?size=0").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_pagination");
  });

  it("lists asset types for the sector", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/asset-types").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.map((t: { code: string }) => t.code)).toEqual(["OBRA", "TORRE"]);
  });

  it("returns a single asset and 404 for unknown ids", async () => {
    const app = buildApp();

    const found = await request(app).get("/api/v1/assets/1").set(auth);
    expect(found.status).toBe(200);
    expect(found.body.code).toBe("AT-001");

    const missing = await request(app).get("/api/v1/assets/999").set(auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("asset_not_found");
  });

  it("creates an asset trimming the code and name", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/assets")
      .set(auth)
      .send({ code: " AT-010 ", name: " Guindaste ", assetTypeId: 1, projectId: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: "AT-010",
      name: "Guindaste",
      assetTypeId: 1,
      projectId: 1,
      active: true
    });
    expect(store.assetRecords).toHaveLength(3);
  });

  it("rejects an invalid payload", async () => {
    const app = buildApp();
    for (const payload of [
      {},
      { code: "AT-011" },
      { code: "", name: "x", assetTypeId: 1, projectId: 1 },
      { code: "AT-011", name: "x", assetTypeId: 0, projectId: 1 },
      { code: "AT-011", name: "x", assetTypeId: 1 },
      { code: "AT-011", name: "x", assetTypeId: 1, projectId: 1, active: "yes" }
    ]) {
      const res = await request(app).post("/api/v1/assets").set(auth).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_payload");
    }
  });

  it("returns 409 with an i18n code for duplicated asset codes", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/assets")
      .set(auth)
      .send({ code: "AT-001", name: "Duplicado", assetTypeId: 1, projectId: 1 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "duplicate_code", code: "asset.duplicated" });
  });

  it("updates an asset", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/assets/2")
      .set(auth)
      .send({ code: "AT-002", name: "Betoneira 5 rev", assetTypeId: 1, projectId: 1, active: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, name: "Betoneira 5 rev", active: true });
  });

  it("returns 404 when updating an unknown asset", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/assets/999")
      .set(auth)
      .send({ code: "X", name: "Y", assetTypeId: 1, projectId: 1 });
    expect(res.status).toBe(404);
  });

  it("returns 409 when updating to a code that already exists", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/assets/2")
      .set(auth)
      .send({ code: "AT-001", name: "Betoneira", assetTypeId: 1, projectId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("asset.duplicated");
  });

  it("deletes an asset", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/assets/1").set(auth);

    expect(res.status).toBe(200);
    expect(store.assetRecords.map((a) => a.id)).toEqual([2]);

    const again = await request(app).delete("/api/v1/assets/1").set(auth);
    expect(again.status).toBe(404);
  });

  it("returns 409 when deleting an asset in use", async () => {
    const app = buildApp();
    store.assetsInUse.add(1);

    const res = await request(app).delete("/api/v1/assets/1").set(auth);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "asset_in_use", code: "asset.inUse" });
  });

  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/assets");
    expect(res.status).toBe(401);
  });
});

describe("people CRUD", () => {
  it("lists people ordered by name with the total count", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/people").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["Ana Souza", "José Pereira"]);
    expect(res.body.data[1]).toMatchObject({
      name: "José Pereira",
      registrationCode: "MAT-118",
      role: "Pedreiro",
      status: "ACTIVE",
      projectId: 1
    });
  });

  it("filters by search and paginates", async () => {
    const app = buildApp();

    const searched = await request(app).get("/api/v1/people?search=engenheira").set(auth);
    expect(searched.body.totalCount).toBe(1);
    expect(searched.body.data[0].name).toBe("Ana Souza");

    const paged = await request(app).get("/api/v1/people?page=1&size=1").set(auth);
    expect(paged.body.totalCount).toBe(2);
    expect(paged.body.data.map((p: { name: string }) => p.name)).toEqual(["José Pereira"]);
  });

  it("rejects an invalid page size", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/people?size=0").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_pagination");
  });

  it("returns a single person and 404 for unknown ids", async () => {
    const app = buildApp();

    const found = await request(app).get("/api/v1/people/1").set(auth);
    expect(found.status).toBe(200);
    expect(found.body.name).toBe("José Pereira");

    const missing = await request(app).get("/api/v1/people/999").set(auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("person_not_found");
  });

  it("creates a person normalizing optional fields and defaulting status", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/people")
      .set(auth)
      .send({ name: " Carlos Lima ", registrationCode: "  ", role: "" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Carlos Lima",
      registrationCode: null,
      role: null,
      status: "ACTIVE",
      projectId: null
    });
    expect(store.personRecords).toHaveLength(3);
  });

  it("rejects an invalid payload", async () => {
    const app = buildApp();
    for (const payload of [
      {},
      { name: "" },
      { name: "X", status: "UNKNOWN" },
      { name: "X", projectId: 0 }
    ]) {
      const res = await request(app).post("/api/v1/people").set(auth).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_payload");
    }
  });

  it("returns 409 with an i18n code for duplicated registration codes", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/people")
      .set(auth)
      .send({ name: "Duplicado", registrationCode: "MAT-118" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "duplicate_code", code: "person.duplicated" });
  });

  it("updates a person", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/people/2")
      .set(auth)
      .send({ name: "Ana Souza", registrationCode: "MAT-200", role: "Engenheira Civil", status: "ACTIVE" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, role: "Engenheira Civil", status: "ACTIVE" });
  });

  it("returns 404 when updating an unknown person", async () => {
    const app = buildApp();
    const res = await request(app).put("/api/v1/people/999").set(auth).send({ name: "Y" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when updating to a code that already exists", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/people/2")
      .set(auth)
      .send({ name: "Ana Souza", registrationCode: "MAT-118" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("person.duplicated");
  });

  it("deletes a person", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/people/1").set(auth);

    expect(res.status).toBe(200);
    expect(store.personRecords.map((p) => p.id)).toEqual([2]);

    const again = await request(app).delete("/api/v1/people/1").set(auth);
    expect(again.status).toBe(404);
  });

  it("returns 409 when deleting a person in use", async () => {
    const app = buildApp();
    store.peopleInUse.add(1);

    const res = await request(app).delete("/api/v1/people/1").set(auth);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "person_in_use", code: "person.inUse" });
  });

  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/people");
    expect(res.status).toBe(401);
  });
});

describe("projects CRUD", () => {
  it("lists projects ordered by name with the total count", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.data.map((p: { code: string }) => p.code)).toEqual(["BSV", "AUR"]);
    expect(res.body.data[1]).toMatchObject({
      code: "AUR",
      name: "Obra Residencial Aurora",
      context: "Apto 1403 · Laje tipo 04",
      active: true
    });
  });

  it("filters only active projects for the panel selector", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects?active=true").set(auth);

    expect(res.body.totalCount).toBe(1);
    expect(res.body.data[0].code).toBe("AUR");
  });

  it("filters by search", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects?search=boulevard").set(auth);

    expect(res.body.totalCount).toBe(1);
    expect(res.body.data[0].code).toBe("BSV");
  });

  it("returns a single project and 404 for unknown ids", async () => {
    const app = buildApp();

    const found = await request(app).get("/api/v1/projects/1").set(auth);
    expect(found.status).toBe(200);
    expect(found.body.code).toBe("AUR");

    const missing = await request(app).get("/api/v1/projects/999").set(auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("project_not_found");
  });

  it("creates a project normalizing optional fields", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/projects")
      .set(auth)
      .send({ code: " CDL ", title: undefined, name: " Obra Candelária ", context: "  " });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: "CDL",
      name: "Obra Candelária",
      context: null,
      active: true,
      whatsappGroupId: null,
      whatsappAutoReportEnabled: false
    });
    expect(store.projectItems).toHaveLength(3);
  });

  it("creates a project with a whatsapp group and auto-report enabled", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/projects")
      .set(auth)
      .send({ code: "CDL", name: "Obra Candelária", whatsappGroupId: "1203630xxxxx@g.us", whatsappAutoReportEnabled: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      whatsappGroupId: "1203630xxxxx@g.us",
      whatsappAutoReportEnabled: true
    });
  });

  it("creates a project with email recipients and auto-report enabled, normalizing the list", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/projects")
      .set(auth)
      .send({
        code: "CDL",
        name: "Obra Candelária",
        emailAutoReportEnabled: true,
        // Espaços, maiúsculas, vazios e duplicado — devem ser normalizados.
        reportEmailRecipients: [" Eng@Empresa.com.br ", "", "cliente@empresa.com.br", "eng@empresa.com.br"]
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      emailAutoReportEnabled: true,
      reportEmailRecipients: ["eng@empresa.com.br", "cliente@empresa.com.br"]
    });
  });

  it("rejects a project payload with an invalid email in the recipients list", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/projects")
      .set(auth)
      .send({ code: "CDL", name: "Obra Candelária", reportEmailRecipients: ["não-é-email"] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_payload");
  });

  it("rejects a project payload where reportEmailRecipients is not an array", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/projects")
      .set(auth)
      .send({ code: "CDL", name: "Obra Candelária", reportEmailRecipients: "a@b.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_payload");
  });

  it("sends a test email to the given recipients", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/projects/test-email")
      .set(auth)
      .send({ recipients: [" Eng@Empresa.com.br ", "cliente@empresa.com.br"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mailerSent).toHaveLength(1);
    // Normaliza a lista antes de enviar.
    expect(mailerSent[0].to).toEqual(["eng@empresa.com.br", "cliente@empresa.com.br"]);
    // Corpo apresentável: HTML com a marca + fallback texto.
    expect(mailerSent[0].html).toContain("Diário de Obra");
    expect(mailerSent[0].text).toContain("Teste de e-mail");
  });

  it("returns 400 email.noRecipients when the test list is empty", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/v1/projects/test-email").set(auth).send({ recipients: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("email.noRecipients");
    expect(mailerSent).toHaveLength(0);
  });

  it("returns 400 invalid_payload when a test recipient is not a valid email", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/v1/projects/test-email").set(auth).send({ recipients: ["nope"] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_payload");
  });

  it("returns 400 email.notConfigured when SMTP is not set up", async () => {
    const app = buildApp({ mailer: null });
    const res = await request(app).post("/api/v1/projects/test-email").set(auth).send({ recipients: ["a@b.com"] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("email.notConfigured");
  });

  it("returns 502 email.sendFailed when the mailer throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = buildApp({
      mailer: {
        async sendMail() {
          throw new Error("smtp down");
        }
      }
    });
    const res = await request(app).post("/api/v1/projects/test-email").set(auth).send({ recipients: ["a@b.com"] });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("email.sendFailed");
    errorSpy.mockRestore();
  });

  it("rejects an invalid payload", async () => {
    const app = buildApp();
    for (const payload of [{}, { code: "CDL" }, { code: "", name: "x" }, { code: "CDL", name: "x", active: "yes" }]) {
      const res = await request(app).post("/api/v1/projects").set(auth).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_payload");
    }
  });

  it("returns 409 with an i18n code for duplicated project codes", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/v1/projects").set(auth).send({ code: "AUR", name: "Duplicada" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "duplicate_code", code: "project.duplicated" });
  });

  it("updates a project", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/projects/2")
      .set(auth)
      .send({ code: "BSV", name: "Obra Boulevard Sete Vidas", context: "Fase 2", active: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 2, context: "Fase 2", active: true });
  });

  it("returns 404 when updating an unknown project", async () => {
    const app = buildApp();
    const res = await request(app).put("/api/v1/projects/999").set(auth).send({ code: "X", name: "Y" });
    expect(res.status).toBe(404);
  });

  it("deletes a project without diary entries", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/projects/2").set(auth);

    expect(res.status).toBe(200);
    expect(store.projectItems.map((p) => p.id)).toEqual([1]);
  });

  it("returns 409 when deleting a project with diary entries", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/projects/1").set(auth);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "project_in_use", code: "project.inUse" });
  });

  it("uploads a cover image, storing it privately and persisting the key", async () => {
    const app = buildApp();
    const pngBase64 = Buffer.from("fake-png-bytes").toString("base64");
    const res = await request(app)
      .post("/api/v1/projects/1/cover")
      .set(auth)
      .send({ contentType: "image/png", dataBase64: pngBase64 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ coverImage: "/projects/1/cover" });
    expect(storage.uploads).toHaveLength(1);
    expect(storage.uploads[0]?.path).toMatch(/^panel\/projects\/1\/cover-\d+\.png$/);
    expect(storage.uploads[0]?.contentType).toBe("image/png");
    // A obra passa a expor a URL de download da capa.
    const found = await request(app).get("/api/v1/projects/1").set(auth);
    expect(found.body.coverImage).toBe("/projects/1/cover");
  });

  it("accepts a data URL payload for the cover", async () => {
    const app = buildApp();
    const dataUrl = `data:image/jpeg;base64,${Buffer.from("jpg-bytes").toString("base64")}`;
    const res = await request(app).post("/api/v1/projects/1/cover").set(auth).send({ contentType: "image/jpeg", dataBase64: dataUrl });

    expect(res.status).toBe(200);
    expect(storage.uploads[0]?.path).toMatch(/\.jpg$/);
  });

  it("rejects an invalid cover payload", async () => {
    const app = buildApp();
    for (const payload of [{}, { contentType: "image/png" }, { contentType: "text/plain", dataBase64: "abc" }, { dataBase64: "abc" }]) {
      const res = await request(app).post("/api/v1/projects/1/cover").set(auth).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_payload");
    }
  });

  it("returns 404 uploading a cover to an unknown project", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/projects/999/cover")
      .set(auth)
      .send({ contentType: "image/png", dataBase64: Buffer.from("x").toString("base64") });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("project_not_found");
  });

  it("downloads the cover from private storage", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/v1/projects/1/cover")
      .set(auth)
      .send({ contentType: "image/png", dataBase64: Buffer.from("x").toString("base64") });

    const res = await request(app).get("/api/v1/projects/1/cover").set(auth);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(storage.downloads).toHaveLength(1);
    expect(res.body).toBeInstanceOf(Buffer);
  });

  it("returns 404 downloading a cover when the project has none", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects/2/cover").set(auth);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("cover_not_found");
  });

  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/projects/:id/report", () => {
  it("returns 400 for a non-numeric id", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects/abc/report?date=2026-07-03").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_id");
  });

  it("returns 400 when the date is missing", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects/1/report").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_date");
  });

  it("returns 400 for a malformed date", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects/1/report?date=03/07/2026").set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_date");
  });

  it("returns 404 when the project does not exist", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects/999/report?date=2026-07-03").set(auth);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("project_not_found");
  });

  it("returns the generated PDF for an existing project", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects/1/report?date=2026-07-03").set(auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain('filename="MRH - DO 133 - 14-07-26.pdf"');
    expect(res.body.slice(0, 4).toString()).toBe("%PDF");
  });

  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/projects/1/report?date=2026-07-03");
    expect(res.status).toBe(401);
  });
});

describe("panel users CRUD", () => {
  it("lists panel users ordered by name with the total count", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/users").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual(["gestor@tanen.com.br", "inativo@tanen.com.br"]);
    expect(res.body.data[0]).not.toHaveProperty("passwordHash");
  });

  it("filters by search", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/users?search=inativo").set(auth);

    expect(res.body.totalCount).toBe(1);
    expect(res.body.data[0].email).toBe("inativo@tanen.com.br");
  });

  it("returns a single user and 404 for unknown ids", async () => {
    const app = buildApp();

    const found = await request(app).get("/api/v1/users/1").set(auth);
    expect(found.status).toBe(200);
    expect(found.body.email).toBe("gestor@tanen.com.br");

    const missing = await request(app).get("/api/v1/users/999").set(auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("panel_user_not_found");
  });

  it("creates a panel user with a hashed password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/users")
      .set(auth)
      .send({ email: "novo@tanen.com.br", name: "Novo Gestor", role: "MANAGER", password: "senha-forte-123" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "novo@tanen.com.br", name: "Novo Gestor", role: "MANAGER", active: true });
    expect(res.body).not.toHaveProperty("passwordHash");

    const stored = store.panelUsers.find((u) => u.email === "novo@tanen.com.br");
    expect(stored?.passwordHash).not.toBe("senha-forte-123");
  });

  it("rejects creating a user without a password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/users")
      .set(auth)
      .send({ email: "novo@tanen.com.br", name: "Novo Gestor", role: "MANAGER" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_payload");
  });

  it("rejects an invalid payload", async () => {
    const app = buildApp();
    for (const payload of [
      {},
      { email: "x@x.com" },
      { email: "", name: "x", role: "MANAGER", password: "12345678" },
      { email: "x@x.com", name: "x", role: "OWNER", password: "12345678" },
      { email: "x@x.com", name: "x", role: "MANAGER", password: "short" }
    ]) {
      const res = await request(app).post("/api/v1/users").set(auth).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_payload");
    }
  });

  it("returns 409 with an i18n code for a duplicated email", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/users")
      .set(auth)
      .send({ email: "gestor@tanen.com.br", name: "Duplicado", role: "MANAGER", password: "senha-forte-123" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "duplicate_email", code: "panelUser.duplicated" });
  });

  it("updates a user without changing the password when omitted", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/users/1")
      .set(auth)
      .send({ email: "gestor@tanen.com.br", name: "Ricardo T. Alves", role: "ADMIN", active: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: "Ricardo T. Alves" });

    const login = await request(app).post("/api/v1/auth/login").send({ email: "gestor@tanen.com.br", password: "correct-password" });
    expect(login.status).toBe(200);
  });

  it("returns 404 when updating an unknown user", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/users/999")
      .set(auth)
      .send({ email: "x@x.com", name: "X", role: "MANAGER", active: true });
    expect(res.status).toBe(404);
  });

  it("refuses to deactivate the last active user", async () => {
    const app = buildApp();
    // O único outro usuário (inativo@tanen.com.br) já está inativo.
    const res = await request(app)
      .put("/api/v1/users/1")
      .set(auth)
      .send({ email: "gestor@tanen.com.br", name: "Ricardo Tanen", role: "ADMIN", active: false });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "last_active_user", code: "panelUser.lastActive" });
  });

  it("deletes a panel user", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/users/2").set(auth);

    expect(res.status).toBe(200);
    expect(store.panelUsers.map((u) => u.id)).toEqual([1]);
  });

  it("refuses to delete the last active user", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/users/1").set(auth);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "last_active_user", code: "panelUser.lastActive" });
  });

  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/users");
    expect(res.status).toBe(401);
  });

  it("forbids non-admin users from managing panel users", async () => {
    const app = buildApp();
    const managerToken = tokenFor({ id: 2, email: "inativo@tanen.com.br", name: "Usuário Inativo", role: "MANAGER" });

    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });
});

describe("whatsapp users CRUD", () => {
  it("lists whatsapp users with companies and total count", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/whatsapp-users").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      name: "Roberto Costa",
      phoneE164: "+5547999990000",
      active: true,
      companies: [{ id: "10", name: "Construtora Tanen" }]
    });
  });

  it("creates a whatsapp user normalizing the phone to E.164 with DDI 55", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/whatsapp-users")
      .set(auth)
      .send({ name: "Novo Engenheiro", phone: "(47) 98888-7777", role: "Engenheiro", active: true, companyIds: ["20"] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Novo Engenheiro",
      phoneE164: "+5547988887777",
      active: true,
      companies: [{ id: "20", name: "AND Construções" }]
    });
  });

  it("accepts a phone that already includes the DDI", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/whatsapp-users")
      .set(auth)
      .send({ name: "Com DDI", phone: "+55 47 97777-6666", active: true, companyIds: [] });

    expect(res.status).toBe(201);
    expect(res.body.phoneE164).toBe("+5547977776666");
  });

  it("rejects an invalid phone with an i18n code", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/whatsapp-users")
      .set(auth)
      .send({ name: "Telefone Ruim", phone: "1234", active: true, companyIds: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_phone", code: "whatsappUser.invalidPhone" });
  });

  it("returns 409 with an i18n code for a duplicated phone", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/v1/whatsapp-users")
      .set(auth)
      .send({ name: "Duplicado", phone: "47 99999-0000", active: true, companyIds: [] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "duplicate_phone", code: "whatsappUser.duplicated" });
  });

  it("rejects invalid payloads", async () => {
    const app = buildApp();
    for (const payload of [
      {},
      { name: "Sem telefone", companyIds: [] },
      { name: "", phone: "47999990001", companyIds: [] },
      { name: "X", phone: "47999990001", companyIds: "10" },
      { name: "X", phone: "47999990001", companyIds: ["abc"] }
    ]) {
      const res = await request(app).post("/api/v1/whatsapp-users").set(auth).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_payload");
    }
  });

  it("updates a whatsapp user replacing the linked companies", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/whatsapp-users/1")
      .set(auth)
      .send({ name: "Roberto C. Silva", phone: "47 99999-0000", role: null, active: false, companyIds: ["20"] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      name: "Roberto C. Silva",
      active: false,
      companies: [{ id: "20", name: "AND Construções" }]
    });
  });

  it("returns 404 when updating an unknown whatsapp user", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/v1/whatsapp-users/999")
      .set(auth)
      .send({ name: "X", phone: "47999990009", active: true, companyIds: [] });
    expect(res.status).toBe(404);
  });

  it("refuses to delete a whatsapp user with diary entries", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/v1/whatsapp-users/1").set(auth);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "user_has_entries", code: "whatsappUser.hasEntries" });
  });

  it("deletes a whatsapp user without entries", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/v1/whatsapp-users")
      .set(auth)
      .send({ name: "Temporario", phone: "47 96666-5555", active: true, companyIds: [] });

    const res = await request(app).delete("/api/v1/whatsapp-users/2").set(auth);
    expect(res.status).toBe(200);
    expect(store.whatsappUsers.map((u) => u.id)).toEqual([1]);
  });

  it("lists companies for the multi-select", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/companies").set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: "10", name: "Construtora Tanen" },
      { id: "20", name: "AND Construções" }
    ]);
  });

  it("forbids non-admin users from managing whatsapp users", async () => {
    const app = buildApp();
    const managerToken = tokenFor({ id: 2, email: "inativo@tanen.com.br", name: "Usuário Inativo", role: "MANAGER" });

    const list = await request(app).get("/api/v1/whatsapp-users").set("Authorization", `Bearer ${managerToken}`);
    expect(list.status).toBe(403);

    const companies = await request(app).get("/api/v1/companies").set("Authorization", `Bearer ${managerToken}`);
    expect(companies.status).toBe(403);
  });
});

describe("panel API audit logs", () => {
  it("lists audit logs for an ADMIN, newest first", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/audit-logs").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].action).toBe("report.email.sent");
    expect(res.body.data[0].metadata).toMatchObject({ recipients: ["a@b.com"] });
  });

  it("filters by action", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/audit-logs?action=report.downloaded.panel").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.data[0].action).toBe("report.downloaded.panel");
  });

  it("rejects a MANAGER with 403", async () => {
    const app = buildApp();
    const managerToken = tokenFor({ id: 2, email: "gerente@tanen.com.br", name: "Gerente", role: "MANAGER" });
    const res = await request(app).get("/api/v1/audit-logs").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
  });

  it("requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/v1/audit-logs");
    expect(res.status).toBe(401);
  });
});
