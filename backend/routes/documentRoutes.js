const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  getDocuments, getDocument,
  createDocument, deleteDocument,
  uploadMiddleware, getDocumentUrl
} = require('../controllers/documentController')

router.get('/',        can('documents:read'),   getDocuments)
router.get('/:id',     can('documents:read'),   getDocument)
router.post('/',       can('documents:write'),  uploadMiddleware, createDocument)
router.get('/:id/view', can('documents:read'), getDocumentUrl)
router.delete('/:id',  can('documents:delete'), deleteDocument)

module.exports = router
