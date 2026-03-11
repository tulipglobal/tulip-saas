// ─────────────────────────────────────────────────────────────
//  controllers/budgetController.js
//  CRUD for Budget + BudgetLine models
// ─────────────────────────────────────────────────────────────
const tenantClient = require('../lib/tenantClient')
const prisma = require('../lib/client')
const { createAuditLog } = require('../services/auditService')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

// ─── List budgets ────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)
    const where = {}
    if (req.query.status) where.status = req.query.status

    const [budgets, total] = await Promise.all([
      db.budget.findMany({
        where, skip, take,
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          _count: { select: { fundingAgreements: true, expenses: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.budget.count({ where })
    ])

    // compute spent per budget
    const ids = budgets.map(b => b.id)
    const spentRaw = ids.length > 0
      ? await prisma.expense.groupBy({
          by: ['budgetId'],
          where: { budgetId: { in: ids } },
          _sum: { amount: true }
        })
      : []
    const spentMap = {}
    for (const r of spentRaw) spentMap[r.budgetId] = Number(r._sum.amount || 0)

    const enriched = budgets.map(b => {
      const totalApproved = b.lines.reduce((s, l) => s + l.approvedAmount, 0)
      return { ...b, totalApproved, spent: spentMap[b.id] || 0 }
    })

    res.json(paginatedResponse(enriched, total, page, limit))
  } catch (err) {
    console.error('budget list error:', err)
    res.status(500).json({ error: 'Failed to list budgets' })
  }
}

// ─── Get single budget ───────────────────────────────────────
exports.get = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const budget = await db.budget.findUnique({
      where: { id: req.params.id },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        fundingAgreements: {
          select: {
            id: true, title: true, totalAmount: true, currency: true,
            status: true, sourceType: true, sourceSubType: true,
            donor: { select: { id: true, name: true } }
          }
        },
        expenses: {
          select: {
            id: true, description: true, amount: true, currency: true,
            expenseType: true, category: true, subCategory: true,
            budgetLineId: true, createdAt: true, approvalStatus: true,
            project: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })

    // compute spent per line
    const lineSpentRaw = budget.lines.length > 0
      ? await prisma.expense.groupBy({
          by: ['budgetLineId'],
          where: { budgetLineId: { in: budget.lines.map(l => l.id) } },
          _sum: { amount: true }
        })
      : []
    const lineSpentMap = {}
    for (const r of lineSpentRaw) lineSpentMap[r.budgetLineId] = Number(r._sum.amount || 0)

    const linesWithSpent = budget.lines.map(l => ({
      ...l,
      spent: lineSpentMap[l.id] || 0,
      remaining: l.approvedAmount - (lineSpentMap[l.id] || 0)
    }))

    const totalApproved = budget.lines.reduce((s, l) => s + l.approvedAmount, 0)
    const totalSpent = Object.values(lineSpentMap).reduce((s, v) => s + v, 0)
    const totalFunded = budget.fundingAgreements.reduce((s, f) => s + f.totalAmount, 0)

    res.json({
      ...budget,
      lines: linesWithSpent,
      totalApproved,
      totalSpent,
      totalFunded,
      remaining: totalApproved - totalSpent
    })
  } catch (err) {
    console.error('budget get error:', err)
    res.status(500).json({ error: 'Failed to get budget' })
  }
}

// ─── Create budget with lines ────────────────────────────────
exports.create = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, periodFrom, periodTo, status, notes, lines } = req.body

    if (!name || !periodFrom || !periodTo) {
      return res.status(400).json({ error: 'name, periodFrom, and periodTo are required' })
    }
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one budget line is required' })
    }

    const budget = await db.budget.create({
      data: {
        name,
        periodFrom: new Date(periodFrom),
        periodTo: new Date(periodTo),
        status: status || 'DRAFT',
        notes: notes || null,
        lines: {
          create: lines.map(l => ({
            expenseType: l.expenseType,
            category: l.category,
            subCategory: l.subCategory || null,
            description: l.description || null,
            approvedAmount: Number(l.approvedAmount),
            currency: l.currency || 'USD'
          }))
        }
      },
      include: { lines: true }
    })

    await createAuditLog({
      action: 'budget.created',
      entityType: 'Budget',
      entityId: budget.id,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      details: { name, lineCount: lines.length }
    })

    res.status(201).json(budget)
  } catch (err) {
    console.error('budget create error:', err)
    res.status(500).json({ error: 'Failed to create budget' })
  }
}

// ─── Update budget ───────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.budget.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Budget not found' })

    const { name, periodFrom, periodTo, status, notes, lines } = req.body
    const data = {}
    if (name !== undefined) data.name = name
    if (periodFrom !== undefined) data.periodFrom = new Date(periodFrom)
    if (periodTo !== undefined) data.periodTo = new Date(periodTo)
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes

    const budget = await db.budget.update({
      where: { id: req.params.id },
      data,
      include: { lines: true }
    })

    // If lines are provided, upsert them
    if (lines && Array.isArray(lines)) {
      const existingLineIds = budget.lines.map(l => l.id)
      const incomingIds = lines.filter(l => l.id).map(l => l.id)

      // Delete removed lines
      const toDelete = existingLineIds.filter(id => !incomingIds.includes(id))
      if (toDelete.length > 0) {
        await prisma.budgetLine.deleteMany({ where: { id: { in: toDelete } } })
      }

      // Upsert lines
      for (const l of lines) {
        if (l.id && existingLineIds.includes(l.id)) {
          await prisma.budgetLine.update({
            where: { id: l.id },
            data: {
              expenseType: l.expenseType,
              category: l.category,
              subCategory: l.subCategory || null,
              description: l.description || null,
              approvedAmount: Number(l.approvedAmount),
              currency: l.currency || 'USD'
            }
          })
        } else {
          await prisma.budgetLine.create({
            data: {
              budgetId: budget.id,
              expenseType: l.expenseType,
              category: l.category,
              subCategory: l.subCategory || null,
              description: l.description || null,
              approvedAmount: Number(l.approvedAmount),
              currency: l.currency || 'USD'
            }
          })
        }
      }
    }

    const updated = await db.budget.findUnique({
      where: { id: req.params.id },
      include: { lines: true }
    })

    await createAuditLog({
      action: 'budget.updated',
      entityType: 'Budget',
      entityId: budget.id,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      details: { changes: Object.keys(data) }
    })

    res.json(updated)
  } catch (err) {
    console.error('budget update error:', err)
    res.status(500).json({ error: 'Failed to update budget' })
  }
}

// ─── Delete budget (only DRAFT) ──────────────────────────────
exports.remove = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const budget = await db.budget.findUnique({ where: { id: req.params.id } })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })
    if (budget.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT budgets can be deleted' })
    }

    await db.budget.delete({ where: { id: req.params.id } })

    await createAuditLog({
      action: 'budget.deleted',
      entityType: 'Budget',
      entityId: req.params.id,
      userId: req.user.id,
      tenantId: req.user.tenantId
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('budget delete error:', err)
    res.status(500).json({ error: 'Failed to delete budget' })
  }
}
