/*
  Warnings:

  - A unique constraint covering the columns `[userId,calendarId,eventId]` on the table `calendar_suggestions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `calendarId` to the `calendar_suggestions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "calendar_suggestions_userId_eventId_key";

-- AlterTable
ALTER TABLE "calendar_suggestions" ADD COLUMN     "calendarId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "calendar_sources" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "color" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calendar_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_sources_userId_order_idx" ON "calendar_sources"("userId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_sources_userId_calendarId_key" ON "calendar_sources"("userId", "calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_suggestions_userId_calendarId_eventId_key" ON "calendar_suggestions"("userId", "calendarId", "eventId");

-- AddForeignKey
ALTER TABLE "calendar_sources" ADD CONSTRAINT "calendar_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
