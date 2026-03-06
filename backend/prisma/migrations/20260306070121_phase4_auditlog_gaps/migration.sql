-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ancheredAt" TIMESTAMP(3),
ADD COLUMN     "anchorStatus" TEXT,
ADD COLUMN     "blockHash" TEXT,
ADD COLUMN     "blockNumber" INTEGER,
ADD COLUMN     "prevHash" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_batchId_idx" ON "AuditLog"("batchId");

-- CreateIndex
CREATE INDEX "AuditLog_anchorStatus_idx" ON "AuditLog"("anchorStatus");
