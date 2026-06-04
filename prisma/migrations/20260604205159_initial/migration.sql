-- CreateEnum
CREATE TYPE "ConversationStep" AS ENUM ('MAIN_MENU', 'ACTION_MENU', 'SELECT_EMPRESA', 'AWAITING_PHOTO', 'AWAITING_DESCRIPTION', 'AWAITING_INSPECT_DATE');

-- CreateTable
CREATE TABLE "Usuarios" (
    "id" SMALLSERIAL NOT NULL,
    "PhoneE164" BIGINT NOT NULL,
    "Nome" TEXT,
    "Cargo" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" BIGSERIAL NOT NULL,
    "nome" TEXT,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserEmpresa" (
    "User_ID" SMALLINT NOT NULL,
    "Empresa_ID" BIGINT NOT NULL,

    CONSTRAINT "_UserEmpresa_pkey" PRIMARY KEY ("User_ID","Empresa_ID")
);

-- CreateTable
CREATE TABLE "Entrada" (
    "id" BIGSERIAL NOT NULL,
    "User_id" SMALLINT NOT NULL,
    "empresa_id" BIGINT,
    "Description" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "Tipo" TEXT,

    CONSTRAINT "Entrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EntradaMedia" (
    "id" BIGSERIAL NOT NULL,
    "MediaUrl" TEXT NOT NULL,
    "Entrada_id" BIGINT NOT NULL,

    CONSTRAINT "_EntradaMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappConversationState" (
    "id" BIGSERIAL NOT NULL,
    "ChatId" TEXT NOT NULL,
    "PhoneE164" TEXT NOT NULL,
    "Step" "ConversationStep" NOT NULL,
    "SelectedTipo" TEXT,
    "SelectedEmpresaId" BIGINT,
    "PendingEntradaId" BIGINT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WhatsappConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_PhoneE164_key" ON "Usuarios"("PhoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConversationState_ChatId_key" ON "WhatsappConversationState"("ChatId");

-- AddForeignKey
ALTER TABLE "_UserEmpresa" ADD CONSTRAINT "_UserEmpresa_User_ID_fkey" FOREIGN KEY ("User_ID") REFERENCES "Usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserEmpresa" ADD CONSTRAINT "_UserEmpresa_Empresa_ID_fkey" FOREIGN KEY ("Empresa_ID") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrada" ADD CONSTRAINT "Entrada_User_id_fkey" FOREIGN KEY ("User_id") REFERENCES "Usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrada" ADD CONSTRAINT "Entrada_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EntradaMedia" ADD CONSTRAINT "_EntradaMedia_Entrada_id_fkey" FOREIGN KEY ("Entrada_id") REFERENCES "Entrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
