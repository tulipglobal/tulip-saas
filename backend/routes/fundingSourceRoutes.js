const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const {
  getFundingSources, getFundingSource,
  createFundingSource, updateFundingSource, deleteFundingSource
} = require('../controllers/fundingSourceController')

router.get('/',       authenticate, getFundingSources)
router.get('/:id',    authenticate, getFundingSource)
router.post('/',      authenticate, authorize('admin'), createFundingSource)
router.put('/:id',    authenticate, authorize('admin'), updateFundingSource)
router.delete('/:id', authenticate, authorize('admin'), deleteFundingSource)

module.exports = router
