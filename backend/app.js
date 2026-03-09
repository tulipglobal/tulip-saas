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
app.use(cors({ origin: ['http://localhost:3000', 'https://tulipds.com', 'https://www.tulipds.com', 'https://donor.tulipds.com'], credentials: true }))
app.set('trust proxy', 1)
app.use(express.json())
app.use(require('./middleware/requestLogger'))

const { apiLimiter, authLimiter, strictLimiter } = require('./middleware/rateLimit')
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
const apiKeyRoutes        = require('./routes/apiKeyRoutes')
const archiveRoutes       = require('./routes/archiveRoutes')
const timestampRoutes     = require('./routes/timestampRoutes')
const verifyRouter        = require('./src/routes/verify')
const tenantPublicRoutes  = require('./routes/tenantPublicRoutes')

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
app.use('/api/verify',     verifyRouter)
app.use('/api/tenants/public', apiLimiter, tenantPublicRoutes)
app.use('/api/projects',   apiLimiter,     authenticate, tenantScope, projectRoutes)
app.use('/api/funding-sources', apiLimiter, authenticate, tenantScope, fundingSourceRoutes)
app.use('/api/expenses',   apiLimiter,     authenticate, tenantScope, expenseRoutes)
app.use('/api/documents',  apiLimiter,     authenticate, tenantScope, documentRoutes)
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
