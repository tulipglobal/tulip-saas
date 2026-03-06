// ─────────────────────────────────────────────────────────────
//  controllers/authController.js — v5
//
//  Changes from v4:
//  ✔ Login issues accessToken (15m) + refreshToken (7d)
//  ✔ POST /refresh rotates refresh token
//  ✔ Logout revokes entire token family
// ─────────────────────────────────────────────────────────────

require('dotenv').config()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const prisma  = require('../prisma/client')
const { buildCache }           = require('../services/permissionCacheService')
const { createAuditLog }       = require('../services/auditService')
const { emit: siemEmit }       = require('../services/siemService')
const { issueTokenPair, rotateRefreshToken, revokeFamily } = require('../services/refreshTokenService')

exports.register = async (req, res) => {
  try {
    const { email, name, password, tenantId } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 10)

    let role = await prisma.role.findFirst({ where: { name: 'member', tenantId } })
    if (!role) role = await prisma.role.create({ data: { name: 'member', tenantId } })

    const user = await prisma.user.create({
      data: {
        email, name, password: hashed, tenantId,
        roles: { create: { roleId: role.id, tenantId } }
      }
    })

    await buildCache(user.id, tenantId)
    await createAuditLog({ action: 'USER_REGISTERED', entityType: 'User', entityId: user.id, userId: user.id, tenantId })
    siemEmit('auth.register', { userId: user.id, tenantId, email }, req).catch(() => {})

    const tokens = await issueTokenPair(user, req)

    res.status(201).json({
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name }
    })
  } catch (err) {
    console.error('[auth/register]', err)
    res.status(500).json({ error: 'Registration failed' })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({
      where:   { email },
      include: { roles: { include: { role: true } } }
    })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      siemEmit('auth.login_failed', { tenantId: user?.tenantId || null, userId: null, email }, req).catch(() => {})
      if (user) await createAuditLog({ action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id, userId: null, tenantId: user.tenantId }).catch(() => {})
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (user.deletedAt) return res.status(401).json({ error: 'Invalid credentials' })

    await buildCache(user.id, user.tenantId)
    await createAuditLog({ action: 'LOGIN_SUCCESS', entityType: 'User', entityId: user.id, userId: user.id, tenantId: user.tenantId }).catch(() => {})
    siemEmit('auth.login_success', { userId: user.id, tenantId: user.tenantId }, req).catch(() => {})

    const tokens = await issueTokenPair(user, req)

    res.json({
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId }
    })
  } catch (err) {
    console.error('[auth/login]', err)
    res.status(500).json({ error: 'Login failed' })
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' })

    const result = await rotateRefreshToken(refreshToken, req)

    siemEmit('auth.token_refreshed', {
      userId:   result.user.id,
      tenantId: result.user.tenantId,
    }, req).catch(() => {})

    res.json(result)
  } catch (err) {
    const isAttack = err.message.includes('reuse detected')
    siemEmit('auth.token_reuse_detected', { error: err.message }, req).catch(() => {})
    res.status(401).json({
      error:   isAttack ? 'Security alert: token reuse detected' : err.message,
      revoked: isAttack,
    })
  }
}

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body

    // Revoke the entire refresh token family
    if (refreshToken) await revokeFamily(refreshToken)

    await createAuditLog({
      action: 'LOGOUT', entityType: 'User',
      entityId: req.user.userId, userId: req.user.userId, tenantId: req.user.tenantId,
    }).catch(() => {})

    siemEmit('auth.logout', { userId: req.user.userId, tenantId: req.user.tenantId }, req).catch(() => {})

    res.json({ success: true, message: 'Logged out' })
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' })
  }
}

exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:   { id: req.user.userId },
      include: { roles: { include: { role: true } } }
    })
    if (!user || user.deletedAt) return res.status(404).json({ error: 'User not found' })
    res.json({ id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, roles: user.roles.map(r => r.role.name) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}
