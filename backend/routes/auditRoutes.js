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
    if (req.query.status || req.query.anchorStatus) where.anchorStatus = req.query.anchorStatus || req.query.status

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
          blockNumber:     true,
        }
      }),
      prisma.auditLog.count({ where })
    ])

    // Enrich with project names
    const projectIds = new Set()
    const expenseIds = new Set()
    const documentIds = new Set()

    for (const log of logs) {
      if (log.entityType === 'Project')  projectIds.add(log.entityId)
      if (log.entityType === 'Expense')  expenseIds.add(log.entityId)
      if (log.entityType === 'Document') documentIds.add(log.entityId)
    }

    const [projects, expenses, documents] = await Promise.all([
      projectIds.size > 0
        ? prisma.project.findMany({ where: { id: { in: [...projectIds] } }, select: { id: true, name: true } })
        : [],
      expenseIds.size > 0
        ? prisma.expense.findMany({ where: { id: { in: [...expenseIds] } }, select: { id: true, description: true, projectId: true } })
        : [],
      documentIds.size > 0
        ? prisma.document.findMany({ where: { id: { in: [...documentIds] } }, select: { id: true, name: true, projectId: true } })
        : [],
    ])

    // Also fetch projects for expenses/documents that reference a project
    const extraProjectIds = new Set()
    for (const e of expenses) if (e.projectId) extraProjectIds.add(e.projectId)
    for (const d of documents) if (d.projectId) extraProjectIds.add(d.projectId)
    // Remove already-fetched
    for (const id of projectIds) extraProjectIds.delete(id)

    const extraProjects = extraProjectIds.size > 0
      ? await prisma.project.findMany({ where: { id: { in: [...extraProjectIds] } }, select: { id: true, name: true } })
      : []

    const projectMap = {}
    for (const p of [...projects, ...extraProjects]) projectMap[p.id] = p.name

    const enriched = logs.map(log => {
      let projectName = null
      if (log.entityType === 'Project') {
        projectName = projectMap[log.entityId] || null
      } else if (log.entityType === 'Expense') {
        const exp = expenses.find(e => e.id === log.entityId)
        if (exp?.projectId) projectName = projectMap[exp.projectId] || null
      } else if (log.entityType === 'Document') {
        const doc = documents.find(d => d.id === log.entityId)
        if (doc?.projectId) projectName = projectMap[doc.projectId] || null
      }
      return { ...log, projectName }
    })

    res.json(paginatedResponse(enriched, total, page, limit))
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
