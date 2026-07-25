import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AssetInUseError,
  DuplicateAssetCodeError,
  DuplicatePanelUserEmailError,
  DuplicatePersonCodeError,
  DuplicateProjectCodeError,
  DuplicateStandardCodeError,
  DuplicateWhatsappUserPhoneError,
  PersonInUseError,
  ProjectInUseError,
  StandardInUseError,
  WhatsappUserHasEntriesError,
  type AlertRecord,
  type AssetInput,
  type AssetListInput,
  type AssetListResult,
  type AssetRecord,
  type AssetTypeRef,
  type PersonInput,
  type PersonListInput,
  type PersonListResult,
  type PersonRecord,
  type CodeRef,
  type EntryRecord,
  type MediaRecord,
  type PanelStore,
  type PanelUserListInput,
  type PanelUserListItem,
  type PanelUserListResult,
  type PanelUserRecord,
  type PersonRef,
  type ProjectInput,
  type ProjectListInput,
  type ProjectListItem,
  type ProjectListResult,
  type ProjectRecord,
  type AuditLogListInput,
  type AuditLogListResult,
  type StandardInput,
  type StandardListInput,
  type StandardListResult,
  type StandardRecord,
  type CompanyRef,
  type WhatsappUserListItem,
  type WhatsappUserListResult
} from "./panelService";

const PANEL_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true
} as const;

const WHATSAPP_USER_INCLUDE = {
  companies: { include: { company: { select: { id: true, name: true } } } }
} as const;

type WhatsappUserRow = Prisma.UserGetPayload<{ include: typeof WHATSAPP_USER_INCLUDE }>;

function mapWhatsappUser(row: WhatsappUserRow): WhatsappUserListItem {
  return {
    id: row.id,
    name: row.name,
    phoneE164: row.phoneE164,
    role: row.role,
    active: row.active,
    companies: row.companies.map((link) => ({
      id: link.company.id.toString(),
      name: link.company.name
    }))
  };
}

const STANDARD_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  version: true,
  active: true
} as const;

const ASSET_SELECT = {
  id: true,
  code: true,
  name: true,
  assetTypeId: true,
  projectId: true,
  active: true,
  assetType: { select: { name: true } }
} as const;

const PERSON_SELECT = {
  id: true,
  name: true,
  registrationCode: true,
  role: true,
  status: true,
  projectId: true
} as const;

export class PrismaPanelStore implements PanelStore {
  constructor(private readonly prisma: PrismaClient) {}

  async getProject(projectId?: number): Promise<ProjectRecord | null> {
    const project = projectId
      ? await this.prisma.project.findUnique({
          where: { id: projectId },
          include: { sector: true }
        })
      : await this.prisma.project.findFirst({
          where: { status: "ACTIVE" },
          orderBy: { id: "asc" },
          include: { sector: true }
        });

    if (!project) {
      return null;
    }

    return {
      id: project.id,
      name: project.name,
      attributes: project.attributes,
      sector: { code: project.sector.code, name: project.sector.name }
    };
  }

  async findEntriesForDay(input: { projectId: number; start: Date; end: Date }): Promise<EntryRecord[]> {
    const entries = await this.prisma.entry.findMany({
      where: {
        projectId: input.projectId,
        createdAt: { gte: input.start, lt: input.end }
      },
      include: {
        user: { select: { name: true } },
        mentions: true,
        media: {
          orderBy: { id: "asc" },
          take: 1
        },
        _count: { select: { media: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      description: entry.description,
      authorName: entry.user.name,
      media:
        entry.media[0] != null
          ? {
              id: entry.media[0].id,
              mediaType: entry.media[0].mediaType
            }
          : null,
      mediaCount: entry._count.media,
      mentions: entry.mentions.map((m) => ({
        id: m.id,
        entityType: m.entityType,
        entityId: m.entityId,
        source: m.source,
        confidence: m.confidence,
        matchedText: m.matchedText,
        confirmed: m.confirmed
      }))
    }));
  }

  async findMediaById(id: bigint): Promise<MediaRecord | null> {
    const media = await this.prisma.entryMedia.findUnique({
      where: { id },
      select: { id: true, mediaUrl: true, mediaType: true }
    });

    return media;
  }

  async findAlertsForEntries(entryIds: bigint[]): Promise<AlertRecord[]> {
    if (entryIds.length === 0) {
      return [];
    }

    const alerts = await this.prisma.alert.findMany({
      where: { entryId: { in: entryIds } },
      orderBy: { createdAt: "asc" }
    });

    return alerts.map((a) => ({
      id: a.id,
      entryId: a.entryId,
      mentionId: a.mentionId,
      type: a.type,
      severity: a.severity,
      title: a.title,
      detail: a.detail,
      status: a.status
    }));
  }

  async findStandardsByIds(ids: number[]): Promise<CodeRef[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.standard.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true }
    });
  }

  async findPeopleByIds(ids: number[]): Promise<PersonRef[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.person.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, registrationCode: true }
    });
  }

  async findMachinesByIds(ids: number[]): Promise<CodeRef[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.machine.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true }
    });
  }

  async findAssetsByIds(ids: number[]): Promise<CodeRef[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.asset.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true }
    });
  }

  async resolveAlert(id: number): Promise<boolean> {
    const result = await this.prisma.alert.updateMany({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() }
    });
    return result.count > 0;
  }

  async acknowledgeAlert(id: number): Promise<boolean> {
    const result = await this.prisma.alert.updateMany({
      where: { id },
      data: { status: "ACKNOWLEDGED" }
    });
    return result.count > 0;
  }

  async confirmMention(id: number): Promise<boolean> {
    const result = await this.prisma.entryMention.updateMany({
      where: { id },
      data: { confirmed: true }
    });
    return result.count > 0;
  }

  async rejectMention(id: number): Promise<boolean> {
    const result = await this.prisma.entryMention.deleteMany({
      where: { id }
    });
    return result.count > 0;
  }

  async listAuditLogs(input: AuditLogListInput): Promise<AuditLogListResult> {
    const where: Prisma.AuditLogWhereInput = {};
    if (input.action) {
      where.action = input.action;
    }
    if (input.search) {
      where.OR = [
        { actorLabel: { contains: input.search, mode: "insensitive" } },
        { entityId: { contains: input.search, mode: "insensitive" } }
      ];
    }

    const [rows, totalCount] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: input.page * input.size,
        take: input.size
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id.toString(),
        actorType: row.actorType,
        actorId: row.actorId,
        actorLabel: row.actorLabel,
        action: row.action,
        status: row.status,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata,
        createdAt: row.createdAt
      })),
      totalCount
    };
  }

  async listStandards(input: StandardListInput): Promise<StandardListResult> {
    const sectorId = await this.defaultSectorId();
    const where: Prisma.StandardWhereInput = { sectorId };

    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: "insensitive" } },
        { title: { contains: input.search, mode: "insensitive" } }
      ];
    }

    const [data, totalCount] = await Promise.all([
      this.prisma.standard.findMany({
        where,
        select: STANDARD_SELECT,
        orderBy: { code: "asc" },
        skip: input.page * input.size,
        take: input.size
      }),
      this.prisma.standard.count({ where })
    ]);

    return { data, totalCount };
  }

  async findStandardById(id: number): Promise<StandardRecord | null> {
    return this.prisma.standard.findUnique({
      where: { id },
      select: STANDARD_SELECT
    });
  }

  async createStandard(input: StandardInput): Promise<StandardRecord> {
    const sectorId = await this.defaultSectorId();
    try {
      return await this.prisma.standard.create({
        data: { sectorId, ...input },
        select: STANDARD_SELECT
      });
    } catch (error) {
      throw translateStandardError(error, input.code);
    }
  }

  async updateStandard(id: number, input: StandardInput): Promise<StandardRecord | null> {
    try {
      return await this.prisma.standard.update({
        where: { id },
        data: input,
        select: STANDARD_SELECT
      });
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return null;
      }
      throw translateStandardError(error, input.code);
    }
  }

  async deleteStandard(id: number): Promise<boolean> {
    try {
      await this.prisma.standard.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return false;
      }
      if (isPrismaError(error, "P2003")) {
        throw new StandardInUseError(id);
      }
      throw error;
    }
  }

  async listAssets(input: AssetListInput): Promise<AssetListResult> {
    const sectorId = await this.defaultSectorId();
    const where: Prisma.AssetWhereInput = { sectorId };

    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: "insensitive" } },
        { name: { contains: input.search, mode: "insensitive" } }
      ];
    }

    const [data, totalCount] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        select: ASSET_SELECT,
        orderBy: { code: "asc" },
        skip: input.page * input.size,
        take: input.size
      }),
      this.prisma.asset.count({ where })
    ]);

    return { data: data.map(toAssetRecord), totalCount };
  }

  async findAssetById(id: number): Promise<AssetRecord | null> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      select: ASSET_SELECT
    });
    return asset ? toAssetRecord(asset) : null;
  }

  async createAsset(input: AssetInput): Promise<AssetRecord> {
    const sectorId = await this.defaultSectorId();
    try {
      const asset = await this.prisma.asset.create({
        data: { sectorId, ...input },
        select: ASSET_SELECT
      });
      return toAssetRecord(asset);
    } catch (error) {
      throw translateAssetError(error, input.code);
    }
  }

  async updateAsset(id: number, input: AssetInput): Promise<AssetRecord | null> {
    try {
      const asset = await this.prisma.asset.update({
        where: { id },
        data: input,
        select: ASSET_SELECT
      });
      return toAssetRecord(asset);
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return null;
      }
      throw translateAssetError(error, input.code);
    }
  }

  async deleteAsset(id: number): Promise<boolean> {
    try {
      await this.prisma.asset.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return false;
      }
      if (isPrismaError(error, "P2003")) {
        throw new AssetInUseError(id);
      }
      throw error;
    }
  }

  async listAssetTypes(): Promise<AssetTypeRef[]> {
    const sectorId = await this.defaultSectorId();
    return this.prisma.assetType.findMany({
      where: { sectorId },
      select: { id: true, code: true, name: true, level: true, parentTypeId: true },
      orderBy: [{ level: "asc" }, { name: "asc" }]
    });
  }

  async listPeople(input: PersonListInput): Promise<PersonListResult> {
    const sectorId = await this.defaultSectorId();
    const where: Prisma.PersonWhereInput = { sectorId };

    if (input.search) {
      where.OR = [
        { name: { contains: input.search, mode: "insensitive" } },
        { registrationCode: { contains: input.search, mode: "insensitive" } },
        { role: { contains: input.search, mode: "insensitive" } }
      ];
    }

    const [data, totalCount] = await Promise.all([
      this.prisma.person.findMany({
        where,
        select: PERSON_SELECT,
        orderBy: { name: "asc" },
        skip: input.page * input.size,
        take: input.size
      }),
      this.prisma.person.count({ where })
    ]);

    return { data, totalCount };
  }

  async findPersonById(id: number): Promise<PersonRecord | null> {
    return this.prisma.person.findUnique({
      where: { id },
      select: PERSON_SELECT
    });
  }

  async createPerson(input: PersonInput): Promise<PersonRecord> {
    const [companyId, sectorId] = await Promise.all([this.defaultCompanyId(), this.defaultSectorId()]);
    try {
      return await this.prisma.person.create({
        data: { sectorId, companyId, ...input },
        select: PERSON_SELECT
      });
    } catch (error) {
      throw translatePersonError(error, input.registrationCode);
    }
  }

  async updatePerson(id: number, input: PersonInput): Promise<PersonRecord | null> {
    try {
      return await this.prisma.person.update({
        where: { id },
        data: input,
        select: PERSON_SELECT
      });
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return null;
      }
      throw translatePersonError(error, input.registrationCode);
    }
  }

  async deletePerson(id: number): Promise<boolean> {
    try {
      await this.prisma.person.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return false;
      }
      if (isPrismaError(error, "P2003")) {
        throw new PersonInUseError(id);
      }
      throw error;
    }
  }

  async listProjects(input: ProjectListInput): Promise<ProjectListResult> {
    const where: Prisma.ProjectWhereInput = {};

    if (input.activeOnly) {
      where.status = "ACTIVE";
    }
    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: "insensitive" } },
        { name: { contains: input.search, mode: "insensitive" } }
      ];
    }

    const [projects, totalCount] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { name: "asc" },
        skip: input.page * input.size,
        take: input.size
      }),
      this.prisma.project.count({ where })
    ]);

    return { data: projects.map(toProjectListItem), totalCount };
  }

  async findProjectItemById(id: number): Promise<ProjectListItem | null> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    return project ? toProjectListItem(project) : null;
  }

  async createProject(input: ProjectInput): Promise<ProjectListItem> {
    const [companyId, sectorId] = await Promise.all([this.defaultCompanyId(), this.defaultSectorId()]);
    try {
      const project = await this.prisma.project.create({
        data: {
          companyId,
          sectorId,
          code: input.code,
          name: input.name,
          status: input.active ? "ACTIVE" : "INACTIVE",
          attributes: input.context ? { context: input.context } : undefined,
          whatsappGroupId: input.whatsappGroupId,
          whatsappAutoReportEnabled: input.whatsappAutoReportEnabled,
          reportEmailRecipients: input.reportEmailRecipients,
          emailAutoReportEnabled: input.emailAutoReportEnabled
        }
      });
      return toProjectListItem(project);
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        throw new DuplicateProjectCodeError(input.code);
      }
      throw error;
    }
  }

  async updateProject(id: number, input: ProjectInput): Promise<ProjectListItem | null> {
    const existing = await this.prisma.project.findUnique({ where: { id }, select: { attributes: true } });
    if (!existing) {
      return null;
    }

    // Preserva outras chaves de attributes; só o context é editável pelo painel.
    const attributes =
      existing.attributes && typeof existing.attributes === "object" && !Array.isArray(existing.attributes)
        ? { ...(existing.attributes as Prisma.JsonObject) }
        : {};
    if (input.context) {
      attributes.context = input.context;
    } else {
      delete attributes.context;
    }

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          code: input.code,
          name: input.name,
          status: input.active ? "ACTIVE" : "INACTIVE",
          attributes,
          whatsappGroupId: input.whatsappGroupId,
          whatsappAutoReportEnabled: input.whatsappAutoReportEnabled,
          reportEmailRecipients: input.reportEmailRecipients,
          emailAutoReportEnabled: input.emailAutoReportEnabled
        }
      });
      return toProjectListItem(project);
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return null;
      }
      if (isPrismaError(error, "P2002")) {
        throw new DuplicateProjectCodeError(input.code);
      }
      throw error;
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    const entryCount = await this.prisma.entry.count({ where: { projectId: id } });
    if (entryCount > 0) {
      throw new ProjectInUseError(id);
    }

    try {
      await this.prisma.project.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return false;
      }
      if (isPrismaError(error, "P2003")) {
        throw new ProjectInUseError(id);
      }
      throw error;
    }
  }

  async setProjectCoverKey(id: number, key: string): Promise<boolean> {
    const existing = await this.prisma.project.findUnique({ where: { id }, select: { attributes: true } });
    if (!existing) {
      return false;
    }

    // Preserva as demais chaves de attributes (ex.: context); só grava a coverImage.
    const attributes =
      existing.attributes && typeof existing.attributes === "object" && !Array.isArray(existing.attributes)
        ? { ...(existing.attributes as Prisma.JsonObject) }
        : {};
    attributes.coverImage = key;

    await this.prisma.project.update({ where: { id }, data: { attributes } });
    return true;
  }

  async findProjectCoverKey(id: number): Promise<string | null> {
    const project = await this.prisma.project.findUnique({ where: { id }, select: { attributes: true } });
    const attributes = project?.attributes;
    if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
      return null;
    }
    const key = (attributes as Record<string, unknown>).coverImage;
    return typeof key === "string" && key !== "" ? key : null;
  }

  async listPanelUsers(input: PanelUserListInput): Promise<PanelUserListResult> {
    const where: Prisma.PanelUserWhereInput = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } }
          ]
        }
      : {};

    const [data, totalCount] = await Promise.all([
      this.prisma.panelUser.findMany({
        where,
        select: PANEL_USER_SELECT,
        orderBy: { name: "asc" },
        skip: input.page * input.size,
        take: input.size
      }),
      this.prisma.panelUser.count({ where })
    ]);

    return { data, totalCount };
  }

  async findPanelUserById(id: number): Promise<PanelUserListItem | null> {
    return this.prisma.panelUser.findUnique({ where: { id }, select: PANEL_USER_SELECT });
  }

  async findPanelUserByEmail(email: string): Promise<PanelUserRecord | null> {
    return this.prisma.panelUser.findUnique({ where: { email } });
  }

  async createPanelUser(input: {
    email: string;
    name: string;
    role: "ADMIN" | "MANAGER";
    active: boolean;
    passwordHash: string;
  }): Promise<PanelUserListItem> {
    try {
      return await this.prisma.panelUser.create({
        data: input,
        select: PANEL_USER_SELECT
      });
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        throw new DuplicatePanelUserEmailError(input.email);
      }
      throw error;
    }
  }

  async updatePanelUser(
    id: number,
    input: { email: string; name: string; role: "ADMIN" | "MANAGER"; active: boolean; passwordHash?: string }
  ): Promise<PanelUserListItem | null> {
    try {
      return await this.prisma.panelUser.update({
        where: { id },
        data: input,
        select: PANEL_USER_SELECT
      });
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return null;
      }
      if (isPrismaError(error, "P2002")) {
        throw new DuplicatePanelUserEmailError(input.email);
      }
      throw error;
    }
  }

  async deletePanelUser(id: number): Promise<boolean> {
    try {
      await this.prisma.panelUser.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return false;
      }
      throw error;
    }
  }

  async countActivePanelUsers(excludingId?: number): Promise<number> {
    return this.prisma.panelUser.count({
      where: { active: true, id: excludingId ? { not: excludingId } : undefined }
    });
  }

  // ---- Usuários WhatsApp (tabela users — quem o bot responde) ---------------

  async listWhatsappUsers(input: PanelUserListInput): Promise<WhatsappUserListResult> {
    const where: Prisma.UserWhereInput = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { phoneE164: { contains: input.search.replace(/[^\d+]/g, "") || input.search } }
          ]
        }
      : {};

    const [rows, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: WHATSAPP_USER_INCLUDE,
        orderBy: { name: "asc" },
        skip: input.page * input.size,
        take: input.size
      }),
      this.prisma.user.count({ where })
    ]);

    return { data: rows.map(mapWhatsappUser), totalCount };
  }

  async findWhatsappUserById(id: number): Promise<WhatsappUserListItem | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: WHATSAPP_USER_INCLUDE });
    return row ? mapWhatsappUser(row) : null;
  }

  async createWhatsappUser(input: {
    phoneE164: string;
    name: string;
    role: string | null;
    active: boolean;
    companyIds: bigint[];
  }): Promise<WhatsappUserListItem> {
    try {
      const row = await this.prisma.user.create({
        data: {
          phoneE164: input.phoneE164,
          name: input.name,
          role: input.role,
          active: input.active,
          companies: { create: input.companyIds.map((companyId) => ({ companyId })) }
        },
        include: WHATSAPP_USER_INCLUDE
      });
      return mapWhatsappUser(row);
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        throw new DuplicateWhatsappUserPhoneError(input.phoneE164);
      }
      throw error;
    }
  }

  async updateWhatsappUser(
    id: number,
    input: { phoneE164: string; name: string; role: string | null; active: boolean; companyIds: bigint[] }
  ): Promise<WhatsappUserListItem | null> {
    try {
      const row = await this.prisma.user.update({
        where: { id },
        data: {
          phoneE164: input.phoneE164,
          name: input.name,
          role: input.role,
          active: input.active,
          // Substitui o conjunto de empresas vinculadas (user_companies).
          companies: {
            deleteMany: {},
            create: input.companyIds.map((companyId) => ({ companyId }))
          }
        },
        include: WHATSAPP_USER_INCLUDE
      });
      return mapWhatsappUser(row);
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return null;
      }
      if (isPrismaError(error, "P2002")) {
        throw new DuplicateWhatsappUserPhoneError(input.phoneE164);
      }
      throw error;
    }
  }

  async deleteWhatsappUser(id: number): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return false;
      }
      // Usuário com registros no diário não pode ser apagado (desative-o).
      if (isPrismaError(error, "P2003")) {
        throw new WhatsappUserHasEntriesError(id);
      }
      throw error;
    }
  }

  async listCompanies(): Promise<CompanyRef[]> {
    const companies = await this.prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
    return companies.map((company) => ({ id: company.id.toString(), name: company.name }));
  }

  /** Empresa padrão do painel (cliente único na v1): a primeira cadastrada. */
  private async defaultCompanyId(): Promise<bigint> {
    const company = await this.prisma.company.findFirst({
      orderBy: { id: "asc" },
      select: { id: true }
    });
    if (!company) {
      throw new Error("No company configured");
    }
    return company.id;
  }

  /**
   * Setor padrão do painel: o do projeto ativo (configuração do cliente),
   * com fallback para o primeiro setor cadastrado.
   */
  private async defaultSectorId(): Promise<number> {
    const project = await this.prisma.project.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { id: "asc" },
      select: { sectorId: true }
    });
    if (project) {
      return project.sectorId;
    }

    const sector = await this.prisma.sector.findFirst({
      orderBy: { id: "asc" },
      select: { id: true }
    });
    if (!sector) {
      throw new Error("No sector configured");
    }
    return sector.id;
  }
}

function toProjectListItem(project: {
  id: number;
  code: string;
  name: string;
  status: string;
  attributes: unknown;
  whatsappGroupId: string | null;
  whatsappAutoReportEnabled: boolean;
  reportEmailRecipients: string[];
  emailAutoReportEnabled: boolean;
}): ProjectListItem {
  const attributes =
    project.attributes && typeof project.attributes === "object" && !Array.isArray(project.attributes)
      ? (project.attributes as Record<string, unknown>)
      : {};
  const context = attributes.context;
  const hasCover = typeof attributes.coverImage === "string" && attributes.coverImage !== "";

  return {
    id: project.id,
    code: project.code,
    name: project.name,
    context: typeof context === "string" ? context : null,
    active: project.status === "ACTIVE",
    // A key S3 fica no banco; a API expõe só a URL de download autenticado.
    coverImage: hasCover ? `/projects/${project.id}/cover` : null,
    whatsappGroupId: project.whatsappGroupId,
    whatsappAutoReportEnabled: project.whatsappAutoReportEnabled,
    reportEmailRecipients: project.reportEmailRecipients,
    emailAutoReportEnabled: project.emailAutoReportEnabled
  };
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function translateStandardError(error: unknown, code: string): unknown {
  if (isPrismaError(error, "P2002")) {
    return new DuplicateStandardCodeError(code);
  }
  return error;
}

function translateAssetError(error: unknown, code: string): unknown {
  if (isPrismaError(error, "P2002")) {
    return new DuplicateAssetCodeError(code);
  }
  return error;
}

function translatePersonError(error: unknown, code: string | null): unknown {
  if (isPrismaError(error, "P2002")) {
    return new DuplicatePersonCodeError(code ?? "");
  }
  return error;
}

function toAssetRecord(asset: {
  id: number;
  code: string;
  name: string;
  assetTypeId: number;
  projectId: number;
  active: boolean;
  assetType: { name: string };
}): AssetRecord {
  return {
    id: asset.id,
    code: asset.code,
    name: asset.name,
    assetTypeId: asset.assetTypeId,
    assetTypeName: asset.assetType.name,
    projectId: asset.projectId,
    active: asset.active
  };
}
