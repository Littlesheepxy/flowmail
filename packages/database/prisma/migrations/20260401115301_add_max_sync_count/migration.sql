-- AlterTable
ALTER TABLE "email_connection" ADD COLUMN     "maxSyncCount" INTEGER NOT NULL DEFAULT 500;
