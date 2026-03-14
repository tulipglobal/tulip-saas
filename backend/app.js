// ─────────────────────────────────────────────────────────────
//  app.js — v9
//
//  Changes from v8:
//  ✔ /api/timestamps routes (RFC 3161)
// ─────────────────────────────────────────────────────────────

require('dotenv').config()

const express      = require('express')
const swaggerUi    = require('swagger-ui-express')
const swaggerSpec  = require('./lib/swagger')
const { startAnchorScheduler } = require('./services/anchorScheduler')
const prisma       = require('./lib/client')
const logger       = require('./lib/logger')

const app = express()
const cors = require('cors')
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4000', 'https://tulipds.com', 'https://www.tulipds.com', 'https://app.tulipds.com', 'https://donor.tulipds.com', 'https://verify.tulipds.com', 'https://app.sealayer.io', 'https://verify.sealayer.io', 'https://ngo.sealayer.io', 'https://donor.sealayer.io'], credentials: true }))
app.set('trust proxy', 1)

const { apiLimiter, authLimiter, uploadLimiter, ocrLimiter, strictLimiter, verifyLimiter } = require('./middleware/rateLimit')

// Stripe webhook needs raw body BEFORE express.json() parses it
const { handleWebhook } = require('./controllers/billingController')
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleWebhook)

// Seal issuance API needs 50mb body limit — mount BEFORE global express.json()
const sealIssuanceRoutes = require('./routes/sealIssuanceRoutes')
app.use('/api/seal', apiLimiter, sealIssuanceRoutes)

app.use(express.json())
app.use(require('./middleware/requestLogger'))
const authenticate = require('./middleware/authenticate')
const tenantScope  = require('./middleware/tenantScope')

const authRoutes          = require('./routes/authRoutes')
const projectRoutes       = require('./routes/projectRoutes')
const fundingSourceRoutes = require('./routes/fundingSourceRoutes')
const expenseRoutes       = require('./routes/expenseRoutes')
const documentRoutes      = require('./routes/documentRoutes')
const auditRoutes         = require('./routes/auditRoutes')
const gdprRoutes          = require('./routes/gdprRoutes')
const webhookRoutes       = require('./routes/webhookRoutes')
const metricsRoutes       = require('./routes/metricsRoutes')
const donorRoutes             = require("./routes/donorRoutes")
const fundingAgreementRoutes  = require("./routes/fundingAgreementRoutes")
const donorInviteRoutes       = require("./routes/donorInviteRoutes")
const donorAuthRoutes     = require('./routes/donorAuthRoutes')
const donorDocumentRoutes = require('./routes/donorDocumentRoutes')
const apiKeyRoutes        = require('./routes/apiKeyRoutes')
const archiveRoutes       = require('./routes/archiveRoutes')
const timestampRoutes     = require('./routes/timestampRoutes')
const verifyRouter        = require('./src/routes/verify')
const tenantPublicRoutes  = require('./routes/tenantPublicRoutes')
const setupRoutes         = require('./routes/setupRoutes')
const billingRoutes       = require('./routes/billingRoutes')
const teamRoutes          = require('./routes/teamRoutes')
const analyticsRoutes     = require('./routes/analyticsRoutes')
const workflowRoutes      = require('./routes/workflowRoutes')
const overviewRoutes      = require('./routes/overviewRoutes')
const ocrRoutes = require('./routes/ocrRoutes')
const developerRoutes    = require('./routes/developerRoutes')
const externalApiRoutes  = require('./routes/externalApiRoutes')
const externalAuth       = require('./middleware/externalAuth')
const caseRoutes         = require('./routes/caseRoutes')
const casePublicRoutes   = require('./routes/casePublicRoutes')
const trustSealRoutes    = require('./routes/trustSealRoutes')
const sealPublicRoutes   = require('./routes/sealPublicRoutes')
const budgetRoutes       = require('./routes/budgetRoutes')
const adminRoutes        = require('./routes/adminRoutes')
const ocrPublicRoutes    = require('./routes/ocrPublicRoutes')
const internalSealRoutes = require('./routes/internalSealRoutes')
const donorPortalRoutes  = require('./routes/donorPortalRoutes')
const ngoChallengeRoutes = require('./routes/ngoChallengeRoutes')
const ngoDeliverableRoutes = require('./routes/ngoDeliverableRoutes')
const ngoMilestoneRoutes = require('./routes/ngoMilestoneRoutes')

app.get('/', (req, res) => res.send('Tulip API Running'))

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Tulip API Docs',
  customCss: '.swagger-ui .topbar { background-color: #1A56A0 }',
}))
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec))

app.get('/api/health', async (req, res) => {
  const dbOk = await prisma.$queryRaw`SELECT 1`
    .then(() => true).catch(() => false)
  res.status(dbOk ? 200 : 503).json({
    status:    dbOk ? 'ok' : 'degraded',
    db:        dbOk ? 'connected' : 'error',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString()
  })
})

app.use('/api/auth',       authLimiter,    authRoutes)
app.use('/api/verify',     verifyLimiter, verifyRouter)
app.use('/api/tenants/public', apiLimiter, tenantPublicRoutes)
app.use('/api/projects',   apiLimiter,     authenticate, tenantScope, projectRoutes)
app.use('/api/funding-sources', apiLimiter, authenticate, tenantScope, fundingSourceRoutes)
app.use('/api/expenses',   apiLimiter, uploadLimiter, authenticate, tenantScope, expenseRoutes)
app.use('/api/documents',  apiLimiter, uploadLimiter, authenticate, tenantScope, documentRoutes)
app.use('/api/audit',      apiLimiter,     authenticate, tenantScope, auditRoutes)
app.use('/api/gdpr',       strictLimiter,  authenticate, tenantScope, gdprRoutes)
app.use('/api/webhooks',   strictLimiter,  authenticate, tenantScope, webhookRoutes)
app.use('/api/api-keys',   strictLimiter,  authenticate, tenantScope, apiKeyRoutes)
app.use('/api/archives',   apiLimiter,     authenticate, tenantScope, archiveRoutes)
app.use('/api/timestamps', apiLimiter,     authenticate, tenantScope, timestampRoutes)
app.use('/api/metrics',                    authenticate, tenantScope, metricsRoutes)
app.use("/api/donors",              apiLimiter,     authenticate, tenantScope, donorRoutes)
app.use("/api/funding-agreements",  apiLimiter,     authenticate, tenantScope, fundingAgreementRoutes)
app.use("/api/donor-invites",  apiLimiter, donorInviteRoutes)
app.use('/api/donor-auth',     authLimiter, donorAuthRoutes)
app.use('/api/donor/documents', apiLimiter, donorDocumentRoutes)
app.use('/api/setup',          apiLimiter,  setupRoutes)
app.use('/api/billing',        apiLimiter,  billingRoutes)
app.use('/api/team',           apiLimiter,  teamRoutes)
app.use('/api/analytics',     apiLimiter,  authenticate, tenantScope, analyticsRoutes)
app.use('/api/workflow',      apiLimiter,  authenticate, tenantScope, workflowRoutes)
app.use('/api/ocr',          apiLimiter, ocrLimiter, authenticate, tenantScope, ocrRoutes)
app.use('/api/overview',      apiLimiter,  authenticate, tenantScope, overviewRoutes)
app.use('/api/developer',    apiLimiter,  authenticate, tenantScope, developerRoutes)
app.use('/api/cases',        apiLimiter,  authenticate, tenantScope, caseRoutes)
app.use('/api/trust-seal',   apiLimiter,  authenticate, tenantScope, trustSealRoutes)
app.use('/api/budgets',     apiLimiter,  authenticate, tenantScope, budgetRoutes)
app.use('/api/admin',       apiLimiter,  authenticate, adminRoutes)
app.use('/api/public/cases', verifyLimiter,  casePublicRoutes)
app.use('/api/public/seal',  apiLimiter,  sealPublicRoutes)
app.use('/api/public/ocr',   apiLimiter, ocrLimiter, ocrPublicRoutes)
app.use('/api/external',     apiLimiter,  externalAuth, externalApiRoutes)
app.use('/api/internal/seals', apiLimiter,  internalSealRoutes)
app.use('/api/donor',          apiLimiter,  donorPortalRoutes)
app.use('/api/ngo/donor-challenges', apiLimiter, ngoChallengeRoutes)
app.use('/api/ngo/deliverables', apiLimiter, ngoDeliverableRoutes)
app.use('/api/ngo/milestones', apiLimiter, ngoMilestoneRoutes)

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, path: req.path })
  res.status(500).json({ error: 'Internal server error' })
})

startAnchorScheduler()

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

app.listen(5050, () => {
  logger.info('Server running on port 5050', {
    env:  process.env.NODE_ENV || 'development',
    docs: 'http://localhost:5050/api/docs',
    pid:  process.pid,
  })
})

// ─────────────────────────────────────────────────────────────
//  ADD TO prisma/schema.prisma — AuditLog model, add fields:
//
//  timestampToken  String?   // base64 RFC 3161 token
//  timestampedAt   DateTime? // when TSA stamped it
//  tsaUrl          String?   // which TSA issued it
//  timestampStatus String?   @default("pending")
// ─────────────────────────────────────────────────────────────
