-- Backlog #10: Add OCR, mismatch, duplicate detection, and entity reference fields to TrustSeal

-- OCR fields
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ocrRawText" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ocrAmount" DOUBLE PRECISION;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ocrVendor" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ocrDate" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ocrConfidence" DOUBLE PRECISION;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ocrEngine" TEXT;

-- Mismatch fields
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "amountMismatch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "vendorMismatch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "dateMismatch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "mismatchNote" TEXT;

-- Duplicate detection fields
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "duplicateOfId" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "duplicateOfName" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "crossTenantDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "duplicateConfidence" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "duplicateMethod" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "isVisualDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "pHash" TEXT;

-- Entity reference fields
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "expenseId" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "caseId" TEXT;

-- Indexes for entity references
CREATE INDEX IF NOT EXISTS "TrustSeal_expenseId_idx" ON "TrustSeal"("expenseId");
CREATE INDEX IF NOT EXISTS "TrustSeal_documentId_idx" ON "TrustSeal"("documentId");
CREATE INDEX IF NOT EXISTS "TrustSeal_caseId_idx" ON "TrustSeal"("caseId");
