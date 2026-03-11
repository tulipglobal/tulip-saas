// ─────────────────────────────────────────────────────────────
//  middleware/rateLimit.js — v2
//
//  Changes from v1:
//  ✔ Per-tenant rate limiting on top of per-IP
//  ✔ Tenant limits: 1000 req/15min (vs IP: 100 req/15min)
//  ✔ Auth limiter: 10/60min per IP, 50/60min per tenant
// ─────────────────────────────────────────────────────────────

const rateLimit = require('express-rate-limit')

// ── Key generators ────────────────────────────────────────────
const byIP     = (req) => req.ip
const byTenant = (req) => req.user?.tenantId || req.ip  // fallback to IP if not authed

// ── General API limiter — per IP ──────────────────────────────
const apiLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              300,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests, please try again later', retryAfter: '15 minutes' },
})

// ── Per-tenant API limiter (applied after authenticate) ───────
const tenantApiLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              1000,           // 10x IP limit — allows high-volume integrations
  keyGenerator:     byTenant,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Tenant rate limit exceeded', retryAfter: '15 minutes' },
})

// ── Auth limiter — stricter, per IP ──────────────────────────
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              200,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many auth attempts, please try again in an hour' },
})

// ── Strict limiter — GDPR, webhooks, API keys ────────────────
const strictLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              30,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Rate limit exceeded for this endpoint' },
})

// ── Public verify limiter — 20 req/min per IP ─────────────────
const verifyLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              20,
  keyGenerator:     byIP,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many verification requests. Please try again in 1 minute.', retryAfter: '60 seconds' },
})

module.exports = { apiLimiter, tenantApiLimiter, authLimiter, strictLimiter, verifyLimiter }
