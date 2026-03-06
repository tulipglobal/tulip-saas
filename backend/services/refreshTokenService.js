// ─────────────────────────────────────────────────────────────
//  services/refreshTokenService.js — v1
//
//  SOC 2 CC6.2 compliant token rotation:
//  ✔ Access tokens: 15 min (short-lived JWT)
//  ✔ Refresh tokens: 7 days, single-use, SHA-256 hashed
//  ✔ Token families: reuse attack detection
//  ✔ Family revocation: logout kills all sessions in family
//  ✔ Automatic cleanup of expired tokens
//
//  Flow:
//  1. Login → issue accessToken (15m) + refreshToken (7d)
//  2. Access token expires → POST /api/auth/refresh
//  3. Server validates refreshToken, issues NEW pair, revokes old
//  4. If old token reused → ENTIRE FAMILY revoked (attack detected)
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto')
const jwt    = require('jsonwebtoken')
const prisma = require('../lib/client')
const logger = require('../lib/logger')

const ACCESS_TOKEN_EXPIRY  = process.env.JWT_EXPIRES_IN  || '15m'
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d'
const REFRESH_TOKEN_DAYS   = 7

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex')
}

// ── Issue a new access + refresh token pair ───────────────────
async function issueTokenPair(user, req = null, existingFamily = null) {
  const accessToken = jwt.sign(
    { userId: user.id, tenantId: user.tenantId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  )

  const rawRefresh  = generateRefreshToken()
  const tokenHash   = hashToken(rawRefresh)
  const family      = existingFamily || crypto.randomUUID()
  const expiresAt   = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)

  await prisma.refreshToken.create({
    data: {
      userId:    user.id,
      tenantId:  user.tenantId,
      tokenHash,
      family,
      expiresAt,
      userAgent: req?.headers?.['user-agent'] || null,
      ip:        req?.ip || null,
    }
  })

  logger.info('[auth] Token pair issued', {
    userId:   user.id,
    tenantId: user.tenantId,
    family:   family.slice(0, 8) + '...',
  })

  return {
    accessToken,
    refreshToken: rawRefresh,
    expiresIn:    ACCESS_TOKEN_EXPIRY,
    tokenType:    'Bearer',
  }
}

// ── Rotate a refresh token ────────────────────────────────────
// Called by POST /api/auth/refresh
async function rotateRefreshToken(rawRefreshToken, req = null) {
  const tokenHash = hashToken(rawRefreshToken)

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash }
  })

  // Token not found
  if (!stored) {
    throw new Error('Invalid refresh token')
  }

  // Token already revoked — possible reuse attack
  if (stored.revokedAt) {
    logger.warn('[auth] Refresh token reuse detected — revoking family', {
      family: stored.family,
      userId: stored.userId,
    })
    // Revoke entire family — all sessions from this login invalidated
    await prisma.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data:  { revokedAt: new Date() }
    })
    throw new Error('Token reuse detected — all sessions revoked')
  }

  // Token expired
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data:  { revokedAt: new Date() }
    })
    throw new Error('Refresh token expired')
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: stored.userId }
  })
  if (!user || user.deletedAt) throw new Error('User not found')

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data:  { revokedAt: new Date() }
  })

  // Issue new pair — same family
  const newPair = await issueTokenPair(user, req, stored.family)

  // Link old → new
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data:  { replacedBy: hashToken(newPair.refreshToken) }
  })

  logger.info('[auth] Refresh token rotated', {
    userId:   user.id,
    tenantId: user.tenantId,
    family:   stored.family.slice(0, 8) + '...',
  })

  return { ...newPair, user: { id: user.id, email: user.email, tenantId: user.tenantId } }
}

// ── Revoke all tokens in a family (logout) ────────────────────
async function revokeFamily(rawRefreshToken) {
  if (!rawRefreshToken) return

  const tokenHash = hashToken(rawRefreshToken)
  const stored    = await prisma.refreshToken.findFirst({ where: { tokenHash } })
  if (!stored) return

  const count = await prisma.refreshToken.updateMany({
    where: { family: stored.family, revokedAt: null },
    data:  { revokedAt: new Date() }
  })

  logger.info('[auth] Refresh token family revoked on logout', {
    family:  stored.family.slice(0, 8) + '...',
    revoked: count.count,
  })
}

// ── Cleanup expired tokens (run periodically) ─────────────────
async function cleanupExpiredTokens() {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      ]
    }
  })
  if (result.count > 0) {
    logger.info('[auth] Cleaned up expired refresh tokens', { count: result.count })
  }
}

module.exports = { issueTokenPair, rotateRefreshToken, revokeFamily, cleanupExpiredTokens }
