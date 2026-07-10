-- CreateTable
CREATE TABLE "asset_inspections" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "inspected_at" TIMESTAMPTZ(6) NOT NULL,
    "inspector_person_id" INTEGER,
    "result" "InspectionResult" NOT NULL,
    "valid_until" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "asset_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_inspection_items" (
    "id" SERIAL NOT NULL,
    "inspection_id" INTEGER NOT NULL,
    "checklist_item_id" INTEGER NOT NULL,
    "result" "ItemResult" NOT NULL,
    "note" TEXT,

    CONSTRAINT "asset_inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_inspections_asset_id_inspected_at_idx" ON "asset_inspections"("asset_id", "inspected_at");

-- CreateIndex
CREATE UNIQUE INDEX "asset_inspection_items_inspection_id_checklist_item_id_key" ON "asset_inspection_items"("inspection_id", "checklist_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_sector_id_code_key" ON "assets"("sector_id", "code");

-- AddForeignKey
ALTER TABLE "asset_inspections" ADD CONSTRAINT "asset_inspections_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_inspections" ADD CONSTRAINT "asset_inspections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_inspections" ADD CONSTRAINT "asset_inspections_inspector_person_id_fkey" FOREIGN KEY ("inspector_person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_inspection_items" ADD CONSTRAINT "asset_inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "asset_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_inspection_items" ADD CONSTRAINT "asset_inspection_items_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

