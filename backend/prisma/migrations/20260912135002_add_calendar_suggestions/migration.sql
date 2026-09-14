-- CreateTable
CREATE TABLE "calendar_suggestions" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_suggestions_userId_eventId_key" ON "calendar_suggestions"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "calendar_suggestions" ADD CONSTRAINT "calendar_suggestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
