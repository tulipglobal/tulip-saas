// ─────────────────────────────────────────────────────────────
//  middleware/requestLogger.js — v1
//
//  Logs every HTTP request with method, path, status,
//  duration, userId and tenantId (when available).
//
//  Add to app.js BEFORE routes:
//    app.use(require('./middleware/requestLogger'))
// ─────────────────────────────────────────────────────────────

const logger = require('../lib/logger')

module.exports = (req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const level    = res.statusCode >= 500 ? 'error'
                   : res.statusCode >= 400 ? 'warn'
                   : 'info'

    logger[level](`${req.method} ${req.path}`, {
      status:   res.statusCode,
      duration: `${duration}ms`,
      userId:   req.user?.userId   || null,
      tenantId: req.user?.tenantId || null,
      ip:       req.ip,
    })
  })

  next()
}
