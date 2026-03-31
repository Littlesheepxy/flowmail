-- AlterTable
ALTER TABLE "email_thread" ADD COLUMN     "ccRecipients" TEXT,
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "toRecipients" TEXT;

-- CreateTable
CREATE TABLE "email_attachment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "externalId" TEXT NOT NULL,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_attachment_threadId_idx" ON "email_attachment"("threadId");

-- AddForeignKey
ALTER TABLE "email_attachment" ADD CONSTRAINT "email_attachment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
