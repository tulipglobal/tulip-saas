-- Add caseSealId and caseSealIssuedAt to Case table (tulip-verify)
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "caseSealId" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "caseSealIssuedAt" TIMESTAMP;
