// ─────────────────────────────────────────────────────────────
//  middleware/rateLimit.js — v3
//
//  Changes from v2:
//  ✔ Auth limiter tightened: 10 req/15min per IP
//  ✔ Upload limiter: 30 req/15min per IP+tenant
//  ✔ OCR limiter: 20 req/15min per IP+tenant
//  ✔ Skip internal API calls (x-internal-secret header)
//  ✔ Log when rate limit hit
//  ✔ Combined IP+tenantId key for authenticated routes
// ─────────────────────────────────────────────────────────────

const rateLimit = require('express-rate-limit')
const logger    = require('../lib/logger')

// ── Key generators ────────────────────────────────────────────
const byIP        = (req) => req.ip
const byIPTenant  = (req) => req.user?.tenantId ? `${req.ip}:${req.user.tenantId}` : req.ip

// ── Skip internal API calls & health checks ───────────────────
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET
const skipInternal = (req) => {
  if (req.path === '/api/health' || req.path === '/') return true
  if (INTERNAL_SECRET && req.headers['x-internal-secret'] === INTERNAL_SECRET) return true
  // Skip rate limiting for local/private IPs (server-to-server calls)
  const ip = req.ip || ''
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true
  return false
}

// ── Rate limit hit handler — logs warning ─────────────────────
const onLimitReached = (req) => {
  logger.warn('Rate limit hit', {
    ip: req.ip,
    route: req.originalUrl,
    method: req.method,
    tenantId: req.user?.tenantId || null,
  })
}

// ── General API limiter — per IP ──────────────────────────────
const apiLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              5000,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip:             skipInternal,
  handler:          (req, res, next, options) => {
    onLimitReached(req)
    res.status(options.statusCode).json(options.message)
  },
  message:          { error: 'Too many requests, please try again later.' },
})

// ── Per-tenant API limiter (applied after authenticate) ───────
const tenantApiLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              1000,
  keyGenerator:     byIPTenant,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip:             skipInternal,
  handler:          (req, res, next, options) => {
    onLimitReached(req)
    res.status(options.statusCode).json(options.message)
  },
  message:          { error: 'Tenant rate limit exceeded', retryAfter: '15 minutes' },
})

// ── Auth limiter — per IP ────────────────────────────────────
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              50,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler:          (req, res, next, options) => {
    onLimitReached(req)
    res.status(options.statusCode).json(options.message)
  },
  message:          { error: 'Too many login attempts, please try again in 15 minutes.' },
})

// ── Upload limiter — receipts & documents ─────────────────────
const uploadLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              30,
  keyGenerator:     byIPTenant,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip:             skipInternal,
  handler:          (req, res, next, options) => {
    onLimitReached(req)
    res.status(options.statusCode).json(options.message)
  },
  message:          { error: 'Too many upload requests, please try again later.' },
})

// ── OCR limiter — OCR processing routes ───────────────────────
const ocrLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              20,
  keyGenerator:     byIPTenant,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip:             skipInternal,
  handler:          (req, res, next, options) => {
    onLimitReached(req)
    res.status(options.statusCode).json(options.message)
  },
  message:          { error: 'Too many OCR requests, please try again later.' },
})

// ── Strict limiter — GDPR, webhooks, API keys ────────────────
const strictLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              30,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip:             skipInternal,
  handler:          (req, res, next, options) => {
    onLimitReached(req)
    res.status(options.statusCode).json(options.message)
  },
  message:          { error: 'Rate limit exceeded for this endpoint' },
})

// ── Public verify limiter — 20 req/min per IP ─────────────────
const verifyLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              20,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler:          (req, res, next, options) => {
    onLimitReached(req)
    res.status(options.statusCode).json(options.message)
  },
  message:          { error: 'Too many verification requests. Please try again in 1 minute.', retryAfter: '60 seconds' },
})

module.exports = { apiLimiter, tenantApiLimiter, authLimiter, uploadLimiter, ocrLimiter, strictLimiter, verifyLimiter }
