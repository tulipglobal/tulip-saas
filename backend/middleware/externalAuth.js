// middleware/externalAuth.js
// Authenticates external API requests using API keys (Bearer or ApiKey header)
// Logs usage to ApiUsageLog

const { validateApiKey } = require('../services/apiKeyService')
const prisma = require('../lib/client')
const logger = require('../lib/logger')

/**
 * Authenticate external API requests via API key.
 * Accepts both:
 *   Authorization: Bearer tl_live_...
 *   Authorization: ApiKey tl_live_...
 */
async function externalAuth(req, res, next) {
  const start = Date.now()
  const authHeader = req.headers['authorization']

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header. Use: Bearer <api_key>' })
  }

  let rawKey = null
  if (authHeader.startsWith('ApiKey ')) {
    rawKey = authHeader.slice(7).trim()
  } else if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    // Only treat as API key if it starts with tl_live_
    if (token.startsWith('tl_live_')) {
      rawKey = token
    }
  }

  if (!rawKey) {
    return res.status(401).json({ error: 'Invalid API key format. Keys start with tl_live_' })
  }

  try {
    const apiKey = await validateApiKey(rawKey)

    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid, expired, or revoked API key' })
    }

    req.user = {
      userId: apiKey.createdBy,
      tenantId: apiKey.tenantId,
      authMethod: 'apikey',
      keyId: apiKey.id,
      permissions: apiKey.permissions,
    }
    req.apiKey = apiKey
    req._apiStart = start

    // Log usage after response completes
    res.on('finish', () => {
      const responseTime = Date.now() - start
      prisma.apiUsageLog.create({
        data: {
          apiKeyId: apiKey.id,
          tenantId: apiKey.tenantId,
          endpoint: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          errorMessage: res.statusCode >= 400 ? res.statusMessage || null : null,
        }
      }).catch(err => {
        logger.error({ err: err.message }, 'Failed to log API usage')
      })
    })

    next()
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'External auth failed')
    return res.status(500).json({ error: 'Authentication failed' })
  }
}

module.exports = externalAuth
