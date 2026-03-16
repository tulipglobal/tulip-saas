// ─────────────────────────────────────────────────────────────
//  controllers/donorDocumentController.js
//  Read-only document access for donor portal
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')

// Helper: resolve tenantIds linked to a donor via funding agreements
async function getDonorTenantIds(donorId) {
  const agreements = await prisma.fundingAgreement.findMany({
    where: { donorId },
    select: { tenantId: true },
    distinct: ['tenantId'],
  })
  return agreements.map(a => a.tenantId)
}

// GET /api/donor/documents
exports.listDocuments = async (req, res) => {
  try {
    const { donorId } = req.donorUser
    const tenantIds = await getDonorTenantIds(donorId)

    if (tenantIds.length === 0) {
      return res.json({ data: [], total: 0 })
    }

    const documents = await prisma.document.findMany({
      where: { tenantId: { in: tenantIds }, approvalStatus: { in: ['APPROVED', 'approved'] } },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        fileType: true,
        fileSize: true,
        sha256Hash: true,
        fileUrl: true,
        uploadedAt: true,
        documentLevel: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    // Fetch blockchain status from audit logs for these documents
    const docIds = documents.map(d => d.id)
    const auditLogs = docIds.length > 0
      ? await prisma.auditLog.findMany({
          where: {
            entityType: 'Document',
            entityId: { in: docIds },
          },
          select: {
            entityId: true,
            blockchainTx: true,
            anchorStatus: true,
            ancheredAt: true,
            dataHash: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : []

    // Build a map: documentId → best audit log (prefer confirmed)
    const auditMap = {}
    for (const log of auditLogs) {
      if (!auditMap[log.entityId] || log.anchorStatus === 'confirmed') {
        auditMap[log.entityId] = log
      }
    }

    // Enrich documents with blockchain data
    const enriched = documents.map(doc => ({
      ...doc,
      blockchainTx: auditMap[doc.id]?.blockchainTx || null,
      anchorStatus: auditMap[doc.id]?.anchorStatus || 'pending',
      anchoredAt: auditMap[doc.id]?.ancheredAt || null,
      auditHash: auditMap[doc.id]?.dataHash || null,
    }))

    res.json({ data: enriched, total: enriched.length })
  } catch (err) {
    console.error('[donor/documents] list error:', err)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
}

// GET /api/donor/documents/:id
exports.getDocument = async (req, res) => {
  try {
    const { donorId } = req.donorUser
    const tenantIds = await getDonorTenantIds(donorId)

    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        tenantId: { in: tenantIds },
        approvalStatus: { in: ['APPROVED', 'approved'] },
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        fileType: true,
        fileSize: true,
        sha256Hash: true,
        fileUrl: true,
        uploadedAt: true,
        documentLevel: true,
        project: { select: { id: true, name: true } },
      },
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })

    // Get blockchain status
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: 'Document',
        entityId: document.id,
        anchorStatus: 'confirmed',
      },
      select: {
        blockchainTx: true,
        anchorStatus: true,
        ancheredAt: true,
        dataHash: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      ...document,
      blockchainTx: auditLog?.blockchainTx || null,
      anchorStatus: auditLog?.anchorStatus || 'pending',
      anchoredAt: auditLog?.ancheredAt || null,
      auditHash: auditLog?.dataHash || null,
    })
  } catch (err) {
    console.error('[donor/documents] get error:', err)
    res.status(500).json({ error: 'Failed to fetch document' })
  }
}

// GET /api/donor/documents/:id/view — returns presigned URL for donor to view the file
exports.viewDocument = async (req, res) => {
  try {
    const { donorId } = req.donorUser
    const tenantIds = await getDonorTenantIds(donorId)

    const document = await prisma.document.findFirst({
      where: {
        id: req.params.id,
        tenantId: { in: tenantIds },
        approvalStatus: { in: ['APPROVED', 'approved'] },
      },
      select: { id: true, fileUrl: true },
    })

    if (!document) return res.status(404).json({ error: 'Document not found' })
    if (!document.fileUrl) return res.status(404).json({ error: 'No file attached' })

    const { getPresignedUrl } = require('../lib/s3Upload')
    const url = await getPresignedUrl(document.fileUrl)
    if (!url) return res.status(500).json({ error: 'Could not generate view URL' })

    res.json({ url, expiresIn: 3600 })
  } catch (err) {
    console.error('[donor/documents] view error:', err)
    res.status(500).json({ error: 'Failed to get document URL' })
  }
}

// GET /api/donor/documents/stats
exports.getStats = async (req, res) => {
  try {
    const { donorId } = req.donorUser
    const tenantIds = await getDonorTenantIds(donorId)

    if (tenantIds.length === 0) {
      return res.json({ total: 0, verified: 0, thisMonth: 0, lastUpdated: null })
    }

    const [total, thisMonthDocs, latestDoc] = await Promise.all([
      prisma.document.count({ where: { tenantId: { in: tenantIds } } }),
      prisma.document.count({
        where: {
          tenantId: { in: tenantIds },
          uploadedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.document.findFirst({
        where: { tenantId: { in: tenantIds } },
        select: { uploadedAt: true },
        orderBy: { uploadedAt: 'desc' },
      }),
    ])

    // Count verified (documents with confirmed audit logs)
    const allDocIds = await prisma.document.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true },
    })
    const verified = allDocIds.length > 0
      ? await prisma.auditLog.groupBy({
          by: ['entityId'],
          where: {
            entityType: 'Document',
            entityId: { in: allDocIds.map(d => d.id) },
            anchorStatus: 'confirmed',
          },
        }).then(r => r.length)
      : 0

    res.json({
      total,
      verified,
      thisMonth: thisMonthDocs,
      lastUpdated: latestDoc?.uploadedAt || null,
    })
  } catch (err) {
    console.error('[donor/documents] stats error:', err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
}
