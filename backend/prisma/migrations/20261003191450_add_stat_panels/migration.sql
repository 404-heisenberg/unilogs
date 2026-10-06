-- AlterTable
ALTER TABLE "user" ADD COLUMN     "dashboardLayout" JSONB;

-- CreateTable
CREATE TABLE "stat_panels" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "aggregation" TEXT NOT NULL DEFAULT 'sum',
    "rangeDays" INTEGER NOT NULL DEFAULT 30,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stat_panels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stat_panels_userId_idx" ON "stat_panels"("userId");

-- CreateIndex
CREATE INDEX "stat_panels_projectId_idx" ON "stat_panels"("projectId");

-- AddForeignKey
ALTER TABLE "stat_panels" ADD CONSTRAINT "stat_panels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_panels" ADD CONSTRAINT "stat_panels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
