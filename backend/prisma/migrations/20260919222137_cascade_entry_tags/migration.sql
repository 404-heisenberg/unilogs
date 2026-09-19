-- DropForeignKey
ALTER TABLE "entry_tags" DROP CONSTRAINT "entry_tags_tagId_fkey";

-- AddForeignKey
ALTER TABLE "entry_tags" ADD CONSTRAINT "entry_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
