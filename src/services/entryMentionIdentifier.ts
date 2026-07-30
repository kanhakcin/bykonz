import type { PrismaClient } from "@prisma/client";
import { extractCodeMentions, type ParsedEntityType } from "./mentionParser";

/**
 * Pipeline de identificação, etapa [1] (determinística) — extrai códigos entre
 * parênteses da legenda, resolve pela tabela de prefixos do setor e grava
 * EntryMention + Alert conforme docs/arquitetura-dados-nova-versao-v1.md §5-6.
 *
 * Compartilhado por dois caminhos de escrita:
 *  - bot (PrismaConversationStore): `identify`, que só adiciona menções;
 *  - painel (PrismaPanelStore), ao corrigir a descrição: `sync`, que também
 *    remove as menções de código que deixaram de existir no texto.
 */
export class EntryMentionIdentifier {
  constructor(private readonly prisma: PrismaClient) {}

  /** Mapa de prefixos visível ao setor (global + específico; específico vence). */
  private async loadPrefixMap(sectorId: number | null): Promise<Map<string, { entityType: ParsedEntityType }>> {
    const prefixRows = await this.prisma.codePrefix.findMany({
      where: { OR: [{ sectorId: null }, { sectorId: sectorId ?? undefined }] }
    });
    // Prefixo específico do setor tem prioridade sobre o global de mesmo nome.
    const prefixMap = new Map<string, { entityType: ParsedEntityType }>();
    for (const row of prefixRows.sort((a, b) => (a.sectorId == null ? -1 : 1) - (b.sectorId == null ? -1 : 1))) {
      prefixMap.set(row.prefix.toUpperCase(), { entityType: row.entityType as ParsedEntityType });
    }
    return prefixMap;
  }

  /** True quando o texto cita ao menos um código de norma reconhecido no setor. */
  async hasStandardCode(sectorId: number | null, text: string): Promise<boolean> {
    if (!text.trim()) {
      return false;
    }

    const prefixMap = await this.loadPrefixMap(sectorId);
    const mentions = extractCodeMentions(text, prefixMap);
    return mentions.some((m) => m.entityType === "STANDARD");
  }

  /**
   * Vincula os códigos do texto que ainda não estão na entrada.
   * Idempotente por (entryId, matchedText): reprocessar não duplica.
   */
  async identify(entryId: bigint, sectorId: number | null, text: string): Promise<void> {
    if (!text.trim()) {
      return;
    }

    const prefixMap = await this.loadPrefixMap(sectorId);

    const mentions = extractCodeMentions(text, prefixMap);
    if (mentions.length === 0) {
      return;
    }

    const existing = await this.prisma.entryMention.findMany({
      where: { entryId },
      select: { matchedText: true }
    });
    const alreadyLinked = new Set(existing.map((m) => m.matchedText));

    // STANDARD primeiro: checkPersonTraining depende da norma já estar
    // resolvida na mesma entrada, independente da ordem no texto.
    const ordered = [...mentions].sort((a, b) => (a.entityType === "STANDARD" ? -1 : 1) - (b.entityType === "STANDARD" ? -1 : 1));

    for (const mention of ordered) {
      if (alreadyLinked.has(mention.matchedText)) {
        continue;
      }

      const entityId = sectorId != null ? await this.resolveEntityId(mention.entityType, sectorId, mention.code) : null;

      const created = await this.prisma.entryMention.create({
        data: {
          entryId,
          entityType: mention.entityType,
          entityId,
          source: "CODE",
          matchedText: mention.matchedText,
          confirmed: entityId != null
        }
      });

      await this.applyAlertRule(entryId, created.id, mention, entityId);
    }
  }

  /**
   * Reconcilia as menções de código com o texto corrigido: apaga as de
   * `source: CODE` cujo código saiu do texto (junto dos alertas que elas
   * geraram, para o painel não exibir alerta órfão) e identifica as novas.
   *
   * Menções de outras origens (AI/MANUAL/QR) são preservadas — não vieram de
   * um código no texto, então não é a correção da legenda que as invalida.
   * Alertas de menções que continuam válidas também ficam: são snapshots do
   * momento do registro (§6), não estado recalculável.
   */
  async sync(entryId: bigint, sectorId: number | null, text: string): Promise<void> {
    const prefixMap = await this.loadPrefixMap(sectorId);
    const stillPresent = new Set(extractCodeMentions(text, prefixMap).map((m) => m.matchedText));

    const stale = await this.prisma.entryMention.findMany({
      where: { entryId, source: "CODE" },
      select: { id: true, matchedText: true }
    });
    const staleIds = stale.filter((m) => m.matchedText == null || !stillPresent.has(m.matchedText)).map((m) => m.id);

    if (staleIds.length > 0) {
      // Alertas primeiro: mentionId é SetNull, então apagar a menção antes
      // deixaria o alerta vivo e sem vínculo.
      await this.prisma.alert.deleteMany({ where: { entryId, mentionId: { in: staleIds } } });
      await this.prisma.entryMention.deleteMany({ where: { id: { in: staleIds } } });
    }

    await this.identify(entryId, sectorId, text);
  }

  private async resolveEntityId(entityType: ParsedEntityType, sectorId: number, code: string): Promise<number | null> {
    switch (entityType) {
      case "STANDARD": {
        const standard = await this.prisma.standard.findUnique({
          where: { sectorId_code: { sectorId, code } },
          select: { id: true }
        });
        return standard?.id ?? null;
      }
      case "MACHINE": {
        const machine = await this.prisma.machine.findUnique({
          where: { sectorId_code: { sectorId, code } },
          select: { id: true }
        });
        return machine?.id ?? null;
      }
      case "PERSON": {
        const person = await this.prisma.person.findUnique({
          where: { sectorId_registrationCode: { sectorId, registrationCode: code } },
          select: { id: true }
        });
        return person?.id ?? null;
      }
      case "ASSET": {
        const asset = await this.prisma.asset.findFirst({
          where: { sectorId, code },
          select: { id: true }
        });
        return asset?.id ?? null;
      }
      default:
        return null;
    }
  }

  /** docs/arquitetura-dados-nova-versao-v1.md §6 — motor de alertas (snapshot no momento do registro). */
  private async applyAlertRule(
    entryId: bigint,
    mentionId: number,
    mention: { entityType: ParsedEntityType; code: string },
    entityId: number | null
  ): Promise<void> {
    if (entityId == null) {
      if (mention.entityType === "STANDARD") {
        await this.prisma.alert.create({
          data: {
            entryId,
            mentionId,
            type: "STANDARD_NOT_FOUND",
            severity: "WARNING",
            title: `Norma ${mention.code} não encontrada`,
            detail: `Código citado no registro não corresponde a nenhuma norma cadastrada.`
          }
        });
      }
      return;
    }

    if (mention.entityType === "MACHINE") {
      await this.applyMachineAlert(entryId, mentionId, entityId);
    }
    // PERSON_NOT_TRAINED depende da norma também citada na mesma entrada —
    // ver checkPersonTraining, chamado depois que todas as menções da
    // entrada foram resolvidas (identify processa uma por vez, mas
    // a norma e a pessoa costumam estar na mesma legenda).
    if (mention.entityType === "PERSON") {
      await this.checkPersonTraining(entryId, mentionId, entityId);
    }
  }

  private async applyMachineAlert(entryId: bigint, mentionId: number, machineId: number): Promise<void> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: { code: true }
    });
    if (!machine) {
      return;
    }

    const lastInspection = await this.prisma.machineInspection.findFirst({
      where: { machineId },
      orderBy: { inspectedAt: "desc" }
    });

    if (!lastInspection || lastInspection.result === "REJECTED") {
      await this.prisma.alert.create({
        data: {
          entryId,
          mentionId,
          type: "MACHINE_NO_INSPECTION",
          severity: "CRITICAL",
          title: `Máquina ${machine.code} sem vistoria válida`,
          detail: lastInspection ? "Última vistoria foi reprovada." : "Nenhuma vistoria registrada."
        }
      });
      return;
    }

    if (lastInspection.validUntil && lastInspection.validUntil.getTime() < Date.now()) {
      await this.prisma.alert.create({
        data: {
          entryId,
          mentionId,
          type: "MACHINE_INSPECTION_EXPIRED",
          severity: "CRITICAL",
          title: `Máquina ${machine.code} — vistoria vencida`,
          detail: `Última vistoria válida até ${lastInspection.validUntil.toLocaleDateString("pt-BR")}.`
        }
      });
    }
  }

  private async checkPersonTraining(entryId: bigint, mentionId: number, personId: number): Promise<void> {
    // A norma exigida é a outra menção STANDARD já resolvida na mesma entrada.
    const standardMention = await this.prisma.entryMention.findFirst({
      where: { entryId, entityType: "STANDARD", entityId: { not: null } },
      select: { entityId: true }
    });
    if (!standardMention?.entityId) {
      return;
    }

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { name: true, registrationCode: true }
    });
    if (!person) {
      return;
    }

    const competency = await this.prisma.competency.findUnique({
      where: { personId_standardId: { personId, standardId: standardMention.entityId } }
    });

    const isTrained =
      competency?.status === "TRAINED" && (!competency.validUntil || competency.validUntil.getTime() >= Date.now());

    if (!isTrained) {
      const standard = await this.prisma.standard.findUnique({
        where: { id: standardMention.entityId },
        select: { code: true }
      });

      await this.prisma.alert.create({
        data: {
          entryId,
          mentionId,
          type: "PERSON_NOT_TRAINED",
          severity: "WARNING",
          title: `${person.name} não treinado`,
          detail: standard ? `Competência ausente ou vencida para a norma ${standard.code}.` : null
        }
      });
    }
  }
}
