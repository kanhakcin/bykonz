import type { PrismaClient } from "@prisma/client";
import type { AuditLogEntry, AuditLogger } from "./conversationService";

/**
 * Grava a trilha de auditoria em `audit_logs`. Best-effort por contrato: uma
 * falha de gravação nunca é propagada (só logada), para não derrubar o fluxo
 * principal — enviar o relatório é mais importante do que registrar o log.
 */
export class PrismaAuditLogger implements AuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  async record(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: entry.actorType,
          actorId: entry.actorId ?? null,
          actorLabel: entry.actorLabel ?? null,
          action: entry.action,
          status: entry.status ?? "OK",
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? undefined) as never
        }
      });
    } catch (error) {
      console.error("[auditLogger] Falha ao gravar log de auditoria:", error);
    }
  }
}
