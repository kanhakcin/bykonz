-- AddAttendanceType
CREATE TYPE "AttendanceType" AS ENUM ('SITE_SURVEY', 'INSTALLATION', 'MAINTENANCE', 'DIAGNOSIS', 'COMMISSIONING', 'TECHNICAL_SUPPORT');

-- AddPendingStatus
CREATE TYPE "PendingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterTable
ALTER TABLE "technical_mobilizations" ADD COLUMN     "vessel_id" INTEGER,
ADD COLUMN     "attendance_type" "AttendanceType",
ADD COLUMN     "ai_memory_summary" TEXT;

-- AlterTable
ALTER TABLE "technical_evidences" ADD COLUMN     "ai_description" TEXT,
ADD COLUMN     "ai_confidence" DOUBLE PRECISION,
ADD COLUMN     "ai_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "equipment_identified" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "serial_number" TEXT,
ADD COLUMN     "ocr_text" TEXT,
ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "document_url" TEXT,
ADD COLUMN     "video_url" TEXT;

-- AlterTable
ALTER TABLE "technical_pending_issues" ADD COLUMN     "suggested_by_ai" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "technical_pending_issues" ALTER COLUMN "status" SET DATA TYPE "PendingStatus" USING "status"::"PendingStatus";

-- AlterTable
ALTER TABLE "technical_reports" ADD COLUMN     "share_token" TEXT,
ADD COLUMN     "share_expires_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "technical_inventory" (
    "id" SERIAL NOT NULL,
    "mobilization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_memories" (
    "id" SERIAL NOT NULL,
    "vessel_id" INTEGER NOT NULL,
    "report_id" INTEGER,
    "content_type" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_signatures" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signature_data" TEXT,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technical_reports_share_token_key" ON "technical_reports"("share_token");

-- CreateIndex
CREATE INDEX "technical_mobilizations_vessel_id_idx" ON "technical_mobilizations"("vessel_id");

-- CreateIndex
CREATE INDEX "technical_evidences_mobilization_id_category_idx" ON "technical_evidences"("mobilization_id", "category");

-- CreateIndex
CREATE INDEX "technical_pending_issues_mobilization_id_status_idx" ON "technical_pending_issues"("mobilization_id", "status");

-- CreateIndex
CREATE INDEX "technical_memories_vessel_id_created_at_idx" ON "technical_memories"("vessel_id", "created_at");

-- CreateIndex
CREATE INDEX "technical_signatures_report_id_idx" ON "technical_signatures"("report_id");

-- AddForeignKey
ALTER TABLE "technical_mobilizations" ADD CONSTRAINT "technical_mobilizations_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_inventory" ADD CONSTRAINT "technical_inventory_mobilization_id_fkey" FOREIGN KEY ("mobilization_id") REFERENCES "technical_mobilizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_memories" ADD CONSTRAINT "technical_memories_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_memories" ADD CONSTRAINT "technical_memories_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "technical_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_signatures" ADD CONSTRAINT "technical_signatures_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "technical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
