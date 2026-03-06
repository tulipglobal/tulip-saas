/*
  Warnings:

  - You are about to drop the column `blockchainHash` on the `AuditLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "blockchainHash",
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "dataHash" TEXT;
