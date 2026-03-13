const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const {
  getDocuments, getDocument,
  createDocument, updateDocument, deleteDocument,
  uploadMiddleware, uploadBulkMiddleware, bulkUpload,
  getDocumentUrl, getExpiring
} = require('../controllers/documentController')

// PUBLIC - no auth - must be first
router.get('/:id/view/public', async (req, res) => {
  try {
    const prisma = require('../prisma/client')
    const document = await prisma.document.findFirst({ where: { id: req.params.id } })
    if (!document) return res.status(404).json({ error: 'Document not found' })
    const { getPresignedUrl } = require('../lib/s3Upload')
    const url = await getPresignedUrl(document.fileUrl)
    if (!url) return res.status(500).json({ error: 'Could not generate view URL' })
    res.json({ url, expiresIn: 3600 })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get document URL' })
  }
})

// AUTHENTICATED routes
router.get('/expiring',  can('documents:read'),   getExpiring)
router.get('/',          can('documents:read'),   getDocuments)
router.get('/:id',       can('documents:read'),   getDocument)
router.post('/',         can('documents:write'),  uploadMiddleware, createDocument)
router.post('/bulk',     can('documents:write'),  uploadBulkMiddleware, bulkUpload)
router.patch('/:id',     can('documents:write'),  updateDocument)
router.get('/:id/view',  can('documents:read'),   getDocumentUrl)
router.delete('/:id',    can('documents:delete'), deleteDocument)

// Fraud risk score endpoint
router.get('/:id/risk', can('documents:read'), async (req, res) => {
  try {
    const tenantClient = require('../lib/tenantClient')
    const { scoreFraudRisk } = require('../lib/fraudRiskScorer')
    const db = tenantClient(req.user.tenantId)
    const doc = await db.document.findFirst({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    const risk = scoreFraudRisk(doc)
    res.json(risk)
  } catch (err) {
    console.error('[risk] document risk error:', err.message)
    res.status(500).json({ error: 'Failed to compute risk score' })
  }
})

module.exports = router
