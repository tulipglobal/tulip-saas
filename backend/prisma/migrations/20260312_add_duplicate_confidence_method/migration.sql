-- Add hybrid duplicate detection fields to Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "duplicateConfidence" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "duplicateMethod" TEXT;
