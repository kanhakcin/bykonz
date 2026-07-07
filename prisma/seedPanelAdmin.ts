/**
 * Cria (ou promove) o primeiro usuário admin do painel do gestor.
 * Idempotente: se o email já existir, apenas garante role ADMIN e reseta a senha.
 *
 * Uso: PANEL_ADMIN_EMAIL=... PANEL_ADMIN_PASSWORD=... PANEL_ADMIN_NAME=... npm run seed:panel-admin
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PANEL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PANEL_ADMIN_PASSWORD;
  const name = process.env.PANEL_ADMIN_NAME?.trim() || "Administrador";

  if (!email || !password) {
    throw new Error("PANEL_ADMIN_EMAIL and PANEL_ADMIN_PASSWORD environment variables are required");
  }
  if (password.length < 8) {
    throw new Error("PANEL_ADMIN_PASSWORD must be at least 8 characters long");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.panelUser.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", active: true },
    create: { email, name, passwordHash, role: "ADMIN", active: true }
  });

  console.log(`Panel admin ready: ${user.email} (id ${user.id}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
