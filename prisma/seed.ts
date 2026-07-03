/**
 * Seed de desenvolvimento/demonstração.
 *
 * Re-executável: catálogos usam upsert por chave natural; o diário de
 * demonstração (entries/mentions/alerts) do projeto AUR é recriado para a
 * data de execução, reproduzindo exatamente o cenário do painel:
 * 4 registros, 2 alertas abertos, 1 triagem de IA pendente, 50% conformidade.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Data de hoje (fuso do painel, -03:00) em YYYY-MM-DD. */
function todayISODate(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function todayAt(time: string): Date {
  return new Date(`${todayISODate()}T${time}:00-03:00`);
}

async function main() {
  // --- Sectors -------------------------------------------------------------
  const civil = await prisma.sector.upsert({
    where: { code: "CIVIL" },
    update: {},
    create: { code: "CIVIL", name: "Construção civil" }
  });
  const naval = await prisma.sector.upsert({
    where: { code: "NAVAL" },
    update: {},
    create: { code: "NAVAL", name: "Construção naval" }
  });

  // --- Asset type hierarchies ---------------------------------------------
  async function upsertAssetType(sectorId: number, code: string, name: string, level: number, parentTypeId?: number) {
    return prisma.assetType.upsert({
      where: { sectorId_code: { sectorId, code } },
      update: { name, level, parentTypeId: parentTypeId ?? null },
      create: { sectorId, code, name, level, parentTypeId: parentTypeId ?? null }
    });
  }

  const civilObra = await upsertAssetType(civil.id, "OBRA", "Obra", 1);
  const civilTorre = await upsertAssetType(civil.id, "TORRE", "Torre", 2, civilObra.id);
  const civilPavimento = await upsertAssetType(civil.id, "PAVIMENTO", "Pavimento / Laje", 3, civilTorre.id);
  const civilUnidade = await upsertAssetType(civil.id, "UNIDADE", "Unidade", 4, civilPavimento.id);
  const civilLocal = await upsertAssetType(civil.id, "LOCAL", "Local", 5, civilUnidade.id);

  const navalEmbarcacao = await upsertAssetType(naval.id, "EMBARCACAO", "Embarcação", 1);
  const navalSecao = await upsertAssetType(naval.id, "SECAO", "Seção / Convés", 2, navalEmbarcacao.id);
  await upsertAssetType(naval.id, "COMPARTIMENTO", "Compartimento", 3, navalSecao.id);

  // --- Code prefixes (global) ----------------------------------------------
  for (const [prefix, entityType] of [
    ["PS", "STANDARD"],
    ["MX", "MACHINE"],
    ["MAT", "PERSON"]
  ] as const) {
    const existing = await prisma.codePrefix.findFirst({ where: { sectorId: null, prefix } });
    if (!existing) {
      await prisma.codePrefix.create({ data: { sectorId: null, prefix, entityType } });
    }
  }

  // --- Company + project + assets -------------------------------------------
  let company = await prisma.company.findFirst({ where: { name: "Construtora Tanen" } });
  company ??= await prisma.company.create({ data: { name: "Construtora Tanen" } });

  const project = await prisma.project.upsert({
    where: { companyId_code: { companyId: company.id, code: "AUR" } },
    update: { attributes: { context: "Apto 1403 · Laje tipo 04" } },
    create: {
      companyId: company.id,
      sectorId: civil.id,
      code: "AUR",
      name: "Obra Residencial Aurora",
      attributes: { context: "Apto 1403 · Laje tipo 04" }
    }
  });

  async function upsertAsset(code: string, name: string, assetTypeId: number, parentAssetId?: number) {
    const existing = await prisma.asset.findFirst({ where: { projectId: project.id, code } });
    if (existing) {
      return existing;
    }
    return prisma.asset.create({
      data: { projectId: project.id, sectorId: civil.id, assetTypeId, parentAssetId: parentAssetId ?? null, code, name }
    });
  }

  const obra = await upsertAsset("AURORA", "Obra Residencial Aurora", civilObra.id);
  const torre = await upsertAsset("TORRE-A", "Torre A", civilTorre.id, obra.id);
  const pav14 = await upsertAsset("PAV-14", "Pavimento 14", civilPavimento.id, torre.id);
  const apto1403 = await upsertAsset("1403", "Apto 1403", civilUnidade.id, pav14.id);
  const cozinha = await upsertAsset("1403-COZ", "Cozinha", civilLocal.id, apto1403.id);

  // --- Standards -------------------------------------------------------------
  const ps024 = await prisma.standard.upsert({
    where: { sectorId_code: { sectorId: civil.id, code: "PS-024" } },
    update: {},
    create: { sectorId: civil.id, code: "PS-024", title: "Grauteamento de canaletas" }
  });
  const ps031 = await prisma.standard.upsert({
    where: { sectorId_code: { sectorId: civil.id, code: "PS-031" } },
    update: {},
    create: { sectorId: civil.id, code: "PS-031", title: "Impermeabilização de lajes" }
  });

  // --- People + aliases + competencies ---------------------------------------
  const jose = await prisma.person.upsert({
    where: { sectorId_registrationCode: { sectorId: civil.id, registrationCode: "MAT-118" } },
    update: {},
    create: {
      sectorId: civil.id,
      companyId: company.id,
      projectId: project.id,
      name: "José Pereira",
      registrationCode: "MAT-118",
      role: "Pedreiro"
    }
  });

  for (const alias of ["José", "Zé", "J. Pereira"]) {
    await prisma.personAlias.upsert({
      where: { personId_alias: { personId: jose.id, alias } },
      update: {},
      create: { personId: jose.id, alias }
    });
  }

  // Competência apenas para PS-031 — a ausência de PS-024 justifica o alerta
  // PERSON_NOT_TRAINED do cenário de demonstração.
  await prisma.competency.upsert({
    where: { personId_standardId: { personId: jose.id, standardId: ps031.id } },
    update: {},
    create: {
      personId: jose.id,
      standardId: ps031.id,
      status: "TRAINED",
      trainedAt: todayAt("09:00"),
      validUntil: new Date(todayAt("09:00").getTime() + 365 * 24 * 60 * 60 * 1000)
    }
  });

  // --- Machine + checklist + inspection (expired) -----------------------------
  const mx007 = await prisma.machine.upsert({
    where: { sectorId_code: { sectorId: civil.id, code: "MX-007" } },
    update: {},
    create: {
      sectorId: civil.id,
      projectId: project.id,
      code: "MX-007",
      name: "Misturadora de cimento",
      type: "Misturadora"
    }
  });

  let template = await prisma.checklistTemplate.findFirst({
    where: { sectorId: civil.id, name: "Checklist mensal — misturadora" }
  });
  template ??= await prisma.checklistTemplate.create({
    data: { sectorId: civil.id, application: "Misturadora", name: "Checklist mensal — misturadora", validityDays: 30 }
  });

  const itemDescriptions = [
    "Proteções e carenagens íntegras",
    "Cabos e conexões elétricas sem danos",
    "Dispositivo de parada de emergência funcional"
  ];
  const items = [];
  for (const [i, description] of itemDescriptions.entries()) {
    items.push(
      await prisma.checklistItem.upsert({
        where: { templateId_position: { templateId: template.id, position: i + 1 } },
        update: { description },
        create: { templateId: template.id, position: i + 1, description }
      })
    );
  }

  // Vistoria aprovada porém VENCIDA (02/05 + 30 dias) — justifica o alerta
  // MACHINE_INSPECTION_EXPIRED do cenário.
  const inspectedAt = new Date(`${todayISODate().slice(0, 4)}-05-02T10:00:00-03:00`);
  const validUntil = new Date(inspectedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  let inspection = await prisma.machineInspection.findFirst({ where: { machineId: mx007.id } });
  inspection ??= await prisma.machineInspection.create({
    data: {
      machineId: mx007.id,
      templateId: template.id,
      inspectedAt,
      result: "APPROVED",
      validUntil,
      notes: "Vistoria mensal de rotina."
    }
  });
  for (const item of items) {
    await prisma.machineInspectionItem.upsert({
      where: { inspectionId_checklistItemId: { inspectionId: inspection.id, checklistItemId: item.id } },
      update: {},
      create: { inspectionId: inspection.id, checklistItemId: item.id, result: "OK" }
    });
  }

  // --- Bot users --------------------------------------------------------------
  async function upsertUser(phoneE164: string, name: string, role: string) {
    const user = await prisma.user.upsert({
      where: { phoneE164 },
      update: { name, role },
      create: { phoneE164, name, role }
    });
    await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company!.id } },
      update: {},
      create: { userId: user.id, companyId: company!.id }
    });
    return user;
  }

  const marina = await upsertUser("+5511999990001", "Eng. Marina Alves", "Engenheira");
  const paulo = await upsertUser("+5511999990002", "Téc. Paulo Reis", "Técnico");
  await upsertUser("+5511999990000", "Ricardo Tanen", "Gestor de obra");

  // --- Demo diary (recreated for today) ----------------------------------------
  const dayStart = new Date(`${todayISODate()}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  await prisma.entry.deleteMany({
    where: { projectId: project.id, createdAt: { gte: dayStart, lt: dayEnd } }
  });

  async function createEntry(input: {
    userId: number;
    time: string;
    description: string;
    assetId?: number;
  }) {
    const entry = await prisma.entry.create({
      data: {
        userId: input.userId,
        companyId: company!.id,
        projectId: project.id,
        sectorId: civil.id,
        assetId: input.assetId ?? null,
        category: "Inspeção",
        description: input.description,
        createdAt: todayAt(input.time)
      }
    });
    await prisma.entryMedia.create({
      data: { entryId: entry.id, mediaUrl: `demo/${project.code}/${entry.id}.jpg`, mediaType: "image/jpeg" }
    });
    return entry;
  }

  const e1 = await createEntry({
    userId: marina.id,
    time: "09:14",
    description: "Grauteamento da canaleta inferior — cozinha, apto 1403, laje tipo 04, lado esquerdo.",
    assetId: cozinha.id
  });
  const e2 = await createEntry({
    userId: marina.id,
    time: "09:16",
    description: "José está realizando o grauteamento da canaleta inferior."
  });
  const e3 = await createEntry({
    userId: marina.id,
    time: "09:21",
    description: "Impermeabilização da laje técnica."
  });
  const e4 = await createEntry({
    userId: paulo.id,
    time: "10:02",
    description: "Misturadora de cimento em operação no pavimento 14.",
    assetId: pav14.id
  });

  await prisma.entryMention.create({
    data: { entryId: e1.id, entityType: "STANDARD", entityId: ps024.id, source: "CODE", matchedText: "(PS-024)", confirmed: true }
  });
  await prisma.entryMention.create({
    data: { entryId: e2.id, entityType: "STANDARD", entityId: ps024.id, source: "CODE", matchedText: "(PS-024)", confirmed: true }
  });
  const joseMention = await prisma.entryMention.create({
    data: {
      entryId: e2.id,
      entityType: "PERSON",
      entityId: jose.id,
      source: "AI",
      confidence: 0.82,
      matchedText: "José",
      confirmed: false
    }
  });
  await prisma.entryMention.create({
    data: { entryId: e3.id, entityType: "STANDARD", entityId: ps031.id, source: "CODE", matchedText: "(PS-031)", confirmed: true }
  });
  const mxMention = await prisma.entryMention.create({
    data: { entryId: e4.id, entityType: "MACHINE", entityId: mx007.id, source: "CODE", matchedText: "(MX-007)", confirmed: true }
  });

  await prisma.alert.create({
    data: {
      entryId: e2.id,
      mentionId: joseMention.id,
      type: "PERSON_NOT_TRAINED",
      severity: "WARNING",
      title: "José Pereira não treinado",
      detail: "Competência ausente para a norma PS-024.",
      status: "OPEN"
    }
  });
  await prisma.alert.create({
    data: {
      entryId: e4.id,
      mentionId: mxMention.id,
      type: "MACHINE_INSPECTION_EXPIRED",
      severity: "CRITICAL",
      title: "Misturadora MX-007 — vistoria vencida",
      detail: "Última vistoria em 02/05 · validade de 30 dias.",
      status: "OPEN"
    }
  });

  console.log(`Seed concluído para ${todayISODate()} — projeto ${project.name} (${project.code}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
