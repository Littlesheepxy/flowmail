-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'SIGNUP', 'OTP_REQUEST', 'OTP_VERIFY', 'PASSWORD_RESET', 'EMAIL_CONNECTION_CREATE', 'EMAIL_CONNECTION_DELETE', 'EMAIL_SYNC', 'EMAIL_SEND', 'ENTITY_STATUS_CHANGE', 'ENTITY_APPROVE', 'ENTITY_REJECT', 'API_TOKEN_CREATE', 'API_TOKEN_REVOKE', 'MEMBER_INVITE', 'MEMBER_REMOVE', 'ORGANIZATION_CREATE', 'ORGANIZATION_DELETE', 'SETTINGS_CHANGE', 'DATA_EXPORT');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_organizationId_createdAt_idx" ON "audit_log"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_userId_createdAt_idx" ON "audit_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");
