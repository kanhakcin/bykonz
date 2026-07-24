-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "email_auto_report_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "report_email_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[];
