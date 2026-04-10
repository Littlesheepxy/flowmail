-- Add storageKey column to email_attachment for S3 file storage
ALTER TABLE "email_attachment" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
