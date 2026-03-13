// ─────────────────────────────────────────────────────────────
//  routes/expenseRoutes.js — v3
// ─────────────────────────────────────────────────────────────
const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  getExpenses, getExpense, getPendingReview,
  createExpense, updateExpense, deleteExpense, voidExpense,
  approveExpense, rejectExpense,
  receiptUploadMiddleware, uploadReceipt
} = require('../controllers/expenseController')

router.get('/pending-review', can('expenses:read'), getPendingReview)
router.get('/',        can('expenses:read'),   getExpenses)
router.get('/:id',     can('expenses:read'),   getExpense)
router.post('/',       can('expenses:write'),  createExpense)
router.post('/upload-receipt', can('expenses:write'), receiptUploadMiddleware, uploadReceipt)
router.put('/:id',     can('expenses:write'),  updateExpense)
router.patch('/:id/approve', can('expenses:write'), approveExpense)
router.patch('/:id/reject',  can('expenses:write'), rejectExpense)
router.patch('/:id/void', can('expenses:delete'), voidExpense)
router.delete('/:id',  can('expenses:delete'), deleteExpense)

// Fraud risk score endpoint
router.get('/:id/risk', can('expenses:read'), async (req, res) => {
  try {
    const tenantClient = require('../lib/tenantClient')
    const { scoreFraudRisk } = require('../lib/fraudRiskScorer')
    const db = tenantClient(req.user.tenantId)
    const expense = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!expense) return res.status(404).json({ error: 'Expense not found' })
    const risk = scoreFraudRisk(expense)
    res.json(risk)
  } catch (err) {
    console.error('[risk] expense risk error:', err.message)
    res.status(500).json({ error: 'Failed to compute risk score' })
  }
})

module.exports = router
