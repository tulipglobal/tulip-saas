const { createAuditLog } = require('../services/auditService')
const { notifyExpenseAdded } = require('../services/emailNotificationService')
const { dispatch: webhookDispatch } = require('../services/webhookService')
const prisma = require('../lib/client')
// ─────────────────────────────────────────────────────────────
//  controllers/expenseController.js — v2
//  ✔ Paginated list with ?page, ?limit, ?projectId filter
// ─────────────────────────────────────────────────────────────

const tenantClient = require('../lib/tenantClient')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

exports.getExpenses = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)

    const where = {}
    if (req.query.projectId)       where.projectId       = req.query.projectId
    if (req.query.fundingSourceId) where.fundingSourceId = req.query.fundingSourceId

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where, skip, take,
        include: { fundingSource: true, fundingAgreement: { select: { id: true, title: true, donor: { select: { name: true } } } }, project: { select: { id: true, name: true } }, documents: { select: { id: true, name: true, sha256Hash: true, fileType: true, uploadedAt: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      db.expense.count({ where })
    ])

    res.json(paginatedResponse(expenses, total, page, limit))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
}

exports.getExpense = async (req, res) => {
  try {
    const db      = tenantClient(req.user.tenantId)
    const expense = await db.expense.findFirst({
      where:   { id: req.params.id },
      include: { fundingSource: true, fundingAgreement: { select: { id: true, title: true, donor: { select: { name: true } } } }, project: { select: { id: true, name: true } }, documents: { select: { id: true, name: true, sha256Hash: true, fileType: true, fileSize: true, uploadedAt: true } } }
    })
    if (!expense) return res.status(404).json({ error: 'Expense not found' })
    res.json(expense)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense' })
  }
}

exports.createExpense = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { title, description, amount, currency, projectId, fundingSourceId, fundingAgreementId, expenseType, category, subCategory } = req.body
    const expenseTitle = title || description
    if (!expenseTitle || !amount) {
      return res.status(400).json({ error: 'title and amount are required' })
    }
    const expense = await db.expense.create({
      data: {
        description:        expenseTitle,
        amount:             parseFloat(amount),
        currency:           currency || 'USD',
        projectId:          projectId || null,
        fundingSourceId:    fundingSourceId || null,
        fundingAgreementId: fundingAgreementId || null,
        expenseType:        expenseType || null,
        category:           category || null,
        subCategory:        subCategory || null,
        approvalStatus:     'pending_review',
      }
    })
    await createAuditLog({ action: 'EXPENSE_CREATED', entityType: 'Expense', entityId: expense.id, userId: req.user.id, tenantId: req.user.tenantId }).catch(() => {})

    // Auto-create workflow task for expense approval
    prisma.workflowTask.create({
      data: {
        tenantId: req.user.tenantId,
        type: 'expense_approval',
        title: `Expense approval: ${expenseTitle}`,
        description: `New expense of ${currency || 'USD'} ${parseFloat(amount).toLocaleString()} requires review.`,
        entityId: expense.id,
        entityType: 'expense',
        submittedBy: req.user.userId,
      },
    }).catch(err => console.error('[workflow] auto-create expense task failed:', err.message))

    // Notify admin (non-blocking)
    notifyExpenseAdded({
      tenantId: req.user.tenantId,
      description: expenseTitle,
      amount: parseFloat(amount),
      currency: currency || 'USD',
      creatorName: req.user.name || null,
    }).catch(() => {})

    // Webhook: expense.created (non-blocking)
    webhookDispatch(req.user.tenantId, 'expense.created', {
      id: expense.id, description: expenseTitle, amount: parseFloat(amount), currency: currency || 'USD',
    }).catch(() => {})

    res.status(201).json(expense)
  } catch (err) {
    console.error('createExpense error:', err)
    res.status(500).json({ error: 'Failed to create expense' })
  }
}

exports.updateExpense = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })

    const { description, amount, currency, fundingSourceId, fundingAgreementId, expenseType, category, subCategory } = req.body
    const expense = await db.expense.update({
      where: { id: req.params.id },
      data: {
        ...(description        !== undefined && { description }),
        ...(amount             !== undefined && { amount: parseFloat(amount) }),
        ...(currency           !== undefined && { currency }),
        ...(fundingSourceId    !== undefined && { fundingSourceId }),
        ...(fundingAgreementId !== undefined && { fundingAgreementId }),
        ...(expenseType        !== undefined && { expenseType }),
        ...(category           !== undefined && { category }),
        ...(subCategory        !== undefined && { subCategory }),
      }
    })
    res.json(expense)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense' })
  }
}

exports.deleteExpense = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })
    await db.expense.delete({ where: { id: req.params.id } })
    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' })
  }
}
