// ─────────────────────────────────────────────────────────────
//  routes/reportPublicRoutes.js — Public report access via share token
//
//  Mounted at /api/public/reports (no auth required).
//  Validates share token, increments view count, returns presigned URL.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const { getPresignedUrlFromKey } = require('../lib/s3Upload')

// ── GET /api/public/reports/:token ───────────────────────────
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params

    // Find share link
    const links = await prisma.$queryRawUnsafe(`
      SELECT sl.*, gr.name as "reportName", gr."fileKey", gr."fileUrl", gr.hash, gr.status, gr."reportType"
      FROM "ReportShareLink" sl
      JOIN "GeneratedReport" gr ON gr.id = sl."reportId"
      WHERE sl.token = $1
    `, token)

    if (links.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired report token' })
    }

    const link = links[0]

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This report link has expired' })
    }

    // Check report status
    if (link.status !== 'READY') {
      return res.status(202).json({ error: 'Report is still being generated', status: link.status })
    }

    // Increment view count
    await prisma.$executeRawUnsafe(`
      UPDATE "ReportShareLink" SET "viewCount" = "viewCount" + 1, "lastViewedAt" = NOW() WHERE id = $1
    `, link.id)

    // Generate presigned URL
    const presignedUrl = link.fileKey
      ? await getPresignedUrlFromKey(link.fileKey, 3600, { contentType: 'application/pdf' })
      : null

    res.json({
      reportName: link.reportName,
      reportType: link.reportType,
      hash: link.hash,
      fileUrl: presignedUrl || link.fileUrl,
      viewCount: (link.viewCount || 0) + 1,
    })
  } catch (err) {
    console.error('Public report access error:', err)
    res.status(500).json({ error: 'Failed to access report' })
  }
})

module.exports = router
