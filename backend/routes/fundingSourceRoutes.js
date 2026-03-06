// ─────────────────────────────────────────────────────────────
//  routes/fundingSourceRoutes.js — v2
// ─────────────────────────────────────────────────────────────
const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  getFundingSources, getFundingSource,
  createFundingSource, updateFundingSource, deleteFundingSource
} = require('../controllers/fundingSourceController')

router.get('/',        can('funding:read'),   getFundingSources)
router.get('/:id',     can('funding:read'),   getFundingSource)
router.post('/',       can('funding:write'),  createFundingSource)
router.put('/:id',     can('funding:write'),  updateFundingSource)
router.delete('/:id',  can('funding:delete'), deleteFundingSource)

module.exports = router
