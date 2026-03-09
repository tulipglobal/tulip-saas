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
const { sendEmail } = require('../services/emailService')

exports.register = async (req, res) => {
  try {
    const { email, name, password, organisationName, tenantType = 'NGO', country } = req.body

    if (!email || !name || !password || !organisationName) {
      return res.status(400).json({ error: 'email, name, password and organisationName are required' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already registered' })

    // Generate tenant code e.g. TNGO-26-X7K2M
    const year = new Date().getFullYear().toString().slice(-2)
    const type = tenantType.toUpperCase().slice(0, 3)
    const prefix = `T${type}`

    // Get or create counter for this type+year
    const counter = await prisma.tenantCounter.upsert({
      where: { tenantType_year: { tenantType: type, year } },
      update: { count: { increment: 1 } },
      create: { tenantType: type, year, count: 1 }
    })

    // Generate 5-char nanoid
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const nanoId = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const code = `${prefix}-${year}-${nanoId}`

    // Create slug from organisation name
    const baseSlug = organisationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const existingTenant = await prisma.tenant.findUnique({ where: { slug: baseSlug } })
    const slug = existingTenant ? `${baseSlug}-${Date.now()}` : baseSlug

    // Create tenant with 14-day free trial
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const tenant = await prisma.tenant.create({
      data: {
        code,
        tenantType: type,
        sequence: counter.count,
        name: organisationName,
        slug,
        status: 'active',
        country: country || null,
        completedSetup: false,
        plan: 'FREE',
        trialEndsAt,
      }
    })

    const hashed = await bcrypt.hash(password, 10)

    // Create admin role for this tenant and assign all permissions
    const role = await prisma.role.create({
      data: { name: 'admin', tenantId: tenant.id }
    })

    const allPermissions = await prisma.permission.findMany({ select: { id: true } })
    if (allPermissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: allPermissions.map(p => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      })
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email, name, password: hashed, tenantId: tenant.id,
        roles: { create: { roleId: role.id, tenantId: tenant.id } }
      }
    })

    await buildCache(user.id, tenant.id)
    await createAuditLog({ action: 'USER_REGISTERED', entityType: 'User', entityId: user.id, userId: user.id, tenantId: tenant.id })
    siemEmit('auth.register', { userId: user.id, tenantId: tenant.id, email }, req).catch(() => {})

    const tokens = await issueTokenPair(user, req)

    // Send welcome email (non-blocking)
    const firstName = name.split(' ')[0]
    console.log('[auth/register] SENDING welcome email to', email, '- firstName:', firstName, '- org:', organisationName)
    sendEmail({
      to: email,
      subject: `Welcome to Tulip DS, ${firstName}!`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
          <div style="text-align: center; padding: 24px 0;">
            <h1 style="color: #0c7aed; font-size: 24px; margin: 0;">Welcome to Tulip DS</h1>
          </div>
          <p>Hi ${firstName},</p>
          <p>Your organisation <strong>${organisationName}</strong> has been created on Tulip DS. Your workspace code is <code>${code}</code>.</p>
          <p>Here's what you can do next:</p>
          <ol>
            <li><strong>Complete your organisation profile</strong> — add your logo, website, and registration details</li>
            <li><strong>Create your first project</strong> — start tracking expenses and documents</li>
            <li><strong>Invite your team</strong> — add up to 3 colleagues to get started</li>
          </ol>
          <p style="margin-top: 24px;">
            <a href="${process.env.APP_URL || 'https://app.tulipds.com'}/setup"
               style="background: #0c7aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Complete Setup →
            </a>
          </p>
          <p style="color: #64748b; font-size: 13px; margin-top: 32px;">
            Every record you create is cryptographically verified and anchored to the blockchain — giving your donors proof they can trust.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Tulip DS</p>
        </div>
      `
    }).then(() => {
      console.log('[auth/register] welcome email sent to', email)
    }).catch(err => {
      console.error('[auth/register] welcome email FAILED for', email, ':', err.message, err.stack)
    })

    res.status(201).json({
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name, tenantId: tenant.id, tenantCode: tenant.code, completedSetup: false }
    })
  } catch (err) {
    console.error('[auth/register]', err)
    res.status(500).json({ error: 'Registration failed', detail: err.message })
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

// ── PATCH /api/auth/profile ────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body
    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing && existing.id !== req.user.userId) {
        return res.status(400).json({ error: 'Email already in use' })
      }
      data.email = email.trim().toLowerCase()
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' })

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: { id: true, name: true, email: true, tenantId: true, createdAt: true },
    })
    res.json(user)
  } catch (err) {
    console.error('[auth/profile]', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
}

// ── PATCH /api/auth/password ──────────────────────────────────
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.userId }, data: { password: hashed } })
    await createAuditLog({ action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id, userId: user.id, tenantId: user.tenantId }).catch(() => {})

    res.json({ success: true })
  } catch (err) {
    console.error('[auth/password]', err)
    res.status(500).json({ error: 'Failed to update password' })
  }
}

exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:   { id: req.user.userId },
      include: { roles: { include: { role: true } }, tenant: { select: { name: true, completedSetup: true, plan: true, planStatus: true, trialEndsAt: true } } }
    })
    if (!user || user.deletedAt) return res.status(404).json({ error: 'User not found' })
    const trialActive = user.tenant?.trialEndsAt && new Date(user.tenant.trialEndsAt) > new Date()
    const trialDaysLeft = trialActive
      ? Math.ceil((new Date(user.tenant.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0
    res.json({ id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, tenantName: user.tenant?.name || null, completedSetup: user.tenant?.completedSetup ?? true, plan: user.tenant?.plan || 'FREE', planStatus: user.tenant?.planStatus || 'active', trialEndsAt: user.tenant?.trialEndsAt || null, trialActive, trialDaysLeft, createdAt: user.createdAt, roles: user.roles.map(r => r.role.name) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}
