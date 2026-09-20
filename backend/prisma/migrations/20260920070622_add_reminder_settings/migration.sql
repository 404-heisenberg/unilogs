-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('DAILY', 'WEEKLY', 'OFF');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "reminderFrequency" "ReminderFrequency" NOT NULL DEFAULT 'WEEKLY';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;
