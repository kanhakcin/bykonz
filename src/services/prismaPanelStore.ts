import { Prisma, type PrismaClient } from "@prisma/client";
import {
  DuplicateProjectCodeError,
  DuplicateStandardCodeError,
  ProjectInUseError,
  StandardInUseError,
  type AlertRecord,
  type CodeRef,
  type EntryRecord,
  type MediaRecord,
  type PanelStore,
  type PersonRef,
  type ProjectInput,
  type ProjectListInput,
  type ProjectListItem,
  type ProjectListResult,
  type ProjectRecord,
  type StandardInput,
  type StandardListInput,
  type StandardListResult,
  type StandardRecord
} from "./panelService";

const STANDARD_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  version: true,
  active: true
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
      orderBy: { createdAt: "asc" }
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
          attributes: input.context ? { context: input.context } : undefined
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
          attributes
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
}): ProjectListItem {
  const attributes = project.attributes;
  const context =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? (attributes as Record<string, unknown>).context
      : null;

  return {
    id: project.id,
    code: project.code,
    name: project.name,
    context: typeof context === "string" ? context : null,
    active: project.status === "ACTIVE"
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
