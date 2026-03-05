-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_idx" ON "Expense"("tenantId");

-- CreateIndex
CREATE INDEX "FundingSource_tenantId_idx" ON "FundingSource"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
