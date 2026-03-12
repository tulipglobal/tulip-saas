-- Add ocrFingerprint to TrustSeal for receipt duplicate detection
ALTER TABLE "TrustSeal" ADD COLUMN IF NOT EXISTS "ocrFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "TrustSeal_ocrFingerprint_idx" ON "TrustSeal"("ocrFingerprint");
