// ─────────────────────────────────────────────────────────────
//  routes/ssoAdminRoutes.js — SSO configuration admin routes
//  Auth: NGO JWT + system:admin permission
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')

router.use(authenticate, tenantScope)

// GET /api/admin/sso/config — get SSO config for tenant
router.get('/config', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const configs = await prisma.$queryRawUnsafe(
      `SELECT id, "tenantId", provider, "isEnabled", "entryPoint", issuer, "clientId", "callbackUrl", "metadataUrl", "createdAt", "updatedAt"
       FROM "SSOConfig" WHERE "tenantId" = $1`, tenantId
    )

    if (!configs.length) {
      return res.json({ config: null, enabled: false })
    }

    // Never return clientSecret or cert in full
    const config = configs[0]
    res.json({
      config: {
        ...config,
        cert: config.cert ? '••• configured •••' : null,
        clientSecret: config.clientSecret ? '••• configured •••' : null
      },
      enabled: config.isEnabled
    })
  } catch (err) {
    console.error('Get SSO config error:', err)
    res.status(500).json({ error: 'Failed to fetch SSO config' })
  }
})

// POST /api/admin/sso/config — create or update SSO config
router.post('/config', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { provider, entryPoint, issuer, cert, clientId, clientSecret, callbackUrl, metadataUrl } = req.body

    if (!provider) return res.status(400).json({ error: 'Provider is required' })
    if (!['SAML', 'GOOGLE', 'MICROSOFT', 'OKTA'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be SAML, GOOGLE, MICROSOFT, or OKTA' })
    }

    // Check if config already exists
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "SSOConfig" WHERE "tenantId" = $1`, tenantId
    )

    let config
    if (existing.length) {
      // Update existing
      config = await prisma.$queryRawUnsafe(`
        UPDATE "SSOConfig" SET
          provider = $1,
          "entryPoint" = COALESCE($2, "entryPoint"),
          issuer = COALESCE($3, issuer),
          cert = COALESCE($4, cert),
          "clientId" = COALESCE($5, "clientId"),
          "clientSecret" = COALESCE($6, "clientSecret"),
          "callbackUrl" = COALESCE($7, "callbackUrl"),
          "metadataUrl" = COALESCE($8, "metadataUrl"),
          "updatedAt" = NOW()
        WHERE "tenantId" = $9
        RETURNING id, "tenantId", provider, "isEnabled", "entryPoint", issuer, "clientId", "callbackUrl", "metadataUrl", "updatedAt"
      `, provider, entryPoint || null, issuer || null, cert || null,
        clientId || null, clientSecret || null, callbackUrl || null, metadataUrl || null, tenantId)
    } else {
      // Create new (isEnabled defaults to false — feature flag)
      config = await prisma.$queryRawUnsafe(`
        INSERT INTO "SSOConfig" ("tenantId", provider, "entryPoint", issuer, cert, "clientId", "clientSecret", "callbackUrl", "metadataUrl")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, "tenantId", provider, "isEnabled", "entryPoint", issuer, "clientId", "callbackUrl", "metadataUrl", "createdAt"
      `, tenantId, provider, entryPoint || null, issuer || null, cert || null,
        clientId || null, clientSecret || null, callbackUrl || null, metadataUrl || null)
    }

    res.json({
      config: {
        ...config[0],
        cert: cert ? '••• configured •••' : null,
        clientSecret: clientSecret ? '••• configured •••' : null
      }
    })
  } catch (err) {
    console.error('Save SSO config error:', err)
    res.status(500).json({ error: 'Failed to save SSO config' })
  }
})

// PUT /api/admin/sso/config/toggle — enable/disable SSO
router.put('/config/toggle', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { enabled } = req.body

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "SSOConfig" WHERE "tenantId" = $1`, tenantId
    )

    if (!existing.length) {
      return res.status(404).json({ error: 'SSO not configured. Save configuration first.' })
    }

    const config = await prisma.$queryRawUnsafe(`
      UPDATE "SSOConfig" SET "isEnabled" = $1, "updatedAt" = NOW()
      WHERE "tenantId" = $2
      RETURNING id, "tenantId", provider, "isEnabled", "updatedAt"
    `, !!enabled, tenantId)

    res.json({ config: config[0] })
  } catch (err) {
    console.error('Toggle SSO error:', err)
    res.status(500).json({ error: 'Failed to toggle SSO' })
  }
})

// DELETE /api/admin/sso/config — remove SSO config
router.delete('/config', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    await prisma.$executeRawUnsafe(`DELETE FROM "SSOConfig" WHERE "tenantId" = $1`, tenantId)
    res.json({ success: true })
  } catch (err) {
    console.error('Delete SSO config error:', err)
    res.status(500).json({ error: 'Failed to delete SSO config' })
  }
})

module.exports = router
