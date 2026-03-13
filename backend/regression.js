require("dotenv").config();
const prisma = require("./lib/client");
const fs = require("fs");
const http = require("http");
const https = require("https");

function httpReq(method, path, body, headers) {
  return new Promise(r => {
    const opts = { hostname: "localhost", port: 5050, path, method, headers: { "Content-Type": "application/json", ...(headers||{}) } };
    const req = http.request(opts, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => r({ status: res.statusCode, body: d }));
    });
    req.on("error", e => r({ status: 0, body: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function localGet(port, path) {
  return new Promise(r => {
    http.get({ hostname: "localhost", port, path }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => r({ status: res.statusCode, body: d }));
    }).on("error", () => r({ status: 0, body: "" }));
  });
}

function extGet(url) {
  return new Promise(r => {
    https.get(url, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => r({ status: res.statusCode, body: d }));
    }).on("error", () => r({ status: 0, body: "" }));
  });
}

let pass = 0, fail = 0, skip = 0;
function log(n, label, result, detail) {
  const tag = result === "PASS" ? "PASS" : result === "FAIL" ? "FAIL" : "SKIP";
  if (tag === "PASS") pass++;
  else if (tag === "FAIL") fail++;
  else skip++;
  const d = detail ? " — " + detail : "";
  console.log(`[${String(n).padStart(2)}] ${tag.padEnd(6)} ${label}${d}`);
}

(async () => {
  console.log("=== REGRESSION CHECKLIST (35 items) ===\n");
  console.log("─── DATABASE & SCHEMA ───");

  // 1
  const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = $1", "public");
  log(1, "Database tables >= 35", tables.length >= 35 ? "PASS" : "FAIL", tables.length + " tables");

  // 2
  const tsCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4,$5)",
    "TrustSeal", "fraudRiskScore", "fraudRiskLevel", "fraudSignals", "sourceType"
  );
  log(2, "TrustSeal fraud+sourceType columns", tsCols.length === 4 ? "PASS" : "FAIL", tsCols.map(c=>c.column_name).join(","));

  // 3
  const voidCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4,$5)",
    "Expense", "voided", "voidedAt", "voidedReason", "voidedBy"
  );
  log(3, "Expense void columns", voidCols.length === 4 ? "PASS" : "FAIL", voidCols.map(c=>c.column_name).join(","));

  // 4
  const expFraud = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4)",
    "Expense", "fraudRiskScore", "fraudRiskLevel", "fraudSignals"
  );
  log(4, "Expense fraud columns", expFraud.length === 3 ? "PASS" : "FAIL", expFraud.map(c=>c.column_name).join(","));

  // 5
  const docFraud = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4,$5)",
    "Document", "fraudRiskScore", "fraudRiskLevel", "duplicateConfidence", "duplicateMethod"
  );
  log(5, "Document fraud/duplicate columns", docFraud.length === 4 ? "PASS" : "FAIL", docFraud.map(c=>c.column_name).join(","));

  // 6
  const receiptCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4)",
    "Expense", "receiptFileKey", "receiptHash", "receiptSealId"
  );
  log(6, "Expense receipt columns", receiptCols.length === 3 ? "PASS" : "FAIL", receiptCols.map(c=>c.column_name).join(","));

  console.log("\n─── BACKEND FILES & FUNCTIONS ───");

  // 7
  log(7, "unifiedSealEngine.js exists", fs.existsSync("./lib/unifiedSealEngine.js") ? "PASS" : "FAIL");

  // 8
  try {
    const { createSeal } = require("./lib/unifiedSealEngine");
    log(8, "createSeal function", typeof createSeal === "function" ? "PASS" : "FAIL");
  } catch(e) { log(8, "createSeal function", "FAIL", e.message); }

  // 9
  try {
    const { autoIssueSeal } = require("./services/universalSealService");
    log(9, "autoIssueSeal function", typeof autoIssueSeal === "function" ? "PASS" : "FAIL");
  } catch(e) { log(9, "autoIssueSeal function", "FAIL", e.message); }

  console.log("\n─── API ENDPOINTS ───");

  // 10
  const health = await httpReq("GET", "/api/health");
  log(10, "Backend /api/health", health.status === 200 ? "PASS" : "FAIL", "status=" + health.status);

  // 11
  const test401 = await httpReq("POST", "/api/internal/seals/create", {});
  log(11, "Internal seal rejects without secret", test401.status === 401 ? "PASS" : "FAIL", "status=" + test401.status);

  // 12
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const test500 = await httpReq("POST", "/api/internal/seals/create",
      { tenantId: "INVALID", rawHash: "test-" + Date.now(), documentTitle: "Regression" },
      { "x-internal-secret": secret }
    );
    log(12, "Internal seal auth accepts with secret", test500.status !== 401 ? "PASS" : "FAIL", "status=" + test500.status);
  } else {
    log(12, "Internal seal with secret", "SKIP", "INTERNAL_API_SECRET not set");
  }

  console.log("\n─── PUBLIC SEAL VERIFICATION ───");

  // 13-15
  const seal = await prisma.trustSeal.findFirst({ where: { status: "anchored" }, select: { id: true } });
  if (seal) {
    const pubSeal = await httpReq("GET", "/api/public/seal/" + seal.id);
    const pubData = JSON.parse(pubSeal.body);
    log(13, "Public seal has fraudRisk field", "fraudRisk" in pubData ? "PASS" : "FAIL");
    log(14, "Public seal has sourceType field", "sourceType" in pubData ? "PASS" : "FAIL");
    const hasTenant = "tenantId" in pubData;
    log(15, "Public seal hides tenantId", hasTenant ? "FAIL" : "PASS");
  } else {
    log(13, "Public seal fraudRisk", "SKIP", "no anchored seal");
    log(14, "Public seal sourceType", "SKIP", "no anchored seal");
    log(15, "Public seal tenantId hidden", "SKIP", "no anchored seal");
  }

  console.log("\n─── FRAUD DETECTION DATA ───");

  // 16-17
  const alj = await prisma.expense.findFirst({
    where: { vendor: { contains: "Jassar", mode: "insensitive" } },
    select: { fraudRiskScore: true, fraudSignals: true }
  });
  if (alj) {
    log(16, "Al Jassar fraud score >= 45", alj.fraudRiskScore >= 45 ? "PASS" : "FAIL", "score=" + alj.fraudRiskScore);
    log(17, "Al Jassar alteration % in signals", JSON.stringify(alj.fraudSignals).includes("%") ? "PASS" : "FAIL");
  } else {
    log(16, "Al Jassar fraud score", "SKIP", "no matching expense");
    log(17, "Al Jassar signals", "SKIP", "no matching expense");
  }

  // 18-20
  const mismatchCount = await prisma.auditLog.count({ where: { action: "EXPENSE_MISMATCH_FLAGGED" } });
  log(18, "EXPENSE_MISMATCH_FLAGGED audit entries", mismatchCount > 0 ? "PASS" : "FAIL", "count=" + mismatchCount);

  const dupCount = await prisma.auditLog.count({ where: { action: "HYBRID_DUPLICATE_DETECTED" } });
  log(19, "HYBRID_DUPLICATE_DETECTED audit entries", dupCount > 0 ? "PASS" : "FAIL", "count=" + dupCount);

  const fraudDoc = await prisma.document.findFirst({ where: { fraudRiskScore: { not: null } }, select: { id: true } });
  log(20, "Fraud-scored documents exist", fraudDoc ? "PASS" : "FAIL");

  console.log("\n─── SEAL & CASE STATS ───");

  // 21-23
  const caseSeals = await prisma.trustSeal.count({ where: { documentType: { in: ["CASE_ANALYSIS","CASE_DOCUMENT"] } } });
  log(21, "Case seals exist", caseSeals > 0 ? "PASS" : "FAIL", "count=" + caseSeals);

  const sealStats = await prisma.trustSeal.groupBy({ by: ["status"], _count: true });
  log(22, "TrustSeal stats", "PASS", sealStats.map(s => s.status + ":" + s._count).join(", "));

  const receiptExp = await prisma.expense.findFirst({ where: { receiptFileKey: { not: null } }, select: { id: true } });
  log(23, "Expense with receipt (receiptFileKey)", receiptExp ? "PASS" : "FAIL");

  console.log("\n─── PM2 SERVICES & CONNECTIVITY ───");

  // 24-28
  const fe = await localGet(3000, "/");
  log(24, "Frontend port 3000 online", fe.status === 200 ? "PASS" : "FAIL", "status=" + fe.status);

  const verifyApp = await localGet(3001, "/");
  log(25, "Verify app port 3001 online", verifyApp.status === 200 ? "PASS" : "FAIL", "status=" + verifyApp.status);

  const ping = await localGet(3000, "/api/ping");
  log(26, "/api/ping returns 200 \"ok\"", ping.status === 200 && ping.body === "ok" ? "PASS" : "FAIL", "status=" + ping.status + " body=" + ping.body);

  const extPing = await extGet("https://app.sealayer.io/api/ping");
  log(27, "External https://app.sealayer.io/api/ping", extPing.status === 200 ? "PASS" : "FAIL", "status=" + extPing.status);

  const extApp = await extGet("https://app.sealayer.io");
  log(28, "External https://app.sealayer.io", extApp.status === 200 ? "PASS" : "FAIL", "status=" + extApp.status);

  console.log("\n─── FRONTEND CODE VERIFICATION ───");

  // 29
  const pingRoute = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/app/api/ping/route.ts", "utf8");
  const noProxy = pingRoute.indexOf("fetch(") === -1 && pingRoute.indexOf("api-down") === -1;
  log(29, "/api/ping has no backend proxy", noProxy ? "PASS" : "FAIL");

  // 30
  const offlineHook = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/hooks/useOfflineSync.ts", "utf8");
  const defaultTrue = offlineHook.includes("useState(true)");
  log(30, "isOnline defaults to true", defaultTrue ? "PASS" : "FAIL");

  // 31
  const syncService = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/lib/syncService.ts", "utf8");
  const hasCacheDocs = syncService.includes("cacheDocuments");
  log(31, "cacheDocuments() in syncService", hasCacheDocs ? "PASS" : "FAIL");

  // 32
  const hasTokenRefresh = syncService.includes("refreshAccessToken");
  log(32, "Token refresh logic in drainQueue", hasTokenRefresh ? "PASS" : "FAIL");

  // 33
  const expPage = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/app/dashboard/expenses/page.tsx", "utf8");
  const hasDateCol = expPage.includes("<span>Date</span>");
  log(33, "Date column in expenses table header", hasDateCol ? "PASS" : "FAIL");

  // 34
  const anchorHidden = expPage.includes("if (!status || status === 'pending') return null");
  log(34, "AnchorBadge hidden when status=pending", anchorHidden ? "PASS" : "FAIL");

  // 35
  const hasVoidModal = expPage.includes("VoidModal");
  log(35, "Void expense modal in expenses page", hasVoidModal ? "PASS" : "FAIL");

  // ─── SUMMARY ───
  console.log("\n═══════════════════════════════════");
  console.log(`  PASS: ${pass}  |  FAIL: ${fail}  |  SKIP: ${skip}  |  TOTAL: 35`);
  if (fail === 0) console.log("  All checks passed");
  console.log("═══════════════════════════════════");

  await prisma.$disconnect();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
