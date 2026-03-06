// ─────────────────────────────────────────────────────────────
//  routes/timestampRoutes.js — v1
//
//  Register in app.js:
//    app.use('/api/timestamps', authenticate, tenantScope, timestampRoutes)
//
//  Endpoints:
//    POST /api/timestamps/:auditLogId     — stamp a single log
//    GET  /api/timestamps/:auditLogId     — get timestamp details
//    GET  /api/timestamps/:auditLogId/verify — verify token integrity
//    POST /api/timestamps/batch           — stamp all pending logs
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const prisma  = require('../lib/client')
const { stampAuditLog, stampPendingLogs, verifyTimestampToken } = require('../services/timestampService')

// ── Stamp a single audit log ──────────────────────────────────
router.post('/:auditLogId', can('audit:write'), async (req, res) => {
  try {
    const log = await prisma.auditLog.findFirst({
      where: { id: req.params.auditLogId, tenantId: req.tenantId }
    })
    if (!log) return res.status(404).json({ error: 'Audit log not found' })

    const result = await stampAuditLog(req.params.auditLogId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Get timestamp details for an audit log ────────────────────
router.get('/:auditLogId', can('audit:read'), async (req, res) => {
  try {
    const log = await prisma.auditLog.findFirst({
      where:  { id: req.params.auditLogId, tenantId: req.tenantId },
      select: {
        id:              true,
        dataHash:        true,
        timestampStatus: true,
        timestampedAt:   true,
        tsaUrl:          true,
        timestampToken:  true,
      }
    })
    if (!log) return res.status(404).json({ error: 'Audit log not found' })

    // Don't return full token in list view — just metadata
    const { timestampToken, ...meta } = log
    res.json({
      ...meta,
      hasToken:       !!timestampToken,
      tokenSizeBytes: timestampToken ? Buffer.from(timestampToken, 'base64').length : 0,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Verify a timestamp token ──────────────────────────────────
router.get('/:auditLogId/verify', can('audit:read'), async (req, res) => {
  try {
    const log = await prisma.auditLog.findFirst({
      where:  { id: req.params.auditLogId, tenantId: req.tenantId },
      select: { dataHash: true, timestampToken: true, timestampStatus: true, tsaUrl: true }
    })
    if (!log)                  return res.status(404).json({ error: 'Audit log not found' })
    if (!log.timestampToken)   return res.status(404).json({ error: 'No timestamp token found' })

    const result = verifyTimestampToken(log.dataHash, log.timestampToken)

    res.json({
      ...result,
      dataHash:        log.dataHash,
      timestampStatus: log.timestampStatus,
      tsaUrl:          log.tsaUrl,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Batch stamp all pending logs ──────────────────────────────
router.post('/batch/stamp', can('audit:write'), async (req, res) => {
  try {
    const { limit = 10 } = req.body
    const result = await stampPendingLogs(Math.min(limit, 50))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
