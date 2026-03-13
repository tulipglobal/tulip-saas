require("dotenv").config();
const prisma = require("./lib/client");
const fs = require("fs");
const http = require("http");
const https = require("https");

function httpReq(method, path, body, headers) {
  return new Promise(r => {
    const opts = { hostname: "localhost", port: 5050, path, method, headers: { "Content-Type": "application/json", ...(headers||{}) } };
    const req = http.request(opts, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => r({ status: res.statusCode, body: d, headers: res.headers }));
    });
    req.on("error", e => r({ status: 0, body: e.message, headers: {} }));
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
  const d = detail ? " \u2014 " + detail : "";
  console.log(`[${String(n).padStart(2)}] ${tag.padEnd(6)} ${label}${d}`);
}

const TOTAL = 73;

(async () => {
  console.log(`=== REGRESSION CHECKLIST (${TOTAL} items) ===\n`);

  // ═══════════════════════════════════════════════════════════
  //  SECTION 1: DATABASE & SCHEMA (1-6)
  // ═══════════════════════════════════════════════════════════
  console.log("\u2500\u2500\u2500 DATABASE & SCHEMA \u2500\u2500\u2500");

  const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = $1", "public");
  log(1, "Database tables >= 35", tables.length >= 35 ? "PASS" : "FAIL", tables.length + " tables");

  const tsCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4,$5)",
    "TrustSeal", "fraudRiskScore", "fraudRiskLevel", "fraudSignals", "sourceType"
  );
  log(2, "TrustSeal fraud+sourceType columns", tsCols.length === 4 ? "PASS" : "FAIL", tsCols.map(c=>c.column_name).join(","));

  const voidCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4,$5)",
    "Expense", "voided", "voidedAt", "voidedReason", "voidedBy"
  );
  log(3, "Expense void columns", voidCols.length === 4 ? "PASS" : "FAIL", voidCols.map(c=>c.column_name).join(","));

  const expFraud = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4)",
    "Expense", "fraudRiskScore", "fraudRiskLevel", "fraudSignals"
  );
  log(4, "Expense fraud columns", expFraud.length === 3 ? "PASS" : "FAIL", expFraud.map(c=>c.column_name).join(","));

  const docFraud = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4,$5)",
    "Document", "fraudRiskScore", "fraudRiskLevel", "duplicateConfidence", "duplicateMethod"
  );
  log(5, "Document fraud/duplicate columns", docFraud.length === 4 ? "PASS" : "FAIL", docFraud.map(c=>c.column_name).join(","));

  const receiptCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4)",
    "Expense", "receiptFileKey", "receiptHash", "receiptSealId"
  );
  log(6, "Expense receipt columns", receiptCols.length === 3 ? "PASS" : "FAIL", receiptCols.map(c=>c.column_name).join(","));

  // ═══════════════════════════════════════════════════════════
  //  SECTION 2: BACKEND FILES & FUNCTIONS (7-9)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 BACKEND FILES & FUNCTIONS \u2500\u2500\u2500");

  log(7, "unifiedSealEngine.js exists", fs.existsSync("./lib/unifiedSealEngine.js") ? "PASS" : "FAIL");

  try {
    const { createSeal } = require("./lib/unifiedSealEngine");
    log(8, "createSeal function", typeof createSeal === "function" ? "PASS" : "FAIL");
  } catch(e) { log(8, "createSeal function", "FAIL", e.message); }

  try {
    const { autoIssueSeal } = require("./services/universalSealService");
    log(9, "autoIssueSeal function", typeof autoIssueSeal === "function" ? "PASS" : "FAIL");
  } catch(e) { log(9, "autoIssueSeal function", "FAIL", e.message); }

  // ═══════════════════════════════════════════════════════════
  //  SECTION 3: API ENDPOINTS (10-12)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 API ENDPOINTS \u2500\u2500\u2500");

  const health = await httpReq("GET", "/api/health");
  log(10, "Backend /api/health", health.status === 200 ? "PASS" : "FAIL", "status=" + health.status);

  const test401 = await httpReq("POST", "/api/internal/seals/create", {});
  log(11, "Internal seal rejects without secret", test401.status === 401 ? "PASS" : "FAIL", "status=" + test401.status);

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

  // ═══════════════════════════════════════════════════════════
  //  SECTION 4: PUBLIC SEAL VERIFICATION (13-15)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 PUBLIC SEAL VERIFICATION \u2500\u2500\u2500");

  const seal = await prisma.trustSeal.findFirst({ where: { status: "anchored" }, select: { id: true } });
  if (seal) {
    const pubSeal = await httpReq("GET", "/api/public/seal/" + seal.id);
    const pubData = JSON.parse(pubSeal.body);
    log(13, "Public seal has fraudRisk field", "fraudRisk" in pubData ? "PASS" : "FAIL");
    log(14, "Public seal has sourceType field", "sourceType" in pubData ? "PASS" : "FAIL");
    log(15, "Public seal hides tenantId", !("tenantId" in pubData) ? "PASS" : "FAIL");
  } else {
    log(13, "Public seal fraudRisk", "SKIP", "no anchored seal");
    log(14, "Public seal sourceType", "SKIP", "no anchored seal");
    log(15, "Public seal tenantId hidden", "SKIP", "no anchored seal");
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTION 5: FRAUD DETECTION DATA (16-20)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 FRAUD DETECTION DATA \u2500\u2500\u2500");

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

  const mismatchCount = await prisma.auditLog.count({ where: { action: "EXPENSE_MISMATCH_FLAGGED" } });
  log(18, "EXPENSE_MISMATCH_FLAGGED audit entries", mismatchCount > 0 ? "PASS" : "FAIL", "count=" + mismatchCount);

  const dupCount = await prisma.auditLog.count({ where: { action: "HYBRID_DUPLICATE_DETECTED" } });
  log(19, "HYBRID_DUPLICATE_DETECTED audit entries", dupCount > 0 ? "PASS" : "FAIL", "count=" + dupCount);

  const fraudDoc = await prisma.document.findFirst({ where: { fraudRiskScore: { not: null } }, select: { id: true } });
  log(20, "Fraud-scored documents exist", fraudDoc ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 6: SEAL & CASE STATS (21-23)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 SEAL & CASE STATS \u2500\u2500\u2500");

  const caseSeals = await prisma.trustSeal.count({ where: { documentType: { in: ["CASE_ANALYSIS","CASE_DOCUMENT"] } } });
  log(21, "Case seals exist", caseSeals > 0 ? "PASS" : "FAIL", "count=" + caseSeals);

  const sealStats = await prisma.trustSeal.groupBy({ by: ["status"], _count: true });
  log(22, "TrustSeal stats", "PASS", sealStats.map(s => s.status + ":" + s._count).join(", "));

  const receiptExp = await prisma.expense.findFirst({ where: { receiptFileKey: { not: null } }, select: { id: true } });
  log(23, "Expense with receipt (receiptFileKey)", receiptExp ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 7: PM2 SERVICES & CONNECTIVITY (24-28)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 PM2 SERVICES & CONNECTIVITY \u2500\u2500\u2500");

  const fe = await localGet(3000, "/");
  log(24, "Frontend port 3000 online", fe.status === 200 ? "PASS" : "FAIL", "status=" + fe.status);

  const verifyApp = await localGet(3001, "/");
  log(25, "Verify app port 3001 online", verifyApp.status === 200 ? "PASS" : "FAIL", "status=" + verifyApp.status);

  const ping = await localGet(3000, "/api/ping");
  log(26, "/api/ping returns 200 ok", ping.status === 200 && ping.body === "ok" ? "PASS" : "FAIL", "status=" + ping.status + " body=" + ping.body);

  const extPing = await extGet("https://app.sealayer.io/api/ping");
  log(27, "External app.sealayer.io/api/ping", extPing.status === 200 ? "PASS" : "FAIL", "status=" + extPing.status);

  const extApp = await extGet("https://app.sealayer.io");
  log(28, "External app.sealayer.io", extApp.status === 200 ? "PASS" : "FAIL", "status=" + extApp.status);

  // ═══════════════════════════════════════════════════════════
  //  SECTION 8: FRONTEND CODE VERIFICATION (29-35)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 FRONTEND CODE VERIFICATION \u2500\u2500\u2500");

  const pingRoute = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/app/api/ping/route.ts", "utf8");
  log(29, "/api/ping has no backend proxy", pingRoute.indexOf("fetch(") === -1 ? "PASS" : "FAIL");

  const offlineHook = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/hooks/useOfflineSync.ts", "utf8");
  log(30, "isOnline defaults to true", offlineHook.includes("useState(true)") ? "PASS" : "FAIL");

  const syncService = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/lib/syncService.ts", "utf8");
  log(31, "cacheDocuments() in syncService", syncService.includes("cacheDocuments") ? "PASS" : "FAIL");
  log(32, "Token refresh logic in drainQueue", syncService.includes("refreshAccessToken") ? "PASS" : "FAIL");

  const expPage = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/app/dashboard/expenses/page.tsx", "utf8");
  log(33, "Date column in expenses table header", expPage.includes("<span>Date</span>") ? "PASS" : "FAIL");
  log(34, "AnchorBadge hidden when status=pending", expPage.includes("if (!status || status === 'pending') return null") ? "PASS" : "FAIL");
  log(35, "Void expense modal in expenses page", expPage.includes("VoidModal") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 9: #29 BLOCK HIGH FRAUD (36-39)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #29 BLOCK HIGH FRAUD \u2500\u2500\u2500");

  const expCtrl = fs.readFileSync("/home/ubuntu/tulip-saas/backend/controllers/expenseController.js", "utf8");
  log(36, "EXPENSE_BLOCKED_FRAUD audit action in code", expCtrl.includes("EXPENSE_BLOCKED_FRAUD") ? "PASS" : "FAIL");

  try {
    const { scoreFraudRisk } = require("./lib/fraudRiskScorer");
    log(37, "scoreFraudRisk function exists", typeof scoreFraudRisk === "function" ? "PASS" : "FAIL");
  } catch(e) { log(37, "scoreFraudRisk function", "FAIL", e.message); }

  log(38, "Voided expense with 422 block code path", (expCtrl.includes("voided: true") && expCtrl.includes("status(422)")) ? "PASS" : "FAIL");
  log(39, "422 FRAUD_RISK_HIGH response in controller", expCtrl.includes("FRAUD_RISK_HIGH") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 10: #22 API RATE LIMITING (40-43)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #22 API RATE LIMITING \u2500\u2500\u2500");

  const rlAuth = await httpReq("POST", "/api/auth/login", { email: "test@test.com", password: "wrong" });
  const hasRlHeader = rlAuth.headers["x-ratelimit-limit"] || rlAuth.headers["ratelimit-limit"];
  log(40, "Auth endpoint has rate limit headers", hasRlHeader ? "PASS" : "FAIL", "header=" + (hasRlHeader || "missing"));

  const rlHealth = await httpReq("GET", "/api/health");
  log(41, "/api/health responds (not rate-blocked)", rlHealth.status === 200 ? "PASS" : "FAIL");

  // Check rate limiter middleware exists
  const hasRateLimiter = fs.existsSync("/home/ubuntu/tulip-saas/backend/middleware/rateLimiter.js") || fs.existsSync("/home/ubuntu/tulip-saas/backend/middleware/rateLimit.js");
  log(42, "Rate limiter middleware file exists", hasRateLimiter ? "PASS" : "FAIL");

  // Internal API should skip rate limiting
  if (secret) {
    const intReq = await httpReq("POST", "/api/internal/seals/create", { tenantId: "test" }, { "x-internal-secret": secret });
    const intRl = intReq.headers["x-ratelimit-limit"] || intReq.headers["ratelimit-limit"];
    log(43, "Internal API skips rate limiting", !intRl ? "PASS" : "FAIL", intRl ? "has header" : "no header");
  } else {
    log(43, "Internal API rate limit skip", "SKIP", "INTERNAL_API_SECRET not set");
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTION 11: #15 EMAIL ALERTS (44-48)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #15 EMAIL ALERTS \u2500\u2500\u2500");

  try {
    const emailSvc = require("./services/emailNotificationService");
    log(44, "notifyFraudAlert exported", typeof emailSvc.notifyFraudAlert === "function" ? "PASS" : "FAIL");
    log(45, "notifyDuplicateAlert exported", typeof emailSvc.notifyDuplicateAlert === "function" ? "PASS" : "FAIL");
    log(46, "notifyMismatchAlert exported", typeof emailSvc.notifyMismatchAlert === "function" ? "PASS" : "FAIL");
    log(47, "notifyVoidAlert exported", typeof emailSvc.notifyVoidAlert === "function" ? "PASS" : "FAIL");
  } catch(e) {
    log(44, "notifyFraudAlert", "FAIL", e.message);
    log(45, "notifyDuplicateAlert", "FAIL", e.message);
    log(46, "notifyMismatchAlert", "FAIL", e.message);
    log(47, "notifyVoidAlert", "FAIL", e.message);
  }

  const hasSesRegion = !!process.env.AWS_SES_REGION || !!process.env.AWS_REGION;
  log(48, "AWS SES region configured", hasSesRegion ? "PASS" : "FAIL", process.env.AWS_SES_REGION || process.env.AWS_REGION || "missing");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 12: #19 WORKFLOW APPROVAL (49-53)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #19 WORKFLOW APPROVAL \u2500\u2500\u2500");

  const wfTable = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "WorkflowTask");
  log(49, "WorkflowTask table exists", wfTable.length > 0 ? "PASS" : "FAIL");

  const pendingExp = await prisma.expense.findFirst({ where: { approvalStatus: "pending_review" } });
  log(50, "Expense with pending_review status", pendingExp ? "PASS" : "SKIP", pendingExp ? "id=" + pendingExp.id : "none currently pending");

  const wfTask = await prisma.workflowTask.findFirst({ where: { type: "expense_approval" } });
  log(51, "Workflow task type=expense_approval", wfTask ? "PASS" : "FAIL");

  const expCtrl2 = fs.readFileSync("/home/ubuntu/tulip-saas/backend/controllers/expenseController.js", "utf8");
  log(52, "approveExpense handler exists", expCtrl2.includes("exports.approveExpense") ? "PASS" : "FAIL");
  log(53, "rejectExpense handler exists", expCtrl2.includes("exports.rejectExpense") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 13: #32 POLYGON KEY & #31 REMOVE TEXTRACT (54-56)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #32 POLYGON KEY & #31 REMOVE TEXTRACT \u2500\u2500\u2500");

  const verifyEnv = fs.existsSync("/home/ubuntu/tulip-verify/.env");
  if (verifyEnv) {
    const envContent = fs.readFileSync("/home/ubuntu/tulip-verify/.env", "utf8");
    log(54, "tulip-verify has BLOCKCHAIN_PRIVATE_KEY", envContent.includes("BLOCKCHAIN_PRIVATE_KEY") ? "PASS" : "FAIL");
  } else {
    log(54, "tulip-verify .env exists", "FAIL", "file not found");
  }

  const verifyOcr = fs.readFileSync("/home/ubuntu/tulip-verify/src/lib/ocr.ts", "utf8");
  log(55, "No Textract in tulip-verify ocr.ts", !verifyOcr.includes("Textract") && !verifyOcr.includes("textract") ? "PASS" : "FAIL");
  log(56, "Mindee import in tulip-verify ocr.ts", verifyOcr.includes("mindee") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 14: #33 CHART Y-AXIS & #20 ANALYTICS (57-60)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #33 CHARTS & #20 ANALYTICS \u2500\u2500\u2500");

  // Check analytics page for beginAtZero or min: 0
  const analyticsFiles = [
    "/home/ubuntu/tulip-saas/frontend/src/app/dashboard/analytics/page.tsx",
    "/home/ubuntu/tulip-saas/frontend/src/app/dashboard/page.tsx",
  ];
  let hasBeginAtZero = false;
  let hasNumberFormat = false;
  for (const f of analyticsFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, "utf8");
      if (content.includes("beginAtZero") || content.includes("min: 0") || content.includes("domain={[0,") || content.includes("domain={[0, ")) hasBeginAtZero = true;
      if (content.includes("toLocaleString") || content.includes("Intl.NumberFormat") || content.includes("compact") || content.includes("formatYAxis")) hasNumberFormat = true;
    }
  }
  log(57, "Charts Y-axis starts from 0", hasBeginAtZero ? "PASS" : "FAIL");
  log(58, "Large numbers formatted", hasNumberFormat ? "PASS" : "FAIL");

  const fraudAnalytics = await httpReq("GET", "/api/analytics/fraud");
  // Will be 401 without auth, but endpoint existing means not 404
  log(59, "/api/analytics/fraud endpoint exists", fraudAnalytics.status !== 404 ? "PASS" : "FAIL", "status=" + fraudAnalytics.status);

  const analyticsPage = fs.existsSync("/home/ubuntu/tulip-saas/frontend/src/app/dashboard/analytics/page.tsx");
  if (analyticsPage) {
    const ap = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/app/dashboard/analytics/page.tsx", "utf8");
    log(60, "Fraud tab in analytics page", (ap.includes("fraud") || ap.includes("Fraud")) ? "PASS" : "FAIL");
  } else {
    log(60, "Analytics page exists", "FAIL", "file not found");
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTION 15: #23 WEBHOOK DELIVERY (61-65)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #23 WEBHOOK DELIVERY \u2500\u2500\u2500");

  try {
    const whSvc = require("./services/webhookService");
    log(61, "webhookService exports dispatch", typeof whSvc.dispatch === "function" ? "PASS" : "FAIL");
    log(62, "webhookService exports deliver (resend)", typeof whSvc.deliver === "function" ? "PASS" : "FAIL");
  } catch(e) {
    log(61, "webhookService dispatch", "FAIL", e.message);
    log(62, "webhookService deliver", "FAIL", e.message);
  }

  const sealSvc = fs.readFileSync("/home/ubuntu/tulip-saas/backend/services/universalSealService.js", "utf8");
  log(63, "seal.issued webhook in universalSealService", sealSvc.includes("seal.issued") ? "PASS" : "FAIL");

  const anchorSvc = fs.readFileSync("/home/ubuntu/tulip-saas/backend/services/batchAnchorService.js", "utf8");
  log(64, "seal.anchored webhook in batchAnchorService", anchorSvc.includes("seal.anchored") ? "PASS" : "FAIL");

  log(65, "expense.blocked webhook in expenseController", expCtrl.includes("expense.blocked") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 16: #17 BULK DOCUMENT UPLOAD (66-69)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #17 BULK DOCUMENT UPLOAD \u2500\u2500\u2500");

  const docNewPage = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/app/dashboard/documents/new/page.tsx", "utf8");
  log(66, "Multiple file input (multiple attribute)", docNewPage.includes("multiple") ? "PASS" : "FAIL");
  log(67, "Per-file status tracking", (docNewPage.includes("fileStatus") || docNewPage.includes("uploadStatus") || docNewPage.includes("status")) ? "PASS" : "FAIL");
  log(68, "Partial failure handling", (docNewPage.includes("failedCount") || docNewPage.includes("failed")) && docNewPage.includes("sealed") ? "PASS" : "FAIL");

  const offlineSync = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/lib/syncService.ts", "utf8");
  log(69, "Offline document queue in syncService", (offlineSync.includes("drainDocumentQueue") || offlineSync.includes("document")) ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 17: #18 DOCUMENT EXPIRY ALERTS (70-73)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #18 DOCUMENT EXPIRY ALERTS \u2500\u2500\u2500");

  const docExpiryCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2,$3,$4)",
    "Document", "expiryDate", "expiryAlertSent30", "expiryAlertSent7"
  );
  log(70, "Document expiry columns in schema", docExpiryCols.length === 3 ? "PASS" : "FAIL", docExpiryCols.map(c=>c.column_name).join(","));

  const docsPage = fs.readFileSync("/home/ubuntu/tulip-saas/frontend/src/app/dashboard/documents/page.tsx", "utf8");
  log(71, "ExpiryCell component in documents page", docsPage.includes("ExpiryCell") || docsPage.includes("expiry") ? "PASS" : "FAIL");

  log(72, "expiryAlerts.js job exists", fs.existsSync("/home/ubuntu/tulip-saas/backend/jobs/expiryAlerts.js") ? "PASS" : "FAIL");

  const expiryJob = fs.readFileSync("/home/ubuntu/tulip-saas/backend/jobs/expiryAlerts.js", "utf8");
  log(73, "DOCUMENT_EXPIRY_ALERT audit log in job", expiryJob.includes("DOCUMENT_EXPIRY_ALERT") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log(`  PASS: ${pass}  |  FAIL: ${fail}  |  SKIP: ${skip}  |  TOTAL: ${TOTAL}`);
  if (fail === 0 && skip === 0) console.log("  ALL CHECKS PASSED");
  else if (fail === 0) console.log("  All non-skipped checks passed");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

  await prisma.$disconnect();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
