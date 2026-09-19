-- Delete all old tag associations (entry_tags rows)
DELETE FROM "entry_tags";

-- Delete all old global tags (they had no owner)
DELETE FROM "tags";

-- Add userId column (table is empty, so NOT NULL is fine)
ALTER TABLE "tags" ADD COLUMN "userId" TEXT NOT NULL;

-- Add foreign key to user with cascade delete
ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint (per-user tag names)
CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags"("userId", "name");