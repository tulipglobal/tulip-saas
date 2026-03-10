// routes/developerRoutes.js
// Developer API portal — key management and usage statistics
// Authenticated via JWT (internal dashboard users)

const express = require('express')
const router  = express.Router()
const prisma  = require('../lib/client')
const { can } = require('../middleware/permission')
const { createApiKey, listApiKeys, revokeApiKey } = require('../services/apiKeyService')
const logger  = require('../lib/logger')

const VALID_PERMISSIONS = [
  'documents:read', 'documents:write',
  'audit:read', 'audit:write',
  'verify:read',
  'projects:read', 'projects:write',
  'funding:read', 'funding:write',
  'expenses:read', 'expenses:write',
  'webhooks:read',
]

// ── POST /api/developer/keys — create new API key ───────────────────────────
router.post('/keys', can('keys:manage'), async (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    if (permissions) {
      const invalid = permissions.filter(p => !VALID_PERMISSIONS.includes(p))
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid permissions: ${invalid.join(', ')}`, valid: VALID_PERMISSIONS })
      }
    }

    const result = await createApiKey({
      tenantId: req.user.tenantId,
      createdBy: req.user.userId,
      name,
      permissions: permissions || ['documents:read', 'documents:write'],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })

    res.status(201).json({ data: result })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Create API key failed')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/developer/keys — list all keys ─────────────────────────────────
router.get('/keys', can('keys:manage'), async (req, res) => {
  try {
    const keys = await listApiKeys(req.user.tenantId)
    res.json({ data: keys })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'List API keys failed')
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/developer/keys/:id — revoke a key ──────────────────────────
router.delete('/keys/:id', can('keys:manage'), async (req, res) => {
  try {
    const result = await revokeApiKey(req.params.id, req.user.tenantId)
    res.json({ data: result, revoked: true })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Revoke API key failed')
    res.status(400).json({ error: err.message })
  }
})

// ── GET /api/developer/usage — usage statistics ─────────────────────────────
router.get('/usage', can('keys:manage'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get all active keys for tenant
    const keys = await prisma.apiKey.findMany({
      where: { tenantId },
      select: { id: true, name: true, prefix: true }
    })
    const keyIds = keys.map(k => k.id)

    if (keyIds.length === 0) {
      return res.json({
        data: {
          today: { total: 0, success: 0, errors: 0 },
          thisMonth: { total: 0, success: 0, errors: 0 },
          successRate: 100,
          avgResponseTime: 0,
          byEndpoint: [],
          byKey: [],
          recentCalls: [],
        }
      })
    }

    // Today's stats
    const todayLogs = await prisma.apiUsageLog.findMany({
      where: { tenantId, createdAt: { gte: startOfDay } }
    })

    const todayTotal = todayLogs.length
    const todaySuccess = todayLogs.filter(l => l.statusCode < 400).length
    const todayErrors = todayTotal - todaySuccess

    // Month stats
    const monthLogs = await prisma.apiUsageLog.findMany({
      where: { tenantId, createdAt: { gte: startOfMonth } }
    })

    const monthTotal = monthLogs.length
    const monthSuccess = monthLogs.filter(l => l.statusCode < 400).length
    const monthErrors = monthTotal - monthSuccess
    const successRate = monthTotal > 0 ? Math.round((monthSuccess / monthTotal) * 100) : 100
    const avgResponseTime = monthTotal > 0 ? Math.round(monthLogs.reduce((sum, l) => sum + l.responseTime, 0) / monthTotal) : 0

    // By endpoint
    const endpointMap = {}
    for (const log of monthLogs) {
      const ep = log.endpoint
      if (!endpointMap[ep]) endpointMap[ep] = { endpoint: ep, total: 0, success: 0, errors: 0 }
      endpointMap[ep].total++
      if (log.statusCode < 400) endpointMap[ep].success++
      else endpointMap[ep].errors++
    }
    const byEndpoint = Object.values(endpointMap).sort((a, b) => b.total - a.total)

    // By key
    const keyMap = {}
    for (const log of monthLogs) {
      if (!keyMap[log.apiKeyId]) {
        const key = keys.find(k => k.id === log.apiKeyId)
        keyMap[log.apiKeyId] = { keyId: log.apiKeyId, name: key?.name || 'Unknown', prefix: key?.prefix || '—', total: 0 }
      }
      keyMap[log.apiKeyId].total++
    }
    const byKey = Object.values(keyMap).sort((a, b) => b.total - a.total)

    // Recent calls (last 20)
    const recentCalls = await prisma.apiUsageLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, endpoint: true, method: true, statusCode: true, responseTime: true, createdAt: true, apiKeyId: true }
    })

    // Enrich with key names
    const enrichedRecent = recentCalls.map(c => {
      const key = keys.find(k => k.id === c.apiKeyId)
      return { ...c, keyName: key?.name || 'Unknown', keyPrefix: key?.prefix || '—' }
    })

    res.json({
      data: {
        today: { total: todayTotal, success: todaySuccess, errors: todayErrors },
        thisMonth: { total: monthTotal, success: monthSuccess, errors: monthErrors },
        successRate,
        avgResponseTime,
        byEndpoint,
        byKey,
        recentCalls: enrichedRecent,
      }
    })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/developer/usage failed')
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
