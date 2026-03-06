// ─────────────────────────────────────────────────────────────
//  routes/documentRoutes.js — v2
// ─────────────────────────────────────────────────────────────
const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  getDocuments, getDocument,
  createDocument, deleteDocument
} = require('../controllers/documentController')

router.get('/',        can('documents:read'),   getDocuments)
router.get('/:id',     can('documents:read'),   getDocument)
router.post('/',       can('documents:write'),  createDocument)
router.delete('/:id',  can('documents:delete'), deleteDocument)

module.exports = router
