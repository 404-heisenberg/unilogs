-- CreateTable
CREATE TABLE "share_tokens" (
    "token" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "includeBodies" BOOLEAN NOT NULL DEFAULT false,
    "defaultRangeDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "share_tokens_projectId_idx" ON "share_tokens"("projectId");

-- AddForeignKey
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
