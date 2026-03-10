// ─────────────────────────────────────────────────────────────
//  routes/casePublicRoutes.js — Public case view (no auth)
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// GET /api/public/cases/:shareToken — public case summary
router.get('/:shareToken', async (req, res) => {
  try {
    const caseRecord = await prisma.verificationCase.findUnique({
      where: { shareToken: req.params.shareToken },
      include: {
        tenant: { select: { name: true, tenantType: true, logoUrl: true } },
        ocrJobs: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, originalFilename: true, status: true, documentType: true,
            assessmentScore: true, assessmentResult: true, hashValue: true,
            anchorTxHash: true, anchoredAt: true, createdAt: true,
            detectedLanguage: true,
          },
        },
        bundleJobs: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, name: true, status: true, fileCount: true, completedCount: true,
            overallRiskScore: true, overallRiskLevel: true, bundleHash: true,
            anchorTxHash: true, anchoredAt: true, crossAnalysisJson: true, createdAt: true,
          },
        },
      },
    })

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' })
    }

    // Don't expose archived cases publicly
    if (caseRecord.status === 'ARCHIVED') {
      return res.status(404).json({ error: 'Case not found' })
    }

    res.json({
      id: caseRecord.id,
      name: caseRecord.name,
      clientName: caseRecord.clientName,
      caseType: caseRecord.caseType,
      status: caseRecord.status,
      overallRiskScore: caseRecord.overallRiskScore,
      createdAt: caseRecord.createdAt,
      updatedAt: caseRecord.updatedAt,
      organisation: {
        name: caseRecord.tenant.name,
        type: caseRecord.tenant.tenantType,
        logoUrl: caseRecord.tenant.logoUrl,
      },
      documents: caseRecord.ocrJobs.map(job => ({
        id: job.id,
        filename: job.originalFilename,
        status: job.status,
        documentType: job.documentType,
        assessmentScore: job.assessmentScore,
        assessmentResult: job.assessmentResult,
        hashValue: job.hashValue,
        detectedLanguage: job.detectedLanguage,
        blockchain: {
          network: 'Polygon',
          txHash: job.anchorTxHash || null,
          anchorStatus: job.anchorTxHash ? 'confirmed' : 'pending',
          anchoredAt: job.anchoredAt || null,
        },
        createdAt: job.createdAt,
      })),
      bundles: caseRecord.bundleJobs.map(bundle => ({
        id: bundle.id,
        name: bundle.name,
        status: bundle.status,
        fileCount: bundle.fileCount,
        completedCount: bundle.completedCount,
        overallRiskScore: bundle.overallRiskScore,
        overallRiskLevel: bundle.overallRiskLevel,
        bundleHash: bundle.bundleHash,
        crossAnalysis: bundle.crossAnalysisJson,
        blockchain: {
          network: 'Polygon',
          txHash: bundle.anchorTxHash || null,
          anchorStatus: bundle.anchorTxHash ? 'confirmed' : 'pending',
          anchoredAt: bundle.anchoredAt || null,
        },
        createdAt: bundle.createdAt,
      })),
      documentCount: caseRecord.ocrJobs.length,
      bundleCount: caseRecord.bundleJobs.length,
    })
  } catch (err) {
    console.error('Failed to get public case:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

module.exports = router
