-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INBOUND_EMAIL_RECEIVED';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "inboundEmailAddress" TEXT,
ADD COLUMN     "inboundEmailShortId" TEXT;

-- CreateTable
CREATE TABLE "inbound_email" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "rawHeaders" TEXT,
    "rawPayload" JSONB,
    "contentHash" TEXT,
    "entityId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_email_contentHash_key" ON "inbound_email"("contentHash");

-- CreateIndex
CREATE INDEX "inbound_email_organizationId_idx" ON "inbound_email"("organizationId");

-- CreateIndex
CREATE INDEX "inbound_email_fromEmail_idx" ON "inbound_email"("fromEmail");

-- CreateIndex
CREATE INDEX "inbound_email_entityId_idx" ON "inbound_email"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_inboundEmailAddress_key" ON "organization"("inboundEmailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "organization_inboundEmailShortId_key" ON "organization"("inboundEmailShortId");

-- AddForeignKey
ALTER TABLE "inbound_email" ADD CONSTRAINT "inbound_email_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_email" ADD CONSTRAINT "inbound_email_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "flow_entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
