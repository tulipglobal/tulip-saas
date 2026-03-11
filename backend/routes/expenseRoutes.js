// ─────────────────────────────────────────────────────────────
//  routes/expenseRoutes.js — v3
// ─────────────────────────────────────────────────────────────
const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  getExpenses, getExpense,
  createExpense, updateExpense, deleteExpense,
  receiptUploadMiddleware, uploadReceipt
} = require('../controllers/expenseController')

router.get('/',        can('expenses:read'),   getExpenses)
router.get('/:id',     can('expenses:read'),   getExpense)
router.post('/',       can('expenses:write'),  createExpense)
router.post('/upload-receipt', can('expenses:write'), receiptUploadMiddleware, uploadReceipt)
router.put('/:id',     can('expenses:write'),  updateExpense)
router.delete('/:id',  can('expenses:delete'), deleteExpense)

module.exports = router
