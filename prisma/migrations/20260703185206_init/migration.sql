-- CreateEnum
CREATE TYPE "ConversationStep" AS ENUM ('MAIN_MENU', 'ACTION_MENU', 'SELECT_EMPRESA', 'AWAITING_PHOTO', 'AWAITING_DESCRIPTION', 'AWAITING_INSPECT_DATE', 'SELECT_EMPRESA_FOR_REPORT', 'AWAITING_REPORT_DATE', 'AWAITING_SERVICE_TYPE', 'AWAITING_PROCEDURE_NUMBER', 'SELECT_EMPRESA_FOR_TRAINING', 'AWAITING_TRAINING_TEMA', 'AWAITING_TRAINING_PARTICIPANTS', 'AWAITING_TRAINING_DATES', 'AWAITING_TRAINING_PHOTO', 'AWAITING_TRAINING_FILE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('STANDARD', 'PERSON', 'MACHINE', 'ASSET');

-- CreateEnum
CREATE TYPE "MentionSource" AS ENUM ('CODE', 'AI', 'MANUAL', 'QR');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PERSON_NOT_TRAINED', 'MACHINE_NO_INSPECTION', 'MACHINE_INSPECTION_EXPIRED', 'STANDARD_NOT_FOUND');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CompetencyStatus" AS ENUM ('TRAINED', 'PENDING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ItemResult" AS ENUM ('OK', 'NOK', 'NA');

-- CreateTable
CREATE TABLE "sectors" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_types" (
    "id" SERIAL NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parent_type_id" INTEGER,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_prefixes" (
    "id" SERIAL NOT NULL,
    "sector_id" INTEGER,
    "prefix" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,

    CONSTRAINT "code_prefixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "attributes" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "asset_type_id" INTEGER NOT NULL,
    "parent_asset_id" INTEGER,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB,
    "qrcode_token" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standards" (
    "id" SERIAL NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "attributes" JSONB,

    CONSTRAINT "standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" SERIAL NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "company_id" BIGINT,
    "project_id" INTEGER,
    "name" TEXT NOT NULL,
    "registration_code" TEXT,
    "role" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_aliases" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "person_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "standard_id" INTEGER NOT NULL,
    "status" "CompetencyStatus" NOT NULL,
    "trained_at" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "certificate_url" TEXT,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" SERIAL NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "project_id" INTEGER,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "attributes" JSONB,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" SERIAL NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "application" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validity_days" INTEGER,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_inspections" (
    "id" SERIAL NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "inspected_at" TIMESTAMPTZ(6) NOT NULL,
    "inspector_person_id" INTEGER,
    "result" "InspectionResult" NOT NULL,
    "valid_until" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "machine_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_inspection_items" (
    "id" SERIAL NOT NULL,
    "inspection_id" INTEGER NOT NULL,
    "checklist_item_id" INTEGER NOT NULL,
    "result" "ItemResult" NOT NULL,
    "note" TEXT,

    CONSTRAINT "machine_inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_companies" (
    "user_id" INTEGER NOT NULL,
    "company_id" BIGINT NOT NULL,

    CONSTRAINT "user_companies_pkey" PRIMARY KEY ("user_id","company_id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "company_id" BIGINT,
    "project_id" INTEGER,
    "sector_id" INTEGER,
    "asset_id" INTEGER,
    "category" TEXT,
    "description" TEXT,
    "service_type" TEXT,
    "procedure_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_media" (
    "id" BIGSERIAL NOT NULL,
    "entry_id" BIGINT NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" TEXT,

    CONSTRAINT "entry_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" SERIAL NOT NULL,
    "entry_id" BIGINT NOT NULL,
    "topic" TEXT NOT NULL,
    "participants" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_mentions" (
    "id" SERIAL NOT NULL,
    "entry_id" BIGINT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" INTEGER,
    "source" "MentionSource" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "matched_text" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "entry_id" BIGINT NOT NULL,
    "mention_id" INTEGER,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversation_states" (
    "id" BIGSERIAL NOT NULL,
    "chat_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "step" "ConversationStep" NOT NULL,
    "flow_key" TEXT,
    "step_key" TEXT,
    "flow_data" JSONB,
    "selected_category" TEXT,
    "selected_company_id" BIGINT,
    "selected_service_type" TEXT,
    "selected_procedure_number" TEXT,
    "selected_training_topic" TEXT,
    "selected_training_participants" TEXT,
    "selected_training_starts_at" TIMESTAMPTZ(6),
    "selected_training_ends_at" TIMESTAMPTZ(6),
    "selected_training_photo_count" INTEGER,
    "pending_entry_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whatsapp_conversation_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sectors_code_key" ON "sectors"("code");

-- CreateIndex
CREATE INDEX "asset_types_sector_id_idx" ON "asset_types"("sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_sector_id_code_key" ON "asset_types"("sector_id", "code");

-- CreateIndex
CREATE INDEX "code_prefixes_prefix_idx" ON "code_prefixes"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "code_prefixes_sector_id_prefix_key" ON "code_prefixes"("sector_id", "prefix");

-- CreateIndex
CREATE INDEX "projects_sector_id_idx" ON "projects"("sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_company_id_code_key" ON "projects"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "assets_qrcode_token_key" ON "assets"("qrcode_token");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE INDEX "assets_parent_asset_id_idx" ON "assets"("parent_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "standards_sector_id_code_key" ON "standards"("sector_id", "code");

-- CreateIndex
CREATE INDEX "people_project_id_idx" ON "people"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_sector_id_registration_code_key" ON "people"("sector_id", "registration_code");

-- CreateIndex
CREATE INDEX "person_aliases_alias_idx" ON "person_aliases"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "person_aliases_person_id_alias_key" ON "person_aliases"("person_id", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_person_id_standard_id_key" ON "competencies"("person_id", "standard_id");

-- CreateIndex
CREATE UNIQUE INDEX "machines_sector_id_code_key" ON "machines"("sector_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_items_template_id_position_key" ON "checklist_items"("template_id", "position");

-- CreateIndex
CREATE INDEX "machine_inspections_machine_id_inspected_at_idx" ON "machine_inspections"("machine_id", "inspected_at");

-- CreateIndex
CREATE UNIQUE INDEX "machine_inspection_items_inspection_id_checklist_item_id_key" ON "machine_inspection_items"("inspection_id", "checklist_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- CreateIndex
CREATE INDEX "entries_company_id_category_created_at_idx" ON "entries"("company_id", "category", "created_at");

-- CreateIndex
CREATE INDEX "entries_project_id_created_at_idx" ON "entries"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "entry_media_entry_id_idx" ON "entry_media"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "trainings_entry_id_key" ON "trainings"("entry_id");

-- CreateIndex
CREATE INDEX "entry_mentions_entry_id_idx" ON "entry_mentions"("entry_id");

-- CreateIndex
CREATE INDEX "entry_mentions_entity_type_entity_id_idx" ON "entry_mentions"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "entry_mentions_source_confirmed_idx" ON "entry_mentions"("source", "confirmed");

-- CreateIndex
CREATE INDEX "alerts_status_created_at_idx" ON "alerts"("status", "created_at");

-- CreateIndex
CREATE INDEX "alerts_entry_id_idx" ON "alerts"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversation_states_chat_id_key" ON "whatsapp_conversation_states"("chat_id");

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_parent_type_id_fkey" FOREIGN KEY ("parent_type_id") REFERENCES "asset_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_prefixes" ADD CONSTRAINT "code_prefixes_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards" ADD CONSTRAINT "standards_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_aliases" ADD CONSTRAINT "person_aliases_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_inspections" ADD CONSTRAINT "machine_inspections_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_inspections" ADD CONSTRAINT "machine_inspections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_inspections" ADD CONSTRAINT "machine_inspections_inspector_person_id_fkey" FOREIGN KEY ("inspector_person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_inspection_items" ADD CONSTRAINT "machine_inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "machine_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_inspection_items" ADD CONSTRAINT "machine_inspection_items_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_media" ADD CONSTRAINT "entry_media_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_mentions" ADD CONSTRAINT "entry_mentions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_mention_id_fkey" FOREIGN KEY ("mention_id") REFERENCES "entry_mentions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
