const express = require('express')
const router = express.Router()
const donorAuth = require('../middleware/donorAuthenticate')
const ctrl = require('../controllers/donorDocumentController')

// All routes require donor JWT
router.use(donorAuth)

router.get('/stats', ctrl.getStats)
router.get('/:id', ctrl.getDocument)
router.get('/', ctrl.listDocuments)

module.exports = router
