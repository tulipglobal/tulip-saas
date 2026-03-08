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
app.use(cors({ origin: ['http://localhost:3000', 'https://tulipds.com'], credentials: true }))
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
const apiKeyRoutes        = require('./routes/apiKeyRoutes')
const archiveRoutes       = require('./routes/archiveRoutes')
const timestampRoutes     = require('./routes/timestampRoutes')
const verifyRouter        = require('./src/routes/verify')

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
app.use('/api/projects',   apiLimiter,     authenticate, tenantScope, projectRoutes)
app.use('/api/funding-sources', apiLimiter, authenticate, tenantScope, fundingSourceRoutes)
app.use('/api/expenses',   apiLimiter,     authenticate, tenantScope, expenseRoutes)
// Public document view - no auth
app.get('/api/documents/:id/view/public', apiLimiter, async (req, res) => {
  try {
    const prisma = require('./prisma/client')
    const document = await prisma.document.findFirst({ where: { id: req.params.id } })
    if (!document) return res.status(404).json({ error: 'Document not found' })
    const { getPresignedUrl } = require('./lib/s3Upload')
    const url = await getPresignedUrl(document.fileUrl)
    if (!url) return res.status(500).json({ error: 'Could not generate URL' })
    res.json({ url, expiresIn: 3600 })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get document URL' })
  }
})
app.use('/api/documents',  apiLimiter,     authenticate, tenantScope, documentRoutes)
app.use('/api/audit',      apiLimiter,     authenticate, tenantScope, auditRoutes)
app.use('/api/gdpr',       strictLimiter,  authenticate, tenantScope, gdprRoutes)
app.use('/api/webhooks',   strictLimiter,  authenticate, tenantScope, webhookRoutes)
app.use('/api/api-keys',   strictLimiter,  authenticate, tenantScope, apiKeyRoutes)
app.use('/api/archives',   apiLimiter,     authenticate, tenantScope, archiveRoutes)
app.use('/api/timestamps', apiLimiter,     authenticate, tenantScope, timestampRoutes)
app.use('/api/metrics',                    authenticate, tenantScope, metricsRoutes)

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
