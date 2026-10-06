-- AlterTable
ALTER TABLE "entries" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "entries_clientId_key" ON "entries"("clientId");