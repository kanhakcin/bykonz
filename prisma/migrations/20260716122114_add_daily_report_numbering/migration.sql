-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "diary_next_sequence" INTEGER;

-- CreateTable
CREATE TABLE "daily_report_numbers" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "report_date" DATE NOT NULL,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_report_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_numbers_project_id_report_date_key" ON "daily_report_numbers"("project_id", "report_date");

-- AddForeignKey
ALTER TABLE "daily_report_numbers" ADD CONSTRAINT "daily_report_numbers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
