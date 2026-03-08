// ─────────────────────────────────────────────────────────────
//  controllers/fundingAgreementController.js — v1
// ─────────────────────────────────────────────────────────────
const tenantClient = require('../lib/tenantClient')
const prisma = require('../lib/client')
const { createAuditLog } = require('../services/auditService')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

exports.list = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)
    const where = {}
    if (req.query.status) where.status = req.query.status
    if (req.query.type) where.type = req.query.type
    if (req.query.donorId) where.donorId = req.query.donorId

    const [agreements, total] = await Promise.all([
      db.fundingAgreement.findMany({
        where, skip, take,
        include: {
          donor: { select: { id: true, name: true, type: true } },
          projectFunding: { select: { id: true, allocatedAmount: true, project: { select: { id: true, name: true } } } },
          _count: { select: { expenses: true, repayments: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.fundingAgreement.count({ where })
    ])

    // compute spent per agreement
    const ids = agreements.map(a => a.id)
    const spentRaw = ids.length > 0
      ? await prisma.$queryRawUnsafe(
          `SELECT "fundingAgreementId", SUM(amount) as spent FROM "Expense" WHERE "fundingAgreementId" = ANY($1::uuid[]) GROUP BY "fundingAgreementId"`,
          ids
        )
      : []
    const spentMap = {}
    for (const r of spentRaw) spentMap[r.fundingAgreementId] = Number(r.spent)

    const enriched = agreements.map(a => ({ ...a, spent: spentMap[a.id] || 0 }))
    res.json(paginatedResponse(enriched, total, page, limit))
  } catch (err) {
    console.error('fundingAgreement list error:', err)
    res.status(500).json({ error: 'Failed to fetch funding agreements' })
  }
}

exports.get = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const agreement = await db.fundingAgreement.findFirst({
      where: { id: req.params.id },
      include: {
        donor: true,
        projectFunding: { include: { project: { select: { id: true, name: true, status: true, budget: true } } } },
        repayments: { orderBy: { dueDate: 'asc' } },
        _count: { select: { expenses: true } }
      }
    })
    if (!agreement) return res.status(404).json({ error: 'Funding agreement not found' })

    // compute spent
    const spent = await db.expense.aggregate({ where: { fundingAgreementId: agreement.id }, _sum: { amount: true } })
    res.json({ ...agreement, spent: spent._sum.amount || 0 })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch funding agreement' })
  }
}

exports.create = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { title, type, totalAmount, currency, donorId, startDate, endDate, interestRate, repayable, notes, status } = req.body
    if (!title || !totalAmount) return res.status(400).json({ error: 'title and totalAmount are required' })

    const agreement = await db.fundingAgreement.create({
      data: {
        title,
        type: type || 'GRANT',
        totalAmount: parseFloat(totalAmount),
        currency: currency || 'USD',
        donorId: donorId || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        interestRate: interestRate ? parseFloat(interestRate) : null,
        repayable: repayable || false,
        notes: notes || null,
        status: status || 'ACTIVE',
      },
      include: { donor: { select: { id: true, name: true } } }
    })

    await createAuditLog({ action: 'FUNDING_AGREEMENT_CREATED', entityType: 'FundingAgreement', entityId: agreement.id, userId: req.user.userId || req.user.id, tenantId: req.user.tenantId }).catch(() => {})
    res.status(201).json(agreement)
  } catch (err) {
    console.error('createFundingAgreement error:', err)
    res.status(500).json({ error: 'Failed to create funding agreement' })
  }
}

exports.update = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.fundingAgreement.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Funding agreement not found' })

    const { title, type, totalAmount, currency, donorId, startDate, endDate, interestRate, repayable, notes, status } = req.body
    const agreement = await db.fundingAgreement.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(type !== undefined && { type }),
        ...(totalAmount !== undefined && { totalAmount: parseFloat(totalAmount) }),
        ...(currency !== undefined && { currency }),
        ...(donorId !== undefined && { donorId: donorId || null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(interestRate !== undefined && { interestRate: interestRate ? parseFloat(interestRate) : null }),
        ...(repayable !== undefined && { repayable }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
      }
    })
    res.json(agreement)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update funding agreement' })
  }
}

// Repayment schedule
exports.listRepayments = async (req, res) => {
  try {
    const repayments = await prisma.repaymentSchedule.findMany({
      where: { fundingAgreementId: req.params.id },
      orderBy: { dueDate: 'asc' }
    })
    res.json({ data: repayments })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch repayments' })
  }
}

exports.createRepayment = async (req, res) => {
  try {
    const { dueDate, amount, notes } = req.body
    if (!dueDate || !amount) return res.status(400).json({ error: 'dueDate and amount are required' })
    const repayment = await prisma.repaymentSchedule.create({
      data: { fundingAgreementId: req.params.id, dueDate: new Date(dueDate), amount: parseFloat(amount), notes }
    })
    res.status(201).json(repayment)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create repayment' })
  }
}

exports.updateRepayment = async (req, res) => {
  try {
    const { status, paidAt, notes } = req.body
    const repayment = await prisma.repaymentSchedule.update({
      where: { id: req.params.repaymentId },
      data: {
        ...(status !== undefined && { status }),
        ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
        ...(notes !== undefined && { notes }),
      }
    })
    res.json(repayment)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update repayment' })
  }
}

// Project funding
exports.linkProject = async (req, res) => {
  try {
    const { projectId, allocatedAmount, notes } = req.body
    if (!projectId || !allocatedAmount) return res.status(400).json({ error: 'projectId and allocatedAmount required' })
    const link = await prisma.projectFunding.create({
      data: { projectId, fundingAgreementId: req.params.id, allocatedAmount: parseFloat(allocatedAmount), notes },
      include: { project: { select: { id: true, name: true } } }
    })
    res.status(201).json(link)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Project already linked to this agreement' })
    res.status(500).json({ error: 'Failed to link project' })
  }
}

exports.unlinkProject = async (req, res) => {
  try {
    await prisma.projectFunding.delete({
      where: { projectId_fundingAgreementId: { projectId: req.params.projectId, fundingAgreementId: req.params.id } }
    })
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink project' })
  }
}
