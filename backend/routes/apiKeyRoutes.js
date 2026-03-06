// ─────────────────────────────────────────────────────────────
//  routes/apiKeyRoutes.js — v1
//
//  Register in app.js:
//    app.use('/api/api-keys', authenticate, tenantScope, apiKeyRoutes)
//
//  Endpoints:
//    GET    /api/api-keys              — list keys for tenant
//    POST   /api/api-keys              — create new key
//    DELETE /api/api-keys/:id          — revoke key
//    POST   /api/api-keys/:id/rotate   — rotate key
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  createApiKey, listApiKeys, revokeApiKey, rotateApiKey
} = require('../services/apiKeyService')

const VALID_PERMISSIONS = [
  'audit:read', 'audit:write',
  'verify:read',
  'projects:read', 'projects:write',
  'funding:read', 'funding:write',
  'expenses:read', 'expenses:write',
  'documents:read', 'documents:write',
  'webhooks:read',
]

// ── List API keys ─────────────────────────────────────────────
/**
 * @openapi
 * /api/api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: List all API keys for the tenant
 *     responses:
 *       200:
 *         description: Array of API key records (secrets never returned)
 */
router.get('/', can('keys:manage'), async (req, res) => {
  try {
    const keys = await listApiKeys(req.tenantId)
    res.json(keys)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Create API key ────────────────────────────────────────────
/**
 * @openapi
 * /api/api-keys:
 *   post:
 *     tags: [API Keys]
 *     summary: Create a new scoped API key
 *     description: The full key is returned ONCE. Store it securely.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, example: "CI Pipeline Key" }
 *               permissions: { type: array, items: { type: string }, example: ["audit:write","verify:read"] }
 *               expiresAt:   { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Key created — full secret returned once only
 */
router.post('/', can('keys:manage'), async (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body

    if (!name) return res.status(400).json({ error: 'name is required' })

    // Validate permissions
    if (permissions) {
      const invalid = permissions.filter(p => !VALID_PERMISSIONS.includes(p))
      if (invalid.length > 0) {
        return res.status(400).json({
          error:   `Invalid permissions: ${invalid.join(', ')}`,
          valid:   VALID_PERMISSIONS,
        })
      }
    }

    const result = await createApiKey({
      tenantId:    req.tenantId,
      createdBy:   req.user.userId,
      name,
      permissions: permissions || VALID_PERMISSIONS,
      expiresAt:   expiresAt ? new Date(expiresAt) : null,
    })

    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Revoke API key ────────────────────────────────────────────
/**
 * @openapi
 * /api/api-keys/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: Revoke an API key immediately
 */
router.delete('/:id', can('keys:manage'), async (req, res) => {
  try {
    const result = await revokeApiKey(req.params.id, req.tenantId)
    res.json({ revoked: true, ...result })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── Rotate API key ────────────────────────────────────────────
/**
 * @openapi
 * /api/api-keys/{id}/rotate:
 *   post:
 *     tags: [API Keys]
 *     summary: Rotate an API key — revokes old, returns new
 */
router.post('/:id/rotate', can('keys:manage'), async (req, res) => {
  try {
    const result = await rotateApiKey(req.params.id, req.tenantId, req.user.userId)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
