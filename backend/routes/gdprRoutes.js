// ─────────────────────────────────────────────────────────────
//  routes/gdprRoutes.js — v1
//
//  GDPR endpoints — all require authentication + tenantScope.
//  Register in app.js:
//    app.use('/api/gdpr', authenticate, tenantScope, gdprRoutes)
//
//  Endpoints:
//    GET  /api/gdpr/export          — export your own data
//    GET  /api/gdpr/export/:userId  — admin exports any user's data
//    POST /api/gdpr/erase/:userId   — admin erases a user
//    POST /api/gdpr/consent         — log a consent event
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const { exportUserData, eraseUser, logConsent } = require('../services/gdprService')

// ── Export own data (any authenticated user) ──────────────────
router.get('/export', async (req, res) => {
  try {
    const data = await exportUserData(req.user.userId, req.user.tenantId)
    res.setHeader('Content-Disposition', `attachment; filename="tulip-data-export-${req.user.userId}.json"`)
    res.json(data)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── Export any user's data (admin only) ───────────────────────
router.get('/export/:userId', can('users:read'), async (req, res) => {
  try {
    const data = await exportUserData(req.params.userId, req.user.tenantId)
    res.setHeader('Content-Disposition', `attachment; filename="tulip-data-export-${req.params.userId}.json"`)
    res.json(data)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── Erase a user (admin only) ─────────────────────────────────
router.post('/erase/:userId', can('users:write'), async (req, res) => {
  try {
    // Prevent self-erasure via this endpoint
    if (req.params.userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot erase your own account via admin endpoint' })
    }

    const result = await eraseUser(
      req.params.userId,
      req.user.tenantId,
      req.user.userId   // requestedBy — logged in audit trail
    )
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── Log consent ───────────────────────────────────────────────
router.post('/consent', async (req, res) => {
  try {
    const { consentType, granted } = req.body

    if (!consentType || typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'consentType (string) and granted (boolean) are required' })
    }

    const log = await logConsent(
      req.user.userId,
      req.user.tenantId,
      consentType,
      granted
    )
    res.json({ logged: true, action: log.action, consentType, granted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
