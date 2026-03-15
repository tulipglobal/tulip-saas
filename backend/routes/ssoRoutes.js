// ─────────────────────────────────────────────────────────────
//  routes/ssoRoutes.js — SSO SAML/OAuth2 routes (feature-flagged)
//
//  SSO is disabled by default per tenant.
//  Enable via: UPDATE "SSOConfig" SET "isEnabled" = true
//              WHERE "tenantId" = '<tenant-id>';
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { issueTokenPair } = require('../services/refreshTokenService')
const { buildCache } = require('../lib/permissionCache')
const { createAuditLog } = require('../services/auditService')

const JWT_SECRET = process.env.JWT_SECRET
const APP_URL = process.env.APP_URL || 'https://app.sealayer.io'

// ── Helper: find or create user from SSO profile ────────────
async function findOrCreateSSOUser(profile, tenantId) {
  const email = profile.email || profile.nameID
  if (!email) throw new Error('SSO profile missing email')

  let user = await prisma.user.findUnique({ where: { email }, include: { roles: { include: { role: true } } } })

  if (user) {
    // Verify user belongs to this tenant
    if (user.tenantId !== tenantId) {
      throw new Error('User belongs to a different tenant')
    }
    // Update name if changed
    if (profile.displayName && profile.displayName !== user.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: profile.displayName },
        include: { roles: { include: { role: true } } }
      })
    }
    return user
  }

  // Create new user with default role
  const defaultRole = await prisma.role.findFirst({
    where: { tenantId, name: { in: ['Viewer', 'Member', 'viewer', 'member'] } }
  })

  user = await prisma.user.create({
    data: {
      email,
      name: profile.displayName || email.split('@')[0],
      password: crypto.randomBytes(64).toString('hex'), // random password (SSO users don't use passwords)
      tenantId,
      completedSetup: true,
    },
    include: { roles: { include: { role: true } } }
  })

  // Assign default role if found
  if (defaultRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: defaultRole.id }
    })
    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } }
    })
  }

  await createAuditLog({
    action: 'SSO_USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    userId: user.id,
    tenantId
  }).catch(() => {})

  return user
}

// ── GET /api/auth/sso/check/:tenantSlug ─────────────────────
// Check if SSO is enabled for a tenant (public, used by login page)
router.get('/check/:tenantSlug', async (req, res) => {
  try {
    const { tenantSlug } = req.params

    // Find tenant by slug or name
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { name: { equals: tenantSlug, mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true }
    })

    if (!tenant) return res.json({ enabled: false })

    const config = await prisma.$queryRawUnsafe(
      `SELECT "isEnabled", provider FROM "SSOConfig" WHERE "tenantId" = $1`, tenant.id
    )

    if (!config.length || !config[0].isEnabled) {
      return res.json({ enabled: false })
    }

    res.json({ enabled: true, provider: config[0].provider, tenantId: tenant.id, tenantName: tenant.name })
  } catch (err) {
    console.error('SSO check error:', err)
    res.json({ enabled: false })
  }
})

// ── GET /api/auth/sso/initiate ──────────────────────────────
// Initiates SSO flow — redirects to IdP
router.get('/initiate', async (req, res) => {
  try {
    const { tenantId } = req.query
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' })

    const configs = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SSOConfig" WHERE "tenantId" = $1 AND "isEnabled" = true`, tenantId
    )
    if (!configs.length) return res.status(404).json({ error: 'SSO not configured for this tenant' })

    const config = configs[0]
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64url')

    if (config.provider === 'GOOGLE') {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.callbackUrl || `${APP_URL}/api/auth/sso/callback/google`,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'offline',
        prompt: 'select_account'
      })
      return res.json({ redirectUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
    }

    if (config.provider === 'MICROSOFT') {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.callbackUrl || `${APP_URL}/api/auth/sso/callback/microsoft`,
        response_type: 'code',
        scope: 'openid email profile User.Read',
        state,
        response_mode: 'query'
      })
      return res.json({ redirectUrl: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` })
    }

    if (config.provider === 'SAML' || config.provider === 'OKTA') {
      // For SAML, redirect to the entry point with a RelayState
      if (!config.entryPoint) return res.status(400).json({ error: 'SAML entry point not configured' })
      const params = new URLSearchParams({ RelayState: state })
      return res.json({ redirectUrl: `${config.entryPoint}?${params}` })
    }

    res.status(400).json({ error: `Unsupported provider: ${config.provider}` })
  } catch (err) {
    console.error('SSO initiate error:', err)
    res.status(500).json({ error: 'Failed to initiate SSO' })
  }
})

// ── GET /api/auth/sso/callback/google ───────────────────────
// Google OAuth2 callback
router.get('/callback/google', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code || !state) return res.redirect(`${APP_URL}/login?error=sso_failed`)

    const { tenantId } = JSON.parse(Buffer.from(state, 'base64url').toString())
    const configs = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SSOConfig" WHERE "tenantId" = $1 AND "isEnabled" = true AND provider = 'GOOGLE'`, tenantId
    )
    if (!configs.length) return res.redirect(`${APP_URL}/login?error=sso_not_configured`)

    const config = configs[0]

    // Exchange code for tokens
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl || `${APP_URL}/api/auth/sso/callback/google`,
        grant_type: 'authorization_code'
      })
    })

    const tokenData = await tokenResp.json()
    if (!tokenData.access_token) return res.redirect(`${APP_URL}/login?error=sso_token_failed`)

    // Get user info
    const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userInfo = await userResp.json()

    const user = await findOrCreateSSOUser({
      email: userInfo.email,
      displayName: userInfo.name,
      nameID: userInfo.email
    }, tenantId)

    await buildCache(user.id, user.tenantId)
    await createAuditLog({ action: 'SSO_LOGIN_SUCCESS', entityType: 'User', entityId: user.id, userId: user.id, tenantId }).catch(() => {})

    const tokens = await issueTokenPair(user, req)

    // Redirect to frontend with tokens in URL hash (not query params for security)
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id, email: user.email, name: user.name,
      tenantId: user.tenantId, preferredLanguage: user.preferredLanguage || 'en'
    }))
    res.redirect(`${APP_URL}/login?sso=success&accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&user=${userData}`)
  } catch (err) {
    console.error('Google SSO callback error:', err)
    res.redirect(`${APP_URL}/login?error=sso_failed`)
  }
})

// ── GET /api/auth/sso/callback/microsoft ────────────────────
// Microsoft OAuth2 callback
router.get('/callback/microsoft', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code || !state) return res.redirect(`${APP_URL}/login?error=sso_failed`)

    const { tenantId } = JSON.parse(Buffer.from(state, 'base64url').toString())
    const configs = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SSOConfig" WHERE "tenantId" = $1 AND "isEnabled" = true AND provider = 'MICROSOFT'`, tenantId
    )
    if (!configs.length) return res.redirect(`${APP_URL}/login?error=sso_not_configured`)

    const config = configs[0]

    const tokenResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl || `${APP_URL}/api/auth/sso/callback/microsoft`,
        grant_type: 'authorization_code',
        scope: 'openid email profile User.Read'
      })
    })

    const tokenData = await tokenResp.json()
    if (!tokenData.access_token) return res.redirect(`${APP_URL}/login?error=sso_token_failed`)

    const userResp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userInfo = await userResp.json()

    const user = await findOrCreateSSOUser({
      email: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName,
      nameID: userInfo.mail || userInfo.userPrincipalName
    }, tenantId)

    await buildCache(user.id, user.tenantId)
    await createAuditLog({ action: 'SSO_LOGIN_SUCCESS', entityType: 'User', entityId: user.id, userId: user.id, tenantId }).catch(() => {})

    const tokens = await issueTokenPair(user, req)
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id, email: user.email, name: user.name,
      tenantId: user.tenantId, preferredLanguage: user.preferredLanguage || 'en'
    }))
    res.redirect(`${APP_URL}/login?sso=success&accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&user=${userData}`)
  } catch (err) {
    console.error('Microsoft SSO callback error:', err)
    res.redirect(`${APP_URL}/login?error=sso_failed`)
  }
})

// ── POST /api/auth/sso/callback/saml ────────────────────────
// SAML assertion consumer service (ACS)
router.post('/callback/saml', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { SAMLResponse, RelayState } = req.body
    if (!SAMLResponse || !RelayState) return res.redirect(`${APP_URL}/login?error=sso_failed`)

    const { tenantId } = JSON.parse(Buffer.from(RelayState, 'base64url').toString())
    const configs = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SSOConfig" WHERE "tenantId" = $1 AND "isEnabled" = true AND provider IN ('SAML', 'OKTA')`, tenantId
    )
    if (!configs.length) return res.redirect(`${APP_URL}/login?error=sso_not_configured`)

    const config = configs[0]

    // Decode SAML response
    const xml = Buffer.from(SAMLResponse, 'base64').toString('utf8')

    // Extract email and name from SAML assertion (basic XML parsing)
    const emailMatch = xml.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)</)
      || xml.match(/emailAddress[^>]*>([^<]+)</)
      || xml.match(/<(?:saml2?:)?Attribute[^>]*Name="email"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)</)
    const nameMatch = xml.match(/<(?:saml2?:)?Attribute[^>]*Name="(?:displayName|name|firstName)"[^>]*>[\s\S]*?<(?:saml2?:)?AttributeValue[^>]*>([^<]+)</)

    const email = emailMatch?.[1]
    if (!email) return res.redirect(`${APP_URL}/login?error=sso_no_email`)

    // Verify issuer matches config
    if (config.issuer) {
      const issuerMatch = xml.match(/<(?:saml2?:)?Issuer[^>]*>([^<]+)</)
      if (issuerMatch && issuerMatch[1] !== config.issuer) {
        console.warn('SAML issuer mismatch:', issuerMatch[1], '!=', config.issuer)
      }
    }

    const user = await findOrCreateSSOUser({
      email,
      displayName: nameMatch?.[1] || email.split('@')[0],
      nameID: email
    }, tenantId)

    await buildCache(user.id, user.tenantId)
    await createAuditLog({ action: 'SSO_LOGIN_SUCCESS', entityType: 'User', entityId: user.id, userId: user.id, tenantId }).catch(() => {})

    const tokens = await issueTokenPair(user, req)
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id, email: user.email, name: user.name,
      tenantId: user.tenantId, preferredLanguage: user.preferredLanguage || 'en'
    }))
    res.redirect(`${APP_URL}/login?sso=success&accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&user=${userData}`)
  } catch (err) {
    console.error('SAML SSO callback error:', err)
    res.redirect(`${APP_URL}/login?error=sso_failed`)
  }
})

module.exports = router
