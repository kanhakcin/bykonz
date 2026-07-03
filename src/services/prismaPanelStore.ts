import type { PrismaClient } from "@prisma/client";
import type {
  AlertRecord,
  CodeRef,
  EntryRecord,
  MediaRecord,
  PanelStore,
  PersonRef,
  ProjectRecord
} from "./panelService";

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
}
