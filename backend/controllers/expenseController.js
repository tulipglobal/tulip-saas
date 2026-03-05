const tenantClient = require('../lib/tenantClient')

// GET /api/expenses
exports.getExpenses = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { projectId, fundingSourceId } = req.query
    const expenses = await db.expense.findMany({
      where: {
        ...(projectId && { projectId }),
        ...(fundingSourceId && { fundingSourceId })
      },
      include: {
        project: { select: { id: true, name: true } },
        fundingSource: { select: { id: true, name: true, fundingType: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(expenses)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
}

// GET /api/expenses/:id
exports.getExpense = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const expense = await db.expense.findFirst({
      where: { id: req.params.id },
      include: { project: true, fundingSource: true }
    })
    if (!expense) return res.status(404).json({ error: 'Expense not found' })
    res.json(expense)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense' })
  }
}

// POST /api/expenses
exports.createExpense = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { description, amount, currency, projectId, fundingSourceId } = req.body

    if (!description || !amount || !currency || !projectId || !fundingSourceId)
      return res.status(400).json({ error: 'description, amount, currency, projectId, fundingSourceId are required' })

    // Verify project and funding source both belong to tenant
    const [project, fundingSource] = await Promise.all([
      db.project.findFirst({ where: { id: projectId } }),
      db.fundingSource.findFirst({ where: { id: fundingSourceId } })
    ])
    if (!project) return res.status(404).json({ error: 'Project not found' })
    if (!fundingSource) return res.status(404).json({ error: 'Funding source not found' })

    const expense = await db.expense.create({
      data: { description, amount: parseFloat(amount), currency, projectId, fundingSourceId }
    })
    res.status(201).json(expense)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create expense' })
  }
}

// PUT /api/expenses/:id
exports.updateExpense = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })

    const { description, amount, currency } = req.body
    const expense = await db.expense.update({
      where: { id: req.params.id },
      data: {
        ...(description && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(currency && { currency })
      }
    })
    res.json(expense)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense' })
  }
}

// DELETE /api/expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })

    await db.expense.delete({ where: { id: req.params.id } })
    res.json({ message: 'Expense deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' })
  }
}
