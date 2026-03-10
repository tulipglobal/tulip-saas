// ─────────────────────────────────────────────────────────────
//  routes/ocrPublicRoutes.js — Public OCR document access (no auth)
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const { getPresignedUrlFromKey } = require('../lib/s3Upload')

// GET /api/public/ocr/:jobId/document — presigned URL for OCR job file
router.get('/:jobId/document', async (req, res) => {
  try {
    const job = await prisma.ocrJob.findUnique({
      where: { id: req.params.jobId },
      select: { s3Key: true, fileType: true, originalFilename: true, status: true },
    })
    if (!job || !job.s3Key) return res.status(404).json({ error: 'Document not found' })

    const url = await getPresignedUrlFromKey(job.s3Key, 3600)
    if (!url) return res.status(500).json({ error: 'Could not generate URL' })

    res.json({ url, fileType: job.fileType, name: job.originalFilename, expiresIn: 3600 })
  } catch (err) {
    console.error('Failed to get OCR document:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

module.exports = router
