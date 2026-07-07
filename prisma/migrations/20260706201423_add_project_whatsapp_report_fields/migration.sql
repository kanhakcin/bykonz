-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "whatsapp_auto_report_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_group_id" TEXT;
