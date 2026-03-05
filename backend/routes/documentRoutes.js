const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const {
  getDocuments, getDocument,
  createDocument, deleteDocument
} = require('../controllers/documentController')

router.get('/',       authenticate, getDocuments)
router.get('/:id',    authenticate, getDocument)
router.post('/',      authenticate, authorize('admin'), createDocument)
router.delete('/:id', authenticate, authorize('admin'), deleteDocument)

module.exports = router
