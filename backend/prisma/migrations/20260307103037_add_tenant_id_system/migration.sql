/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sequence` to the `Tenant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "sequence" INTEGER NOT NULL,
ADD COLUMN     "tenantType" TEXT NOT NULL DEFAULT 'NGO';

-- CreateTable
CREATE TABLE "TenantCounter" (
    "id" TEXT NOT NULL,
    "tenantType" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TenantCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantCounter_tenantType_year_key" ON "TenantCounter"("tenantType", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE INDEX "Tenant_code_idx" ON "Tenant"("code");

-- CreateIndex
CREATE INDEX "Tenant_tenantType_idx" ON "Tenant"("tenantType");
