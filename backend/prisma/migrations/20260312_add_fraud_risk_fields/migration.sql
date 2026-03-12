-- Add fraud risk scoring fields to Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fraudRiskScore" INTEGER;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fraudRiskLevel" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fraudSignals" JSONB;

-- Add fraud risk scoring fields to Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fraudRiskScore" INTEGER;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fraudRiskLevel" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fraudSignals" JSONB;
