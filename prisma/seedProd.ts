/**
 * Seed de PRODUÇÃO (enxuto).
 *
 * Popula apenas a configuração base que o sistema precisa para operar:
 *   - Setores (CIVIL, NAVAL)
 *   - Hierarquias de tipo de ativo por setor
 *   - Prefixos de código globais (PS, MX, MAT)
 *   - Uma empresa real: "TataCon"
 *
 * NÃO cria dados de demonstração (pessoas, máquinas, obras, entradas,
 * alertas). Re-executável: tudo via upsert por chave natural, então
 * rodar mais de uma vez não duplica nem apaga nada.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  async function upsertAssetType(
    sectorId: number,
    code: string,
    name: string,
    level: number,
    parentTypeId?: number
  ) {
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
  await upsertAssetType(civil.id, "LOCAL", "Local", 5, civilUnidade.id);

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

  // --- Company (produção) ---------------------------------------------------
  let company = await prisma.company.findFirst({ where: { name: "TataCon" } });
  company ??= await prisma.company.create({ data: { name: "TataCon" } });

  console.log(
    `Seed de produção concluído: setores CIVIL/NAVAL, hierarquias de ativo, ` +
      `prefixos PS/MX/MAT e empresa "${company.name}" (id ${company.id}).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
