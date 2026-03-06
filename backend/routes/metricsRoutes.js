// ─────────────────────────────────────────────────────────────
//  routes/metricsRoutes.js — v1
//
//  Internal observability endpoint.
//  Returns live system stats — useful for dashboards + alerts.
//
//  Register in app.js:
//    app.use('/api/metrics', authenticate, tenantScope, metricsRoutes)
//
//  GET /api/metrics — full system snapshot
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const prisma  = require('../lib/client')

router.get('/', can('system:admin'), async (req, res) => {
  try {
    const tenantId = req.tenantId

    const [
      totalAuditLogs,
      pendingAnchors,
      failedAnchors,
      confirmedAnchors,
      totalUsers,
      activeWebhooks,
      failedDeliveries,
      recentErrors,
    ] = await Promise.all([
      // Audit log counts
      prisma.auditLog.count({ where: { tenantId } }),
      prisma.auditLog.count({ where: { tenantId, anchorStatus: 'pending' } }),
      prisma.auditLog.count({ where: { tenantId, anchorStatus: 'failed' } }),
      prisma.auditLog.count({ where: { tenantId, anchorStatus: 'confirmed' } }),

      // Users
      prisma.user.count({ where: { tenantId, deletedAt: null } }),

      // Webhooks
      prisma.webhook.count({ where: { tenantId, active: true } }),
      prisma.webhookDelivery.count({ where: { tenantId, status: 'failed' } }),

      // Recent failed anchor jobs (last 24h)
      prisma.auditLog.count({
        where: {
          tenantId,
          anchorStatus: 'failed',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
    ])

    // System memory + uptime
    const mem = process.memoryUsage()

    res.json({
      timestamp: new Date().toISOString(),
      uptime:    {
        seconds: Math.floor(process.uptime()),
        human:   formatUptime(process.uptime()),
      },
      memory: {
        heapUsed:  `${Math.round(mem.heapUsed  / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        rss:       `${Math.round(mem.rss       / 1024 / 1024)}MB`,
      },
      auditLogs: {
        total:     totalAuditLogs,
        pending:   pendingAnchors,
        confirmed: confirmedAnchors,
        failed:    failedAnchors,
      },
      anchoring: {
        failedLast24h: recentErrors,
        alert: recentErrors > 5 ? 'HIGH — more than 5 anchor failures in 24h' : 'ok',
      },
      users: {
        active: totalUsers,
      },
      webhooks: {
        active:          activeWebhooks,
        failedDeliveries,
        alert: failedDeliveries > 10 ? 'HIGH — more than 10 failed deliveries' : 'ok',
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Metrics unavailable', detail: err.message })
  }
})

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${d}d ${h}h ${m}m ${s}s`
}

module.exports = router
