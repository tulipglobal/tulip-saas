// ─────────────────────────────────────────────────────────────
//  middleware/authenticate.js — v2
//
//  Supports two authentication methods:
//
//  1. JWT Bearer token (existing — users via login)
//     Authorization: Bearer eyJhbGci...
//
//  2. API Key (new — machine-to-machine)
//     Authorization: ApiKey tl_live_ab12cd34...
//
//  Both populate req.user with:
//    { userId, tenantId, authMethod, permissions? }
//
//  API key requests also populate req.apiKey with the key record.
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken')
const { validateApiKey } = require('../services/apiKeyService')

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization']

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' })
  }

  // ── API Key authentication ────────────────────────────────
  if (authHeader.startsWith('ApiKey ')) {
    const rawKey = authHeader.slice(7).trim()

    try {
      const apiKey = await validateApiKey(rawKey)

      if (!apiKey) {
        return res.status(401).json({ error: 'Invalid or revoked API key' })
      }

      // Populate req.user — same shape as JWT for middleware compatibility
      req.user = {
        userId:     apiKey.createdBy,
        tenantId:   apiKey.tenantId,
        authMethod: 'apikey',
        keyId:      apiKey.id,
        permissions: apiKey.permissions,  // key-scoped permissions
      }
      req.apiKey = apiKey

      return next()

    } catch (err) {
      return res.status(500).json({ error: 'API key validation failed' })
    }
  }

  // ── JWT Bearer authentication ─────────────────────────────
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null

  if (!token) {
    return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token> or ApiKey <key>' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { ...decoded, authMethod: 'jwt' }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
