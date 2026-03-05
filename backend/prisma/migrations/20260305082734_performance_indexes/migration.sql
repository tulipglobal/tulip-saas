-- DropIndex
DROP INDEX "Role_name_key";

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");

-- CreateIndex
CREATE INDEX "Expense_fundingSourceId_idx" ON "Expense"("fundingSourceId");

-- CreateIndex
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- CreateIndex
CREATE INDEX "FundingSource_projectId_idx" ON "FundingSource"("projectId");

-- CreateIndex
CREATE INDEX "FundingSource_fundingType_idx" ON "FundingSource"("fundingType");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");
