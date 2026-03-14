const express = require('express')
const router = express.Router()
const { can } = require('../middleware/permission')
const ctrl = require('../controllers/fundingAgreementController')

router.get('/',    can('projects:read'),  ctrl.list)
router.get('/:id', can('projects:read'),  ctrl.get)
router.post('/',   can('projects:write'), ctrl.create)
router.put('/:id', can('projects:write'), ctrl.update)

// Repayments
router.get('/:id/repayments',                  can('projects:read'),  ctrl.listRepayments)
router.post('/:id/repayments',                 can('projects:write'), ctrl.createRepayment)
router.put('/:id/repayments/:repaymentId',     can('projects:write'), ctrl.updateRepayment)

// Project funding
router.post('/:id/projects',                   can('projects:write'), ctrl.linkProject)
router.delete('/:id/projects/:projectId',      can('projects:write'), ctrl.unlinkProject)

// Link donor organisation
router.post('/:id/link-donor',                 can('projects:write'), ctrl.linkDonor)

module.exports = router
