const express = require('express')
const router = express.Router()
const { can } = require('../middleware/permission')
const ctrl = require('../controllers/budgetController')

router.get('/funding-sources',       can('projects:read'),  ctrl.listAllFundingSources)
router.get('/',                      can('projects:read'),  ctrl.list)
router.get('/:id',                   can('projects:read'),  ctrl.get)
router.post('/',                     can('projects:write'), ctrl.create)
router.put('/:id',                   can('projects:write'), ctrl.update)
router.delete('/:id',               can('projects:write'), ctrl.remove)
router.post('/:id/funding-sources',  can('projects:write'), ctrl.addFundingSource)
router.delete('/:id/funding-sources/:sourceId', can('projects:write'), ctrl.removeFundingSource)

module.exports = router
