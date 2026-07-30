import { describe, expect, it, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { EntryMentionIdentifier } from "../src/services/entryMentionIdentifier";

/**
 * Prisma em memória com apenas o que o identificador usa. Cobre a
 * reconciliação de menções da correção de descrição feita pelo painel, onde a
 * regra é mais sutil que na criação: código que sai do texto tem de levar
 * embora a menção e o alerta que ela gerou.
 */
type Row = Record<string, unknown>;

class FakePrisma {
  prefixes: Row[] = [
    { sectorId: null, prefix: "PS", entityType: "STANDARD" },
    { sectorId: 1, prefix: "MAT", entityType: "PERSON" }
  ];
  standards: Row[] = [{ id: 24, sectorId: 1, code: "PS-024" }];
  mentions: Row[] = [];
  alerts: Row[] = [];
  private nextMentionId = 1;
  private nextAlertId = 1;

  codePrefix = {
    findMany: async (): Promise<Row[]> => this.prefixes
  };

  entryMention = {
    findMany: async ({ where }: { where: Row }): Promise<Row[]> =>
      this.mentions.filter(
        (m) => m.entryId === where.entryId && (where.source === undefined || m.source === where.source)
      ),
    findFirst: async ({ where }: { where: Row }): Promise<Row | null> =>
      this.mentions.find(
        (m) => m.entryId === where.entryId && m.entityType === where.entityType && m.entityId != null
      ) ?? null,
    create: async ({ data }: { data: Row }): Promise<Row> => {
      const row = { id: this.nextMentionId++, ...data };
      this.mentions.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where: { id: { in: number[] } } }): Promise<{ count: number }> => {
      const ids = new Set(where.id.in);
      const before = this.mentions.length;
      this.mentions = this.mentions.filter((m) => !ids.has(m.id as number));
      return { count: before - this.mentions.length };
    }
  };

  alert = {
    create: async ({ data }: { data: Row }): Promise<Row> => {
      const row = { id: this.nextAlertId++, ...data };
      this.alerts.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where: Row }): Promise<{ count: number }> => {
      const ids = new Set((where.mentionId as { in: number[] }).in);
      const before = this.alerts.length;
      this.alerts = this.alerts.filter((a) => !(a.entryId === where.entryId && ids.has(a.mentionId as number)));
      return { count: before - this.alerts.length };
    }
  };

  standard = {
    findUnique: async ({ where }: { where: { sectorId_code: { sectorId: number; code: string } } }): Promise<Row | null> =>
      this.standards.find(
        (s) => s.sectorId === where.sectorId_code.sectorId && s.code === where.sectorId_code.code
      ) ?? null
  };

  person = { findUnique: async (): Promise<Row | null> => null };
  machine = { findUnique: async (): Promise<Row | null> => null };
  asset = { findFirst: async (): Promise<Row | null> => null };
  machineInspection = { findFirst: async (): Promise<Row | null> => null };
  competency = { findUnique: async (): Promise<Row | null> => null };
}

let prisma: FakePrisma;
let identifier: EntryMentionIdentifier;
const ENTRY = 1n;

beforeEach(() => {
  prisma = new FakePrisma();
  identifier = new EntryMentionIdentifier(prisma as unknown as PrismaClient);
});

describe("EntryMentionIdentifier.identify", () => {
  it("vincula o código da legenda e confirma quando a norma existe", async () => {
    await identifier.identify(ENTRY, 1, "Grauteamento conforme (PS-024).");

    expect(prisma.mentions).toHaveLength(1);
    expect(prisma.mentions[0]).toMatchObject({
      entityType: "STANDARD",
      entityId: 24,
      source: "CODE",
      matchedText: "(PS-024)",
      confirmed: true
    });
    expect(prisma.alerts).toHaveLength(0);
  });

  it("é idempotente — reprocessar o mesmo texto não duplica menção", async () => {
    await identifier.identify(ENTRY, 1, "Conforme (PS-024).");
    await identifier.identify(ENTRY, 1, "Conforme (PS-024).");

    expect(prisma.mentions).toHaveLength(1);
  });

  it("abre alerta quando a norma citada não está cadastrada", async () => {
    await identifier.identify(ENTRY, 1, "Conforme (PS-999).");

    expect(prisma.mentions[0]).toMatchObject({ entityId: null, confirmed: false });
    expect(prisma.alerts).toHaveLength(1);
    expect(prisma.alerts[0]).toMatchObject({ type: "STANDARD_NOT_FOUND", severity: "WARNING" });
  });
});

describe("EntryMentionIdentifier.sync", () => {
  it("remove a menção de código que saiu do texto corrigido, junto do alerta dela", async () => {
    await identifier.identify(ENTRY, 1, "Conforme (PS-999).");
    expect(prisma.alerts).toHaveLength(1);

    // Correção: o gestor arrumou o código errado.
    await identifier.sync(ENTRY, 1, "Conforme (PS-024).");

    expect(prisma.mentions).toHaveLength(1);
    expect(prisma.mentions[0]).toMatchObject({ matchedText: "(PS-024)", entityId: 24, confirmed: true });
    // O alerta da norma inexistente não pode sobreviver à correção.
    expect(prisma.alerts).toHaveLength(0);
  });

  it("preserva menções que continuam no texto", async () => {
    await identifier.identify(ENTRY, 1, "Conforme (PS-024).");
    const originalId = prisma.mentions[0].id;

    await identifier.sync(ENTRY, 1, "Grauteamento da canaleta conforme (PS-024).");

    expect(prisma.mentions).toHaveLength(1);
    expect(prisma.mentions[0].id).toBe(originalId);
  });

  it("não mexe em menções de outra origem (IA/manual/QR)", async () => {
    prisma.mentions.push({
      id: 99,
      entryId: ENTRY,
      entityType: "PERSON",
      entityId: 118,
      source: "AI",
      matchedText: "José",
      confirmed: false
    });

    await identifier.sync(ENTRY, 1, "Texto corrigido sem nenhum código.");

    expect(prisma.mentions).toHaveLength(1);
    expect(prisma.mentions[0].id).toBe(99);
  });

  it("limpa todas as menções de código quando o texto corrigido não cita nenhum", async () => {
    await identifier.identify(ENTRY, 1, "Conforme (PS-024).");

    await identifier.sync(ENTRY, 1, "Concretagem do piso.");

    expect(prisma.mentions).toHaveLength(0);
  });
});
