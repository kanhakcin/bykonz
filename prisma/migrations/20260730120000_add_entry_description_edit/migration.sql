-- AlterTable
ALTER TABLE "entries" ADD COLUMN     "edited_at" TIMESTAMPTZ(6),
ADD COLUMN     "edited_by_panel_user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_edited_by_panel_user_id_fkey" FOREIGN KEY ("edited_by_panel_user_id") REFERENCES "panel_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
