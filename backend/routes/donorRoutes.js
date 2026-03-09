const express = require('express')
const router = express.Router()
const { can } = require('../middleware/permission')
const { listDonors, getDonor, createDonor, updateDonor } = require('../controllers/donorController')

router.get('/',    can('projects:read'), listDonors)
router.get('/:id', can('projects:read'), getDonor)
router.post('/',   can('projects:write'), createDonor)
router.put('/:id', can('projects:write'), updateDonor)

module.exports = router
