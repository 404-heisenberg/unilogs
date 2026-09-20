-- CreateIndex
CREATE INDEX "entries_date_idx" ON "entries"("date");

-- CreateIndex
CREATE INDEX "entries_projectId_idx" ON "entries"("projectId");

-- CreateIndex
CREATE INDEX "entry_tags_tagId_idx" ON "entry_tags"("tagId");

-- CreateIndex
CREATE INDEX "field_definitions_projectId_idx" ON "field_definitions"("projectId");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");
