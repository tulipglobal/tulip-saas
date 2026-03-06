// ─────────────────────────────────────────────────────────────
//  routes/expenseRoutes.js — v2
// ─────────────────────────────────────────────────────────────
const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  getExpenses, getExpense,
  createExpense, updateExpense, deleteExpense
} = require('../controllers/expenseController')

router.get('/',        can('expenses:read'),   getExpenses)
router.get('/:id',     can('expenses:read'),   getExpense)
router.post('/',       can('expenses:write'),  createExpense)
router.put('/:id',     can('expenses:write'),  updateExpense)
router.delete('/:id',  can('expenses:delete'), deleteExpense)

module.exports = router
