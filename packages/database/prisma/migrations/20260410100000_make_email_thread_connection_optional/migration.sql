-- Make connectionId optional in email_thread to support inbound emails without OAuth connection
ALTER TABLE "email_thread" DROP CONSTRAINT IF EXISTS "email_thread_connectionId_fkey";
ALTER TABLE "email_thread" ALTER COLUMN "connectionId" DROP NOT NULL;
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_connectionId_fkey" 
  FOREIGN KEY ("connectionId") REFERENCES "email_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Add index on externalThreadId for faster lookups
CREATE INDEX IF NOT EXISTS "email_thread_externalThreadId_idx" ON "email_thread"("externalThreadId");
