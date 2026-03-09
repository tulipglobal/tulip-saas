// ─────────────────────────────────────────────────────────────
//  routes/auditRoutes.js — v4
//
//  ✔ GET /           — paginated audit log list
//  ✔ GET /export     — ZIP download (CSV + documents + summary)
//  ✔ GET /:id        — single audit log with timestamp details
// ─────────────────────────────────────────────────────────────

const express  = require('express')
const router   = express.Router()
const { can }  = require('../middleware/permission')
const prisma   = require('../lib/client')
const archiver = require('archiver')
const { createAuditLog } = require('../services/auditService')
const { parsePagination, paginatedResponse } = require('../lib/paginate')
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')

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
    const fundingSourceIds = new Set()

    for (const log of logs) {
      if (log.entityType === 'Project')        projectIds.add(log.entityId)
      if (log.entityType === 'Expense')        expenseIds.add(log.entityId)
      if (log.entityType === 'Document')       documentIds.add(log.entityId)
      if (log.entityType === 'FundingSource')  fundingSourceIds.add(log.entityId)
    }

    const [projects, expenses, documents, fundingSources] = await Promise.all([
      projectIds.size > 0
        ? prisma.project.findMany({ where: { id: { in: [...projectIds] } }, select: { id: true, name: true } })
        : [],
      expenseIds.size > 0
        ? prisma.expense.findMany({ where: { id: { in: [...expenseIds] } }, select: { id: true, description: true, projectId: true } })
        : [],
      documentIds.size > 0
        ? prisma.document.findMany({ where: { id: { in: [...documentIds] } }, select: { id: true, name: true, projectId: true } })
        : [],
      fundingSourceIds.size > 0
        ? prisma.fundingSource.findMany({ where: { id: { in: [...fundingSourceIds] } }, select: { id: true, name: true, projectId: true } })
        : [],
    ])

    // Also fetch projects for expenses/documents/fundingSources that reference a project
    const extraProjectIds = new Set()
    for (const e of expenses) if (e.projectId) extraProjectIds.add(e.projectId)
    for (const d of documents) if (d.projectId) extraProjectIds.add(d.projectId)
    for (const f of fundingSources) if (f.projectId) extraProjectIds.add(f.projectId)
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
      } else if (log.entityType === 'FundingSource') {
        const fs = fundingSources.find(f => f.id === log.entityId)
        if (fs?.projectId) projectName = projectMap[fs.projectId] || null
      }
      return { ...log, projectName }
    })

    res.json(paginatedResponse(enriched, total, page, limit))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/audit/export — ZIP download
router.get('/export', can('audit:read'), async (req, res) => {
  try {
    // Build filter from query params (mirrors the list endpoint)
    const where = { tenantId: req.tenantId }
    if (req.query.anchorStatus && req.query.anchorStatus !== 'all')
      where.anchorStatus = req.query.anchorStatus
    if (req.query.entityType && req.query.entityType !== 'all')
      where.entityType = req.query.entityType
    if (req.query.from || req.query.to) {
      where.createdAt = {}
      if (req.query.from) where.createdAt.gte = new Date(req.query.from)
      if (req.query.to)   where.createdAt.lte = new Date(req.query.to + 'T23:59:59.999Z')
    }

    // Fetch ALL matching entries (no pagination for export)
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, action: true, entityType: true, entityId: true,
        userId: true, tenantId: true, dataHash: true, anchorStatus: true,
        blockchainTx: true, blockNumber: true, createdAt: true,
      }
    })

    // Enrich with project names (same logic as list endpoint)
    const projectIds = new Set(), expenseIds = new Set()
    const documentIds = new Set(), fundingSourceIds = new Set()
    for (const log of logs) {
      if (log.entityType === 'Project')       projectIds.add(log.entityId)
      if (log.entityType === 'Expense')       expenseIds.add(log.entityId)
      if (log.entityType === 'Document')      documentIds.add(log.entityId)
      if (log.entityType === 'FundingSource') fundingSourceIds.add(log.entityId)
    }

    const [projects, expenses, documents, fundingSources] = await Promise.all([
      projectIds.size > 0 ? prisma.project.findMany({ where: { id: { in: [...projectIds] } }, select: { id: true, name: true } }) : [],
      expenseIds.size > 0 ? prisma.expense.findMany({ where: { id: { in: [...expenseIds] } }, select: { id: true, description: true, projectId: true } }) : [],
      documentIds.size > 0 ? prisma.document.findMany({ where: { id: { in: [...documentIds] } }, select: { id: true, name: true, projectId: true, fileUrl: true, fileType: true } }) : [],
      fundingSourceIds.size > 0 ? prisma.fundingSource.findMany({ where: { id: { in: [...fundingSourceIds] } }, select: { id: true, name: true, projectId: true } }) : [],
    ])

    const extraProjectIds = new Set()
    for (const e of expenses) if (e.projectId) extraProjectIds.add(e.projectId)
    for (const d of documents) if (d.projectId) extraProjectIds.add(d.projectId)
    for (const f of fundingSources) if (f.projectId) extraProjectIds.add(f.projectId)
    for (const id of projectIds) extraProjectIds.delete(id)
    const extraProjects = extraProjectIds.size > 0
      ? await prisma.project.findMany({ where: { id: { in: [...extraProjectIds] } }, select: { id: true, name: true } })
      : []

    const projectMap = {}
    for (const p of [...projects, ...extraProjects]) projectMap[p.id] = p.name

    const enriched = logs.map(log => {
      let projectName = '—'
      if (log.entityType === 'Project') projectName = projectMap[log.entityId] || '—'
      else if (log.entityType === 'Expense') {
        const exp = expenses.find(e => e.id === log.entityId)
        if (exp?.projectId) projectName = projectMap[exp.projectId] || '—'
      } else if (log.entityType === 'Document') {
        const doc = documents.find(d => d.id === log.entityId)
        if (doc?.projectId) projectName = projectMap[doc.projectId] || '—'
      } else if (log.entityType === 'FundingSource') {
        const fs = fundingSources.find(f => f.id === log.entityId)
        if (fs?.projectId) projectName = projectMap[fs.projectId] || '—'
      }
      return { ...log, projectName }
    })

    // Tenant + user info for summary
    const [tenant, user] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } }),
      req.user?.userId ? prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true, email: true } }) : null,
    ])

    // Build ZIP
    const today = new Date().toISOString().slice(0, 10)
    const zipName = `tulip-audit-export-${today}.zip`

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`)

    const archive = archiver('zip', { zlib: { level: 5 } })
    archive.on('error', err => { throw err })
    archive.pipe(res)

    // 1. audit_log.csv
    const csvHeader = 'Action,Entity Type,Entity ID,Project,Hash,Status,Blockchain TX,Block,Date\n'
    const csvRows = enriched.map(e => {
      const date = new Date(e.createdAt).toISOString()
      return [
        e.action,
        e.entityType,
        e.entityId,
        `"${e.projectName}"`,
        e.dataHash,
        e.anchorStatus || 'pending',
        e.blockchainTx || '',
        e.blockNumber || '',
        date,
      ].join(',')
    }).join('\n')
    archive.append(csvHeader + csvRows, { name: 'audit_log.csv' })

    // 2. Include document files if requested
    if (req.query.includeFiles === 'true' && documents.length > 0) {
      const s3 = new S3Client({
        region: process.env.AWS_REGION || 'ap-south-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      })
      const bucket = process.env.S3_BUCKET || 'tulipglobal.org'

      for (const doc of documents) {
        if (!doc.fileUrl) continue
        try {
          const url = new URL(doc.fileUrl)
          const key = url.pathname.substring(1)
          const command = new GetObjectCommand({ Bucket: bucket, Key: key })
          const s3Res = await s3.send(command)
          const ext = doc.fileType ? `.${doc.fileType}` : ''
          const safeName = (doc.name || doc.id).replace(/[^a-zA-Z0-9._-]/g, '_')
          archive.append(s3Res.Body, { name: `documents/${safeName}${ext}` })
        } catch (e) {
          // Skip files that can't be fetched
        }
      }
    }

    // 3. summary.txt
    const dates = enriched.map(e => new Date(e.createdAt))
    const oldest = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : '—'
    const newest = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : '—'
    const filtersUsed = []
    if (req.query.anchorStatus && req.query.anchorStatus !== 'all') filtersUsed.push(`Status: ${req.query.anchorStatus}`)
    if (req.query.entityType && req.query.entityType !== 'all') filtersUsed.push(`Entity Type: ${req.query.entityType}`)
    if (req.query.from) filtersUsed.push(`From: ${req.query.from}`)
    if (req.query.to)   filtersUsed.push(`To: ${req.query.to}`)

    const summary = [
      '═══════════════════════════════════════════════',
      '  TULIP DS — Audit Export Summary',
      '═══════════════════════════════════════════════',
      '',
      `Tenant:           ${tenant?.name || '—'}`,
      `Exported by:      ${user?.name || user?.email || '—'}`,
      `Exported at:      ${new Date().toISOString()}`,
      '',
      `Total entries:    ${enriched.length}`,
      `Date range:       ${oldest} to ${newest}`,
      `Files included:   ${req.query.includeFiles === 'true' ? documents.length : 0}`,
      '',
      `Filters applied:  ${filtersUsed.length ? filtersUsed.join(', ') : 'None (full export)'}`,
      '',
      '───────────────────────────────────────────────',
      'This export was generated by Tulip DS.',
      'Each entry is SHA-256 hashed and anchored to',
      'the Polygon blockchain for tamper-proof',
      'verification.',
      '',
      'Verify any hash at: https://tulipds.com/verify',
      '═══════════════════════════════════════════════',
    ].join('\n')
    archive.append(summary, { name: 'summary.txt' })

    await archive.finalize()
  } catch (err) {
    console.error('Audit export error:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Export failed' })
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
