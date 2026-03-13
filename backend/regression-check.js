require("dotenv").config({ path: "/home/ubuntu/tulip-saas/backend/.env" });
const prisma = require("/home/ubuntu/tulip-saas/backend/lib/client");

(async () => {
  // 1. Count tables
  const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = $1", "public");
  console.log("Tables:", tables.length);
  console.log("Table names:", tables.map(t => t.tablename).sort().join(", "));

  // 2. TrustSeal columns
  const tsCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", "TrustSeal"
  );
  console.log("\nTrustSeal columns:", tsCols.map(c => c.column_name).join(", "));

  // 3. Document fraud fields
  const docCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4,$5,$6)",
    "Document", "fraudRiskScore", "fraudRiskLevel", "fraudSignals", "duplicateConfidence", "duplicateMethod"
  );
  console.log("Document fraud fields:", docCols.map(c => c.column_name).join(", "));

  // 4. Expense fraud fields
  const expCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4)",
    "Expense", "fraudRiskScore", "fraudRiskLevel", "fraudSignals"
  );
  console.log("Expense fraud fields:", expCols.map(c => c.column_name).join(", "));

  // 5. CaseDocument columns
  const cdCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", "CaseDocument"
  );
  console.log("CaseDocument columns:", cdCols.map(c => c.column_name).join(", "));

  // 6. Check for Al Jassar expense
  const alJassar = await prisma.expense.findMany({
    where: { vendor: { contains: "Jassar", mode: "insensitive" } },
    select: { id: true, vendor: true, fraudRiskScore: true, fraudRiskLevel: true, fraudSignals: true, amount: true, ocrAmount: true }
  });
  console.log("\nAl Jassar expenses:", JSON.stringify(alJassar, null, 2));

  // 7. Sample fraud-scored documents
  const docs = await prisma.document.findMany({
    where: { fraudRiskScore: { gt: 0 } },
    take: 3,
    select: { id: true, name: true, fraudRiskScore: true, fraudRiskLevel: true, duplicateConfidence: true }
  });
  console.log("\nFraud-scored documents:", JSON.stringify(docs, null, 2));

  // 8. Sample fraud-scored expenses
  const exps = await prisma.expense.findMany({
    where: { fraudRiskScore: { gt: 0 } },
    take: 3,
    select: { id: true, title: true, vendor: true, fraudRiskScore: true, fraudRiskLevel: true }
  });
  console.log("\nFraud-scored expenses:", JSON.stringify(exps, null, 2));

  // 9. Check audit log entries
  const auditTypes = await prisma.$queryRawUnsafe(
    "SELECT action, COUNT(*)::int as count FROM \"AuditLog\" WHERE action IN ($1,$2,$3) GROUP BY action",
    "FRAUD_RISK_SCORED", "HYBRID_DUPLICATE_DETECTED", "EXPENSE_MISMATCH_FLAGGED"
  );
  console.log("\nAudit entries:", JSON.stringify(auditTypes));

  // 10. TrustSeal stats
  const sealStats = await prisma.$queryRawUnsafe(
    "SELECT status, COUNT(*)::int as count FROM \"TrustSeal\" GROUP BY status"
  );
  console.log("TrustSeal by status:", JSON.stringify(sealStats));

  // 11. Check for CASE_ANALYSIS / CASE_DOCUMENT seals
  const caseSeals = await prisma.$queryRawUnsafe(
    "SELECT \"documentType\", status, COUNT(*)::int as count FROM \"TrustSeal\" WHERE \"documentType\" IN ($1,$2) GROUP BY \"documentType\", status",
    "CASE_ANALYSIS", "CASE_DOCUMENT"
  );
  console.log("Case seals:", JSON.stringify(caseSeals));

  // 12. Check if unifiedSealEngine exists
  const fs = require("fs");
  const ePath = "/home/ubuntu/tulip-saas/backend/lib/unifiedSealEngine.js";
  console.log("\nunifiedSealEngine.js exists:", fs.existsSync(ePath));

  // 13. Check sourceType column on TrustSeal
  const srcCol = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", "TrustSeal", "sourceType"
  );
  console.log("TrustSeal has sourceType:", srcCol.length > 0);

  // 14. Check sealId on CaseDocument
  const sealIdCol = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", "CaseDocument", "sealId"
  );
  console.log("CaseDocument has sealId:", sealIdCol.length > 0);

  await prisma.$disconnect();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
