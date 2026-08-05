-- CreateTable
CREATE TABLE "technical_mobilizations" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "report_code" TEXT NOT NULL,
    "client_name" TEXT,
    "vessel_name" TEXT,
    "service_type" TEXT,
    "site_location" TEXT,
    "mobilization_date" TIMESTAMP(3),
    "technician_name" TEXT,
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "technical_mobilizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_evidences" (
    "id" SERIAL NOT NULL,
    "mobilization_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "observation" TEXT,
    "attachment_type" TEXT,
    "attachment_mime" TEXT,
    "attachment_data" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_pending_issues" (
    "id" SERIAL NOT NULL,
    "mobilization_id" INTEGER NOT NULL,
    "system" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsible" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_pending_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_equipment" (
    "id" SERIAL NOT NULL,
    "mobilization_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_reports" (
    "id" SERIAL NOT NULL,
    "mobilization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "report_code" TEXT NOT NULL,
    "summary" TEXT,
    "conclusion" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "technical_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technical_mobilizations_report_code_key" ON "technical_mobilizations"("report_code");

-- AddForeignKey
ALTER TABLE "technical_mobilizations" ADD CONSTRAINT "technical_mobilizations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_evidences" ADD CONSTRAINT "technical_evidences_mobilization_id_fkey" FOREIGN KEY ("mobilization_id") REFERENCES "technical_mobilizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_pending_issues" ADD CONSTRAINT "technical_pending_issues_mobilization_id_fkey" FOREIGN KEY ("mobilization_id") REFERENCES "technical_mobilizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_equipment" ADD CONSTRAINT "technical_equipment_mobilization_id_fkey" FOREIGN KEY ("mobilization_id") REFERENCES "technical_mobilizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_reports" ADD CONSTRAINT "technical_reports_mobilization_id_fkey" FOREIGN KEY ("mobilization_id") REFERENCES "technical_mobilizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
