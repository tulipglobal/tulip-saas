// ─────────────────────────────────────────────────────────────
//  routes/auditRoutes.js — v3
//
//  Changes from v2:
//  ✔ GET / — paginated audit log list
//  ✔ GET /:id — single audit log with timestamp details
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const prisma  = require('../lib/client')
const { createAuditLog } = require('../services/auditService')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

// GET /api/audit
router.get('/', can('audit:read'), async (req, res) => {
  try {
    const { page, limit, skip, take } = parsePagination(req)

    const where = { tenantId: req.tenantId }
    if (req.query.action)     where.action     = req.query.action
    if (req.query.entityType) where.entityType = req.query.entityType
    if (req.query.userId)     where.userId     = req.query.userId
    if (req.query.status)     where.anchorStatus = req.query.status

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: {
          id:              true,
          action:          true,
          entityType:      true,
          entityId:        true,
          userId:          true,
          tenantId:        true,
          dataHash:        true,
          anchorStatus:    true,
          blockchainTx:    true,
          ancheredAt:      true,
          timestampStatus: true,
          timestampedAt:   true,
          createdAt:       true,
        }
      }),
      prisma.auditLog.count({ where })
    ])

    res.json(paginatedResponse(logs, total, page, limit))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/audit/:id
router.get('/:id', can('audit:read'), async (req, res) => {
  try {
    const log = await prisma.auditLog.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!log) return res.status(404).json({ error: 'Audit log not found' })

    // Omit raw token from response — use /timestamps/:id for that
    const { timestampToken, ...rest } = log
    res.json({ ...rest, hasTimestampToken: !!timestampToken })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/audit/test
router.post('/test', can('audit:write'), async (req, res) => {
  try {
    const log = await createAuditLog({
      action:     'TEST_ACTION',
      entityType: 'TestEntity',
      entityId:   '123',
      userId:     req.user.userId,
      tenantId:   req.user.tenantId,
    })
    res.json({ message: 'Audit log created', log })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
