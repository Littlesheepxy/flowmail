/*
  Warnings:

  - You are about to drop the `integration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `skill` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `skill_test_run` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task_event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_context` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('APPROVAL', 'REPORT', 'ISSUE', 'FEEDBACK');

-- DropForeignKey
ALTER TABLE "integration" DROP CONSTRAINT "integration_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "skill" DROP CONSTRAINT "skill_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "skill_test_run" DROP CONSTRAINT "skill_test_run_skillId_fkey";

-- DropForeignKey
ALTER TABLE "skill_test_run" DROP CONSTRAINT "skill_test_run_taskId_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_createdById_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_skillId_fkey";

-- DropForeignKey
ALTER TABLE "task_event" DROP CONSTRAINT "task_event_taskId_fkey";

-- DropForeignKey
ALTER TABLE "user_context" DROP CONSTRAINT "user_context_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "user_context" DROP CONSTRAINT "user_context_userId_fkey";

-- DropTable
DROP TABLE "integration";

-- DropTable
DROP TABLE "skill";

-- DropTable
DROP TABLE "skill_test_run";

-- DropTable
DROP TABLE "task";

-- DropTable
DROP TABLE "task_event";

-- DropTable
DROP TABLE "user_context";

-- CreateTable
CREATE TABLE "email_connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'oauth2',
    "email" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "imapPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_thread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalThreadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "participants" TEXT NOT NULL,
    "snippet" TEXT,
    "rawPayload" TEXT,
    "entityId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_entity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "extractedFields" TEXT NOT NULL DEFAULT '{}',
    "aiSummary" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_event" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_connection_organizationId_idx" ON "email_connection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "email_connection_organizationId_email_key" ON "email_connection"("organizationId", "email");

-- CreateIndex
CREATE INDEX "email_thread_organizationId_idx" ON "email_thread"("organizationId");

-- CreateIndex
CREATE INDEX "email_thread_entityId_idx" ON "email_thread"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "email_thread_connectionId_externalThreadId_key" ON "email_thread"("connectionId", "externalThreadId");

-- CreateIndex
CREATE INDEX "flow_entity_organizationId_type_idx" ON "flow_entity"("organizationId", "type");

-- CreateIndex
CREATE INDEX "flow_entity_organizationId_status_idx" ON "flow_entity"("organizationId", "status");

-- CreateIndex
CREATE INDEX "flow_entity_assigneeId_idx" ON "flow_entity"("assigneeId");

-- CreateIndex
CREATE INDEX "timeline_event_entityId_idx" ON "timeline_event"("entityId");

-- AddForeignKey
ALTER TABLE "email_connection" ADD CONSTRAINT "email_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "email_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "flow_entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_entity" ADD CONSTRAINT "flow_entity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_entity" ADD CONSTRAINT "flow_entity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_event" ADD CONSTRAINT "timeline_event_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "flow_entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_event" ADD CONSTRAINT "timeline_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
