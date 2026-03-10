// ─────────────────────────────────────────────────────────────
//  routes/caseRoutes.js — Verification Cases CRUD
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const tenantClient = require('../lib/tenantClient')
const prisma = require('../lib/client')
const { parsePagination, paginatedResponse } = require('../lib/paginate')
const { createAuditLog } = require('../services/auditService')
const crypto = require('crypto')

// GET /api/cases — list cases for tenant
router.get('/', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { skip, take, page, limit } = parsePagination(req)

    const where = {}
    if (req.query.status) where.status = req.query.status
    if (req.query.caseType) where.caseType = req.query.caseType
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { clientName: { contains: req.query.search, mode: 'insensitive' } },
      ]
    }

    const [cases, total] = await Promise.all([
      db.verificationCase.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { ocrJobs: true, bundleJobs: true } },
        },
      }),
      db.verificationCase.count({ where }),
    ])

    res.json(paginatedResponse(cases, total, page, limit))
  } catch (err) {
    console.error('Failed to list cases:', err)
    res.status(500).json({ error: 'Failed to list cases' })
  }
})

// GET /api/cases/:id — get case with documents and bundles
router.get('/:id', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const caseRecord = await db.verificationCase.findFirst({
      where: { id: req.params.id },
      include: {
        ocrJobs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, originalFilename: true, status: true, documentType: true,
            assessmentScore: true, assessmentResult: true, hashValue: true,
            anchorTxHash: true, anchoredAt: true, createdAt: true,
          },
        },
        bundleJobs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, status: true, fileCount: true, completedCount: true,
            overallRiskScore: true, overallRiskLevel: true, bundleHash: true,
            anchorTxHash: true, anchoredAt: true, crossAnalysisJson: true, createdAt: true,
          },
        },
      },
    })
    if (!caseRecord) return res.status(404).json({ error: 'Case not found' })
    res.json(caseRecord)
  } catch (err) {
    console.error('Failed to get case:', err)
    res.status(500).json({ error: 'Failed to get case' })
  }
})

// POST /api/cases — create new case
router.post('/', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, clientName, clientEmail, caseType } = req.body
    if (!name || !clientName) return res.status(400).json({ error: 'name and clientName are required' })

    const validTypes = ['MORTGAGE', 'INSURANCE', 'REAL_ESTATE', 'KYC', 'OTHER']
    const caseRecord = await db.verificationCase.create({
      data: {
        name,
        clientName,
        clientEmail: clientEmail || null,
        caseType: validTypes.includes(caseType) ? caseType : 'OTHER',
      },
    })

    createAuditLog({
      action: 'CASE_CREATED',
      entityType: 'VerificationCase',
      entityId: caseRecord.id,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
    }).catch(() => {})

    res.status(201).json(caseRecord)
  } catch (err) {
    console.error('Failed to create case:', err)
    res.status(500).json({ error: 'Failed to create case' })
  }
})

// PUT /api/cases/:id — update case
router.put('/:id', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.verificationCase.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Case not found' })

    const { name, clientName, clientEmail, caseType, status } = req.body
    const validStatuses = ['OPEN', 'COMPLETE', 'ARCHIVED']
    const validTypes = ['MORTGAGE', 'INSURANCE', 'REAL_ESTATE', 'KYC', 'OTHER']

    const caseRecord = await db.verificationCase.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(clientName !== undefined && { clientName }),
        ...(clientEmail !== undefined && { clientEmail }),
        ...(caseType && validTypes.includes(caseType) && { caseType }),
        ...(status && validStatuses.includes(status) && { status }),
      },
    })
    res.json(caseRecord)
  } catch (err) {
    console.error('Failed to update case:', err)
    res.status(500).json({ error: 'Failed to update case' })
  }
})

// DELETE /api/cases/:id — archive case (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.verificationCase.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Case not found' })

    await db.verificationCase.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' },
    })
    res.json({ archived: true, id: req.params.id })
  } catch (err) {
    console.error('Failed to archive case:', err)
    res.status(500).json({ error: 'Failed to archive case' })
  }
})

// POST /api/cases/:id/documents — add existing OcrJob to case
router.post('/:id/documents', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.verificationCase.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Case not found' })

    const { ocrJobId } = req.body
    if (!ocrJobId) return res.status(400).json({ error: 'ocrJobId is required' })

    const job = await db.ocrJob.findFirst({ where: { id: ocrJobId } })
    if (!job) return res.status(404).json({ error: 'OcrJob not found' })

    const updated = await prisma.ocrJob.update({
      where: { id: ocrJobId },
      data: { caseId: req.params.id },
    })

    // Recalculate overall risk score
    await recalcRiskScore(req.params.id)

    res.json(updated)
  } catch (err) {
    console.error('Failed to add document to case:', err)
    res.status(500).json({ error: 'Failed to add document to case' })
  }
})

// POST /api/cases/:id/bundles — add existing BundleJob to case
router.post('/:id/bundles', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.verificationCase.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Case not found' })

    const { bundleJobId } = req.body
    if (!bundleJobId) return res.status(400).json({ error: 'bundleJobId is required' })

    const job = await db.bundleJob.findFirst({ where: { id: bundleJobId } })
    if (!job) return res.status(404).json({ error: 'BundleJob not found' })

    const updated = await prisma.bundleJob.update({
      where: { id: bundleJobId },
      data: { caseId: req.params.id },
    })

    await recalcRiskScore(req.params.id)

    res.json(updated)
  } catch (err) {
    console.error('Failed to add bundle to case:', err)
    res.status(500).json({ error: 'Failed to add bundle to case' })
  }
})

// Helper: recalculate overall risk score from child jobs
async function recalcRiskScore(caseId) {
  const jobs = await prisma.ocrJob.findMany({
    where: { caseId, assessmentScore: { not: null } },
    select: { assessmentScore: true },
  })
  if (jobs.length === 0) return
  const avg = Math.round(jobs.reduce((s, j) => s + j.assessmentScore, 0) / jobs.length)
  await prisma.verificationCase.update({
    where: { id: caseId },
    data: { overallRiskScore: avg },
  })
}

module.exports = router
