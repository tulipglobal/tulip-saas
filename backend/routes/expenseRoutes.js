const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const {
  getExpenses, getExpense,
  createExpense, updateExpense, deleteExpense
} = require('../controllers/expenseController')

router.get('/',       authenticate, getExpenses)
router.get('/:id',    authenticate, getExpense)
router.post('/',      authenticate, authorize('admin'), createExpense)
router.put('/:id',    authenticate, authorize('admin'), updateExpense)
router.delete('/:id', authenticate, authorize('admin'), deleteExpense)

module.exports = router
