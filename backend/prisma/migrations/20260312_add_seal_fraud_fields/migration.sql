-- Add fraud risk fields + sourceType to TrustSeal
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "fraudRiskScore" INTEGER;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "fraudRiskLevel" TEXT;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "fraudSignals" JSONB;
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;

-- Add sealId to CaseDocument (for per-document seal tracking)
ALTER TABLE "CaseDocument" ADD COLUMN IF NOT EXISTS "sealId" TEXT;
