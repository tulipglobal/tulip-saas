-- Add page-level hashing and issuance tracking fields to TrustSeal
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "pageHashes" JSONB;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "issuerReference" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "apiKeyId" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "anchorRetryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "anchorLastRetryAt" TIMESTAMP(3);
