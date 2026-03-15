require("dotenv").config();
const prisma = require("./lib/client");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// ── Configurable base URLs ────────────────────────────────────
const API_BASE = process.env.API_BASE || "https://api.tulipds.com";
const NGO_BASE = process.env.NGO_BASE || "https://app.sealayer.io";
const DONOR_BASE = process.env.DONOR_BASE || "https://donor.sealayer.io";

// ── Configurable file paths (auto-detect local vs server) ─────
const SAAS_ROOT = process.env.SAAS_ROOT || path.resolve(__dirname, "..");
const DONOR_ROOT = process.env.DONOR_ROOT || path.resolve(__dirname, "../../tulip-donor");
const VERIFY_ROOT = process.env.VERIFY_ROOT || path.resolve(__dirname, "../../tulip-verify");

function urlGet(baseUrl, urlPath) {
  return new Promise(r => {
    const fullUrl = baseUrl.replace(/\/$/, "") + urlPath;
    const mod = fullUrl.startsWith("https") ? https : http;
    mod.get(fullUrl, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => r({ status: res.statusCode, body: d }));
    }).on("error", () => r({ status: 0, body: "" }));
  });
}

function httpReq(method, urlPath, body, headers) {
  return new Promise(r => {
    const parsed = new URL(API_BASE.replace(/\/$/, "") + urlPath);
    const mod = parsed.protocol === "https:" ? https : http;
    const opts = { hostname: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80), path: parsed.pathname + parsed.search, method, headers: { "Content-Type": "application/json", ...(headers||{}) } };
    const req = mod.request(opts, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => r({ status: res.statusCode, body: d, headers: res.headers }));
    });
    req.on("error", e => r({ status: 0, body: e.message, headers: {} }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function localGet(port, urlPath) {
  if (port === 5050) return urlGet(API_BASE, urlPath);
  if (port === 3000) return urlGet(NGO_BASE, urlPath);
  if (port === 3001) return urlGet(NGO_BASE, urlPath);
  if (port === 4000) return urlGet(DONOR_BASE, urlPath);
  return urlGet(API_BASE, urlPath);
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

const TOTAL = 161;

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

  const fe = await urlGet(NGO_BASE, "/");
  log(24, "NGO frontend online", fe.status === 200 ? "PASS" : "FAIL", "status=" + fe.status);

  const donorFe = await urlGet(DONOR_BASE, "/");
  log(25, "Donor frontend online", donorFe.status === 200 ? "PASS" : "FAIL", "status=" + donorFe.status);

  const ping = await urlGet(NGO_BASE, "/api/ping");
  log(26, "/api/ping returns 200 ok", ping.status === 200 && ping.body === "ok" ? "PASS" : "FAIL", "status=" + ping.status + " body=" + ping.body);

  const extPing = await urlGet(NGO_BASE, "/api/ping");
  log(27, "External app.sealayer.io/api/ping", extPing.status === 200 ? "PASS" : "FAIL", "status=" + extPing.status);

  const extApp = await urlGet(NGO_BASE, "/");
  log(28, "External app.sealayer.io", extApp.status === 200 ? "PASS" : "FAIL", "status=" + extApp.status);

  // ═══════════════════════════════════════════════════════════
  //  SECTION 8: FRONTEND CODE VERIFICATION (29-35)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 FRONTEND CODE VERIFICATION \u2500\u2500\u2500");

  const pingRoute = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/api/ping/route.ts", "utf8");
  log(29, "/api/ping has no backend proxy", pingRoute.indexOf("fetch(") === -1 ? "PASS" : "FAIL");

  const offlineHook = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/hooks/useOfflineSync.ts", "utf8");
  log(30, "isOnline defaults to true", offlineHook.includes("useState(true)") ? "PASS" : "FAIL");

  const syncService = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/lib/syncService.ts", "utf8");
  log(31, "cacheDocuments() in syncService", syncService.includes("cacheDocuments") ? "PASS" : "FAIL");
  log(32, "Token refresh logic in drainQueue", syncService.includes("refreshAccessToken") ? "PASS" : "FAIL");

  const expPage = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/expenses/page.tsx", "utf8");
  log(33, "Date column in expenses table header", expPage.includes("<span>Date</span>") ? "PASS" : "FAIL");
  log(34, "AnchorBadge hidden when status=pending", expPage.includes("if (!status || status === 'pending') return null") ? "PASS" : "FAIL");
  log(35, "Void expense modal in expenses page", expPage.includes("VoidModal") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 9: #29 FRAUD RISK HIGHLIGHT (36-39)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #29 FRAUD RISK HIGHLIGHT \u2500\u2500\u2500");

  const expCtrl = fs.readFileSync("" + SAAS_ROOT + "/backend/controllers/expenseController.js", "utf8");
  log(36, "FRAUD_RISK_SCORED audit action in code", expCtrl.includes("FRAUD_RISK_SCORED") ? "PASS" : "FAIL");

  try {
    const { scoreFraudRisk } = require("./lib/fraudRiskScorer");
    log(37, "scoreFraudRisk function exists", typeof scoreFraudRisk === "function" ? "PASS" : "FAIL");
  } catch(e) { log(37, "scoreFraudRisk function", "FAIL", e.message); }

  log(38, "Fraud score stored on expense record", expCtrl.includes("fraudRiskScore") && expCtrl.includes("fraudRiskLevel") && expCtrl.includes("fraudSignals") ? "PASS" : "FAIL");
  log(39, "High fraud triggers email alert", expCtrl.includes("notifyFraudAlert") ? "PASS" : "FAIL");

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
  const hasRateLimiter = fs.existsSync("" + SAAS_ROOT + "/backend/middleware/rateLimiter.js") || fs.existsSync("" + SAAS_ROOT + "/backend/middleware/rateLimit.js");
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

  const expCtrl2 = fs.readFileSync("" + SAAS_ROOT + "/backend/controllers/expenseController.js", "utf8");
  log(52, "approveExpense handler exists", expCtrl2.includes("exports.approveExpense") ? "PASS" : "FAIL");
  log(53, "rejectExpense handler exists", expCtrl2.includes("exports.rejectExpense") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 13: #32 POLYGON KEY & #31 REMOVE TEXTRACT (54-56)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #32 POLYGON KEY & #31 REMOVE TEXTRACT \u2500\u2500\u2500");

  const verifyEnv = fs.existsSync("" + VERIFY_ROOT + "/.env");
  if (verifyEnv) {
    const envContent = fs.readFileSync("" + VERIFY_ROOT + "/.env", "utf8");
    log(54, "tulip-verify has BLOCKCHAIN_PRIVATE_KEY", envContent.includes("BLOCKCHAIN_PRIVATE_KEY") ? "PASS" : "FAIL");
  } else {
    log(54, "tulip-verify .env exists", "FAIL", "file not found");
  }

  const verifyOcr = fs.readFileSync("" + VERIFY_ROOT + "/src/lib/ocr.ts", "utf8");
  log(55, "No Textract in tulip-verify ocr.ts", !verifyOcr.includes("Textract") && !verifyOcr.includes("textract") ? "PASS" : "FAIL");
  log(56, "Mindee import in tulip-verify ocr.ts", verifyOcr.includes("mindee") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 14: #33 CHART Y-AXIS & #20 ANALYTICS (57-60)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #33 CHARTS & #20 ANALYTICS \u2500\u2500\u2500");

  // Check analytics page for beginAtZero or min: 0
  const analyticsFiles = [
    "" + SAAS_ROOT + "/frontend/src/app/dashboard/analytics/page.tsx",
    "" + SAAS_ROOT + "/frontend/src/app/dashboard/page.tsx",
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

  const analyticsPage = fs.existsSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/analytics/page.tsx");
  if (analyticsPage) {
    const ap = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/analytics/page.tsx", "utf8");
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

  const sealSvc = fs.readFileSync("" + SAAS_ROOT + "/backend/services/universalSealService.js", "utf8");
  log(63, "seal.issued webhook in universalSealService", sealSvc.includes("seal.issued") ? "PASS" : "FAIL");

  const anchorSvc = fs.readFileSync("" + SAAS_ROOT + "/backend/services/batchAnchorService.js", "utf8");
  log(64, "seal.anchored webhook in batchAnchorService", anchorSvc.includes("seal.anchored") ? "PASS" : "FAIL");

  log(65, "expense.flagged webhook in expenseController", expCtrl.includes("expense.flagged") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 16: #17 BULK DOCUMENT UPLOAD (66-69)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #17 BULK DOCUMENT UPLOAD \u2500\u2500\u2500");

  const docNewPage = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/documents/new/page.tsx", "utf8");
  log(66, "Multiple file input (multiple attribute)", docNewPage.includes("multiple") ? "PASS" : "FAIL");
  log(67, "Per-file status tracking", (docNewPage.includes("fileStatus") || docNewPage.includes("uploadStatus") || docNewPage.includes("status")) ? "PASS" : "FAIL");
  log(68, "Partial failure handling", (docNewPage.includes("failedCount") || docNewPage.includes("failed")) && docNewPage.includes("sealed") ? "PASS" : "FAIL");

  const offlineSync = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/lib/syncService.ts", "utf8");
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

  const docsPage = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/documents/page.tsx", "utf8");
  log(71, "ExpiryCell component in documents page", docsPage.includes("ExpiryCell") || docsPage.includes("expiry") ? "PASS" : "FAIL");

  log(72, "expiryAlerts.js job exists", fs.existsSync("" + SAAS_ROOT + "/backend/jobs/expiryAlerts.js") ? "PASS" : "FAIL");

  const expiryJob = fs.readFileSync("" + SAAS_ROOT + "/backend/jobs/expiryAlerts.js", "utf8");
  log(73, "DOCUMENT_EXPIRY_ALERT audit log in job", expiryJob.includes("DOCUMENT_EXPIRY_ALERT") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 18: #28 MULTI-CURRENCY (74-81)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 #28 MULTI-CURRENCY \u2500\u2500\u2500");

  // 74 — baseCurrency column on Tenant
  const baseCurrCol = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    "Tenant", "baseCurrency"
  );
  log(74, "Tenant baseCurrency column exists", baseCurrCol.length === 1 ? "PASS" : "FAIL");

  // 75 — CurrencySelect component exists
  log(75, "CurrencySelect component exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/components/CurrencySelect.tsx") ? "PASS" : "FAIL");

  // 76 — currencies.ts utility with 150+ currencies
  const currFile = "" + SAAS_ROOT + "/frontend/src/lib/currencies.ts";
  if (fs.existsSync(currFile)) {
    const currContent = fs.readFileSync(currFile, "utf8");
    const currCount = (currContent.match(/code:/g) || []).length;
    log(76, "currencies.ts has 150+ currencies", currCount >= 150 ? "PASS" : "FAIL", "count=" + currCount);
  } else {
    log(76, "currencies.ts exists", "FAIL", "file not found");
  }

  // 77 — formatCurrencyShort + searchCurrencies exported
  if (fs.existsSync(currFile)) {
    const currContent = fs.readFileSync(currFile, "utf8");
    log(77, "formatCurrencyShort + searchCurrencies in currencies.ts",
      currContent.includes("formatCurrencyShort") && currContent.includes("searchCurrencies") ? "PASS" : "FAIL");
  } else {
    log(77, "currencies.ts utilities", "FAIL", "file not found");
  }

  // 78 — Expense new page uses CurrencySelect (not hardcoded dropdown)
  const expNewPage = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/expenses/new/page.tsx", "utf8");
  log(78, "Expense form uses CurrencySelect", expNewPage.includes("CurrencySelect") ? "PASS" : "FAIL");

  // 79 — Budget new page uses CurrencySelect
  const budgetNewFile = "" + SAAS_ROOT + "/frontend/src/app/dashboard/budgets/new/page.tsx";
  if (fs.existsSync(budgetNewFile)) {
    const budgetNew = fs.readFileSync(budgetNewFile, "utf8");
    log(79, "Budget form uses CurrencySelect", budgetNew.includes("CurrencySelect") ? "PASS" : "FAIL");
  } else {
    log(79, "Budget new page exists", "FAIL", "file not found");
  }

  // 80 — Funding new page uses CurrencySelect
  const fundingNewFile = "" + SAAS_ROOT + "/frontend/src/app/dashboard/funding/new/page.tsx";
  if (fs.existsSync(fundingNewFile)) {
    const fundingNew = fs.readFileSync(fundingNewFile, "utf8");
    log(80, "Funding form uses CurrencySelect", fundingNew.includes("CurrencySelect") ? "PASS" : "FAIL");
  } else {
    log(80, "Funding new page exists", "FAIL", "file not found");
  }

  // 81 — Settings page has baseCurrency
  const settingsFile = "" + SAAS_ROOT + "/frontend/src/app/dashboard/settings/page.tsx";
  if (fs.existsSync(settingsFile)) {
    const settings = fs.readFileSync(settingsFile, "utf8");
    log(81, "Settings page has baseCurrency", settings.includes("baseCurrency") ? "PASS" : "FAIL");
  } else {
    log(81, "Settings page exists", "FAIL", "file not found");
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTION 19: AWS S3 CREDENTIALS & PRESIGNED URLS (82-84)
  // ═══════════════════════════════════════════════════════════
  console.log("\n\u2500\u2500\u2500 AWS S3 CREDENTIALS & PRESIGNED URLS \u2500\u2500\u2500");

  log(82, "AWS_ACCESS_KEY_ID is set", !!process.env.AWS_ACCESS_KEY_ID ? "PASS" : "FAIL", process.env.AWS_ACCESS_KEY_ID ? "present" : "MISSING — S3 presigned URLs will fail");
  log(83, "AWS_SECRET_ACCESS_KEY is set", !!process.env.AWS_SECRET_ACCESS_KEY ? "PASS" : "FAIL", process.env.AWS_SECRET_ACCESS_KEY ? "present" : "MISSING — S3 presigned URLs will fail");

  // Test actual presigned URL generation with a real seal that has an s3Key
  const sealWithFile = await prisma.trustSeal.findFirst({ where: { s3Key: { not: null } }, select: { id: true, s3Key: true } });
  if (sealWithFile) {
    const docResp = await httpReq("GET", "/api/public/seal/" + sealWithFile.id + "/document");
    const docData = JSON.parse(docResp.body);
    log(84, "S3 presigned URL generation works", docResp.status === 200 && !!docData.url ? "PASS" : "FAIL",
      docResp.status === 200 ? "URL generated" : "status=" + docResp.status + " " + (docData.error || ""));
  } else {
    log(84, "S3 presigned URL generation", "SKIP", "no seal with s3Key found");
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTION 20: SPRINT 5 — IMPACT INVESTMENTS & DRAWDOWNS (85-93)
  // ═══════════════════════════════════════════════════════════
  console.log("\n───  SPRINT 5 — IMPACT INVESTMENTS & DRAWDOWNS ───");

  // 85-86 — Investment tables exist
  const invTables = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename IN ($2,$3,$4,$5,$6)",
    "public", "ImpactInvestment", "RepaymentSchedule", "Drawdown", "Covenant", "ImpactMilestone"
  );
  log(85, "Sprint 5 tables exist (5 expected)", invTables.length === 5 ? "PASS" : "FAIL", invTables.map(t => t.tablename).join(", "));

  // 86 — ImpactInvestment has donorOrgId column (uuid, links to DonorOrganisation)
  const invDonorCol = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    "ImpactInvestment", "donorOrgId"
  );
  log(86, "ImpactInvestment.donorOrgId column", invDonorCol.length === 1 ? "PASS" : "FAIL", invDonorCol.length ? invDonorCol[0].data_type : "missing");

  // 87 — NGO investments route file exists
  log(87, "ngoInvestmentRoutes.js exists",
    fs.existsSync("" + SAAS_ROOT + "/backend/routes/ngoInvestmentRoutes.js") ? "PASS" : "FAIL");

  // 88 — Donor investments route file exists
  log(88, "donorInvestmentRoutes.js exists",
    fs.existsSync("" + SAAS_ROOT + "/backend/routes/donorInvestmentRoutes.js") ? "PASS" : "FAIL");

  // 89 — NGO milestones route file exists
  log(89, "ngoMilestoneRoutes.js exists",
    fs.existsSync("" + SAAS_ROOT + "/backend/routes/ngoMilestoneRoutes.js") ? "PASS" : "FAIL");

  // 90 — Investment Monitoring page exists with schedule null guard
  const invPage = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/investments/page.tsx", "utf8");
  log(90, "Investments page has schedule null guard", invPage.includes("inv.schedule || []") ? "PASS" : "FAIL");

  // 91 — Drawdowns page exists
  log(91, "Drawdowns page exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/drawdowns/page.tsx") ? "PASS" : "FAIL");

  // 92 — Budget page has donor org selector (donorMode)
  const budgetDetail = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/budgets/[id]/page.tsx", "utf8");
  log(92, "Budget detail has donor org selector", budgetDetail.includes("donorMode") && budgetDetail.includes("donorOrgId") ? "PASS" : "FAIL");

  // 93 — Budget new page has donor org selector
  const budgetNewContent = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/budgets/new/page.tsx", "utf8");
  log(93, "Budget new has donor org selector", budgetNewContent.includes("donorMode") && budgetNewContent.includes("donorOrgId") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 21: i18n COMPLETENESS (94-97)
  // ═══════════════════════════════════════════════════════════
  console.log("\n───  i18n COMPLETENESS ───");

  const i18nDir = "" + SAAS_ROOT + "/frontend/src/messages";
  const langs = ["en", "fr", "es", "pt", "it"];
  const requiredNavKeys = ["investments", "drawdowns"];
  const requiredDocKeys = ["document", "type", "category", "expiry", "seal", "project"];

  // 94 — nav.investments + nav.drawdowns in all 5 languages
  let navKeysOk = true;
  let navMissing = [];
  for (const lang of langs) {
    const msgs = JSON.parse(fs.readFileSync(`${i18nDir}/${lang}.json`, "utf8"));
    for (const k of requiredNavKeys) {
      if (!msgs.nav || !msgs.nav[k]) { navKeysOk = false; navMissing.push(`${lang}:nav.${k}`); }
    }
  }
  log(94, "nav.investments/drawdowns in all langs", navKeysOk ? "PASS" : "FAIL", navMissing.length ? navMissing.join(", ") : "all present");

  // 95 — documents table header keys in all 5 languages
  let docKeysOk = true;
  let docMissing = [];
  for (const lang of langs) {
    const msgs = JSON.parse(fs.readFileSync(`${i18nDir}/${lang}.json`, "utf8"));
    for (const k of requiredDocKeys) {
      if (!msgs.documents || !msgs.documents[k]) { docKeysOk = false; docMissing.push(`${lang}:documents.${k}`); }
    }
  }
  log(95, "documents table header keys in all langs", docKeysOk ? "PASS" : "FAIL", docMissing.length ? docMissing.join(", ") : "all present");

  // 96 — All 5 language files exist
  let allLangs = true;
  for (const lang of langs) {
    if (!fs.existsSync(`${i18nDir}/${lang}.json`)) allLangs = false;
  }
  log(96, "All 5 i18n files exist (en,fr,es,pt,it)", allLangs ? "PASS" : "FAIL");

  // 97 — No MISSING_MESSAGE in frontend build output (check documents page has all keys)
  const docPage = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/documents/page.tsx", "utf8");
  const docI18nCalls = docPage.match(/t\('documents\.(\w+)'\)/g) || [];
  const enMsgs = JSON.parse(fs.readFileSync(`${i18nDir}/en.json`, "utf8"));
  let allDocKeysExist = true;
  let missingDocI18n = [];
  for (const call of docI18nCalls) {
    const key = call.match(/documents\.(\w+)/)[1];
    if (!enMsgs.documents || !enMsgs.documents[key]) { allDocKeysExist = false; missingDocI18n.push(key); }
  }
  log(97, "All documents page i18n keys defined", allDocKeysExist ? "PASS" : "FAIL", missingDocI18n.length ? "missing: " + missingDocI18n.join(",") : "all present");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 22: SPRINT 6 — MESSENGER, TRANCHES, CONDITIONS, REPORTS (98-113)
  // ═══════════════════════════════════════════════════════════
  console.log("\n───  SPRINT 6 — MESSENGER, TRANCHES, CONDITIONS, REPORTS ───");

  // 98 — Sprint 6 tables exist
  const s6Tables = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename IN ($2,$3,$4,$5,$6,$7)",
    "public", "Conversation", "Message", "CallSession", "DisbursementTranche", "GrantCondition", "SavedReport"
  );
  log(98, "Sprint 6 tables exist (6 expected)", s6Tables.length === 6 ? "PASS" : "FAIL", s6Tables.map(t => t.tablename).sort().join(", "));

  // 99 — Socket.IO module exists
  log(99, "lib/socketio.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/lib/socketio.js") ? "PASS" : "FAIL");

  // 100 — Socket.IO initialized in app.js
  const appJs = fs.readFileSync("" + SAAS_ROOT + "/backend/app.js", "utf8");
  log(100, "app.js uses httpServer + Socket.IO", appJs.includes("initSocketIO") && appJs.includes("httpServer") ? "PASS" : "FAIL");

  // 101 — Messenger routes file exists
  log(101, "messengerRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/messengerRoutes.js") ? "PASS" : "FAIL");

  // 102 — Tranche routes file exists
  log(102, "trancheRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/trancheRoutes.js") ? "PASS" : "FAIL");

  // 103 — Condition routes file exists
  log(103, "conditionRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/conditionRoutes.js") ? "PASS" : "FAIL");

  // 104 — Report routes file exists
  log(104, "reportRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/reportRoutes.js") ? "PASS" : "FAIL");

  // 105 — Messenger API endpoints respond (401 without auth = endpoint exists)
  const msgResp = await httpReq("GET", "/api/messenger/donor/unread-count");
  log(105, "Messenger unread-count endpoint", msgResp.status === 401 ? "PASS" : "FAIL", "status=" + msgResp.status);

  // 106 — Tranche API endpoint responds
  const trResp = await httpReq("GET", "/api/tranches/donor/funding/test");
  log(106, "Tranche endpoint responds", trResp.status === 401 ? "PASS" : "FAIL", "status=" + trResp.status);

  // 107 — Condition API endpoint responds
  const condResp = await httpReq("GET", "/api/conditions/donor/funding/test");
  log(107, "Condition endpoint responds", condResp.status === 401 ? "PASS" : "FAIL", "status=" + condResp.status);

  // 108 — Report API endpoint responds
  const repResp = await httpReq("GET", "/api/donor/reports/saved");
  log(108, "Report saved endpoint responds", repResp.status === 401 ? "PASS" : "FAIL", "status=" + repResp.status);

  // 109 — NGO MessengerPanel component exists
  log(109, "NGO MessengerPanel.tsx exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/components/MessengerPanel.tsx") ? "PASS" : "FAIL");

  // 110 — NGO layout imports MessengerPanel
  const ngoLayout = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/layout.tsx", "utf8");
  log(110, "NGO layout imports MessengerPanel", ngoLayout.includes("MessengerPanel") ? "PASS" : "FAIL");

  // 111 — Donor portal MessengerPanel exists
  log(111, "Donor MessengerPanel.tsx exists",
    fs.existsSync("" + DONOR_ROOT + "/components/MessengerPanel.tsx") ? "PASS" : "FAIL");

  // 112 — Donor portal reports page exists
  log(112, "Donor reports page exists",
    fs.existsSync("" + DONOR_ROOT + "/app/reports/page.tsx") ? "PASS" : "FAIL");

  // 113 — All 4 PM2 services online
  const { execSync } = require("child_process");
  try {
    const pm2Out = execSync("pm2 jlist 2>/dev/null").toString();
    const pm2List = JSON.parse(pm2Out);
    const allOnline = pm2List.every(p => p.pm2_env.status === "online");
    log(113, "All 4 PM2 services online", allOnline && pm2List.length >= 4 ? "PASS" : "FAIL",
      pm2List.map(p => p.name + ":" + p.pm2_env.status).join(", "));
  } catch {
    log(113, "All 4 PM2 services online", "SKIP", "pm2 not available locally — run on server");
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTION 23: SPRINT 7 — SSO, DARK MODE, SEARCH, SHARE (114-125)
  // ═══════════════════════════════════════════════════════════
  console.log("\n───  SPRINT 7 — SSO, DARK MODE, SEARCH, SHARE ───");

  // 114 — SSOConfig table exists
  const ssoTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "SSOConfig"
  );
  log(114, "SSOConfig table exists", ssoTable.length > 0 ? "PASS" : "FAIL");

  // 115 — SSO routes file exists
  log(115, "ssoRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/ssoRoutes.js") ? "PASS" : "FAIL");

  // 116 — SSO admin routes file exists
  log(116, "ssoAdminRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/ssoAdminRoutes.js") ? "PASS" : "FAIL");

  // 117 — SSO check endpoint responds
  const ssoCheck = await httpReq("GET", "/api/auth/sso/check/test");
  log(117, "SSO check endpoint responds", ssoCheck.status === 200 ? "PASS" : "FAIL", "status=" + ssoCheck.status);

  // 118 — Theme preference route exists
  log(118, "userPreferenceRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/userPreferenceRoutes.js") ? "PASS" : "FAIL");

  // 119 — User.themePreference column
  const themeCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", "User", "themePreference"
  );
  log(119, "User.themePreference column exists", themeCols.length === 1 ? "PASS" : "FAIL");

  // 120 — ThemeToggle component exists (NGO)
  log(120, "NGO ThemeToggle.tsx exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/components/ThemeToggle.tsx") ? "PASS" : "FAIL");

  // 121 — Search routes file exists
  log(121, "searchRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/searchRoutes.js") ? "PASS" : "FAIL");

  // 122 — Search endpoint responds (401 = exists)
  const searchResp = await httpReq("GET", "/api/search?q=test");
  log(122, "Search endpoint responds", searchResp.status === 401 ? "PASS" : "FAIL", "status=" + searchResp.status);

  // 123 — SearchModal component exists (NGO)
  log(123, "NGO SearchModal.tsx exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/components/SearchModal.tsx") ? "PASS" : "FAIL");

  // 124 — ShareLink table exists
  const shareTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "ShareLink"
  );
  log(124, "ShareLink table exists", shareTable.length > 0 ? "PASS" : "FAIL");

  // 125 — Share routes files exist
  log(125, "shareRoutes.js + sharePublicRoutes.js exist",
    fs.existsSync("" + SAAS_ROOT + "/backend/routes/shareRoutes.js") &&
    fs.existsSync("" + SAAS_ROOT + "/backend/routes/sharePublicRoutes.js") ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 24: SPRINT 8 PART 0 — CAPEX/OPEX, LOGFRAME, RISK, GRANT CONFIG, WB (126-141)
  // ═══════════════════════════════════════════════════════════
  console.log("\n───  SPRINT 8 PART 0 — CAPEX/OPEX, LOGFRAME, RISK, GRANT, WB ───");

  // 126 — Expense.expenditureType column
  const expTypeCols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2", "Expense", "expenditureType"
  );
  log(126, "Expense.expenditureType column exists", expTypeCols.length === 1 ? "PASS" : "FAIL");

  // 127 — LogframeOutput + LogframeIndicator tables
  const lfTables = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename IN ($2,$3)",
    "public", "LogframeOutput", "LogframeIndicator"
  );
  log(127, "Logframe tables exist (2)", lfTables.length === 2 ? "PASS" : "FAIL", lfTables.map(t => t.tablename).join(", "));

  // 128 — Logframe routes file
  log(128, "logframeRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/logframeRoutes.js") ? "PASS" : "FAIL");

  // 129 — RiskRegisterEntry table
  const riskTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "RiskRegisterEntry"
  );
  log(129, "RiskRegisterEntry table exists", riskTable.length > 0 ? "PASS" : "FAIL");

  // 130 — Risk routes file
  log(130, "riskRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/riskRoutes.js") ? "PASS" : "FAIL");

  // 131 — RiskRegisterTab component
  log(131, "RiskRegisterTab.tsx exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/components/RiskRegisterTab.tsx") ? "PASS" : "FAIL");

  // 132 — GrantReportingConfig table
  const grcTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "GrantReportingConfig"
  );
  log(132, "GrantReportingConfig table exists", grcTable.length > 0 ? "PASS" : "FAIL");

  // 133 — Grant reporting routes file
  log(133, "grantReportingRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/grantReportingRoutes.js") ? "PASS" : "FAIL");

  // 134 — WBProjectComponent table
  const wbCompTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "WBProjectComponent"
  );
  log(134, "WBProjectComponent table exists", wbCompTable.length > 0 ? "PASS" : "FAIL");

  // 135 — WBProcurementContract table
  const wbContTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "WBProcurementContract"
  );
  log(135, "WBProcurementContract table exists", wbContTable.length > 0 ? "PASS" : "FAIL");

  // 136 — WB routes file
  log(136, "wbRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/wbRoutes.js") ? "PASS" : "FAIL");

  // 137 — WorldBankTab component
  log(137, "WorldBankTab.tsx exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/components/WorldBankTab.tsx") ? "PASS" : "FAIL");

  // 138 — NGO project page has Logframe tab
  const projPage = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/projects/[id]/page.tsx", "utf8");
  log(138, "NGO project page has Logframe tab", projPage.includes("logframe") || projPage.includes("Logframe") ? "PASS" : "FAIL");

  // 139 — NGO project page has Risk Register tab
  log(139, "NGO project page has Risk Register tab", projPage.includes("RiskRegister") || projPage.includes("risk") ? "PASS" : "FAIL");

  // 140 — Settings page has Grant Reporting section
  const settingsContent = fs.readFileSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/settings/page.tsx", "utf8");
  log(140, "Settings page has Grant Reporting section", settingsContent.includes("grantReporting") || settingsContent.includes("Grant Reporting") ? "PASS" : "FAIL");

  // 141 — Donor portal has Logframe + Risk tabs
  const donorProjPage = fs.readFileSync("" + DONOR_ROOT + "/app/projects/[id]/page.tsx", "utf8");
  log(141, "Donor project page has logframe + risks tabs",
    (donorProjPage.includes("logframe") || donorProjPage.includes("Logframe")) &&
    (donorProjPage.includes("risks") || donorProjPage.includes("Risk")) ? "PASS" : "FAIL");

  // ═══════════════════════════════════════════════════════════
  //  SECTION 25: SPRINT 8 PARTS 1-4 — REPORT ENGINE + REPORTS (142-161)
  // ═══════════════════════════════════════════════════════════
  console.log("\n───  SPRINT 8 PARTS 1-4 — REPORTS ───");

  // 142 — GeneratedReport table
  const genRepTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "GeneratedReport"
  );
  log(142, "GeneratedReport table exists", genRepTable.length > 0 ? "PASS" : "FAIL");

  // 143 — ReportShareLink table
  const repShareTable = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2", "public", "ReportShareLink"
  );
  log(143, "ReportShareLink table exists", repShareTable.length > 0 ? "PASS" : "FAIL");

  // 144 — reportEngine.js exists
  log(144, "reportEngine.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/services/reportEngine.js") ? "PASS" : "FAIL");

  // 145 — reportEngine loads and has key methods
  try {
    const engine = require("./services/reportEngine");
    log(145, "reportEngine has createDoc + addCoverPage",
      typeof engine.createDoc === "function" && typeof engine.addCoverPage === "function" ? "PASS" : "FAIL");
  } catch(e) { log(145, "reportEngine loads", "FAIL", e.message); }

  // 146 — ngoReportRoutes.js exists
  log(146, "ngoReportRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/ngoReportRoutes.js") ? "PASS" : "FAIL");

  // 147 — reportPublicRoutes.js exists
  log(147, "reportPublicRoutes.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/routes/reportPublicRoutes.js") ? "PASS" : "FAIL");

  // 148 — reportAutoService.js exists
  log(148, "reportAutoService.js exists", fs.existsSync("" + SAAS_ROOT + "/backend/services/reportAutoService.js") ? "PASS" : "FAIL");

  // 149 — NGO reports endpoint responds (401 = exists)
  const ngoRepResp = await httpReq("GET", "/api/ngo/reports");
  log(149, "NGO reports endpoint responds", ngoRepResp.status === 401 ? "PASS" : "FAIL", "status=" + ngoRepResp.status);

  // 150 — Monthly report endpoint responds
  const monthlyResp = await httpReq("POST", "/api/ngo/reports/generate/monthly", {});
  log(150, "Monthly report endpoint responds", monthlyResp.status === 401 ? "PASS" : "FAIL", "status=" + monthlyResp.status);

  // 151 — USAID SF-425 endpoint responds
  const usaidResp = await httpReq("POST", "/api/ngo/reports/generate/usaid-sf425", {});
  log(151, "USAID SF-425 endpoint responds", usaidResp.status === 401 ? "PASS" : "FAIL", "status=" + usaidResp.status);

  // 152 — WB procurement endpoint responds
  const wbRepResp = await httpReq("POST", "/api/ngo/reports/generate/wb-procurement", {});
  log(152, "WB procurement endpoint responds", wbRepResp.status === 401 ? "PASS" : "FAIL", "status=" + wbRepResp.status);

  // 153 — Public report share endpoint responds
  const pubRepResp = await httpReq("GET", "/api/public/reports/invalidtoken");
  log(153, "Public report share endpoint responds", pubRepResp.status !== 404 ? "PASS" : "FAIL", "status=" + pubRepResp.status);

  // 154 — Anchor scheduler has report cron jobs
  const anchorSched = fs.readFileSync("" + SAAS_ROOT + "/backend/services/anchorScheduler.js", "utf8");
  log(154, "Anchor scheduler has monthly report cron", anchorSched.includes("auto-reports") && anchorSched.includes("MONTHLY") ? "PASS" : "FAIL");
  log(155, "Anchor scheduler has quarterly report cron", anchorSched.includes("QUARTERLY") ? "PASS" : "FAIL");
  log(156, "Anchor scheduler has annual report cron", anchorSched.includes("ANNUAL") ? "PASS" : "FAIL");

  // 157 — NGO reports page exists
  log(157, "NGO reports page exists",
    fs.existsSync("" + SAAS_ROOT + "/frontend/src/app/dashboard/reports/page.tsx") ? "PASS" : "FAIL");

  // 158 — NGO layout has Reports nav item
  log(158, "NGO layout has Reports nav", ngoLayout.includes("reports") ? "PASS" : "FAIL");

  // 159 — Donor portal reports page exists
  log(159, "Donor reports page exists", fs.existsSync("" + DONOR_ROOT + "/app/reports/page.tsx") ? "PASS" : "FAIL");

  // 160 — Donor ReportShareModal exists
  log(160, "Donor ReportShareModal.tsx exists", fs.existsSync("" + DONOR_ROOT + "/components/ReportShareModal.tsx") ? "PASS" : "FAIL");

  // 161 — Public report share page exists
  log(161, "Donor public report share page exists",
    fs.existsSync("" + DONOR_ROOT + "/app/share/report/[token]/page.tsx") ? "PASS" : "FAIL");

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
