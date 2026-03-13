const tenantClient = require('../lib/tenantClient')
const prisma = require('../lib/client')
const { uploadToS3, computeSHA256 } = require('../lib/s3Upload')
const { createAuditLog } = require('../services/auditService')
const { notifyDocumentUploaded, notifyDonorsNewDocument, notifySealIssued } = require('../services/emailNotificationService')
const { dispatch: webhookDispatch } = require('../services/webhookService')
const { KEY_DOCUMENT_CATEGORIES, isKeyCategory } = require('../lib/documentCategories')
const { autoIssueSeal } = require('../services/universalSealService')
const { detectDuplicates } = require('../lib/hybridDuplicateDetector')
const { scoreFraudRisk } = require('../lib/fraudRiskScorer')
const multer = require('multer')

// Multer — memory storage (buffer for SHA-256 + S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.xlsx','.xls','.jpg','.jpeg','.png','.csv']
    const ext = '.' + file.originalname.split('.').pop().toLowerCase()
    allowed.includes(ext) ? cb(null, true) : cb(new Error('File type not allowed'))
  }
})

exports.uploadMiddleware = upload.single('file')

// GET /api/documents
exports.getDocuments = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { projectId, expenseId, documentLevel } = req.query
    const documents = await db.document.findMany({
      where: {
        ...(projectId && { projectId }),
        ...(expenseId && { expenseId }),
        ...(documentLevel && { documentLevel }),
      },
      include: {
        project: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
        expense: { select: { id: true, description: true, amount: true, currency: true } }
      },
      orderBy: { uploadedAt: 'desc' }
    })
    res.json({ data: documents, total: documents.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
}

// GET /api/documents/:id
exports.getDocument = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const document = await db.document.findFirst({
      where: { id: req.params.id },
      include: {
        project: true,
        expense: true,
        uploadedBy: { select: { id: true, name: true } }
      }
    })
    if (!document) return res.status(404).json({ error: 'Document not found' })
    res.json(document)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch document' })
  }
}

// POST /api/documents
exports.createDocument = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, description, documentType, documentLevel, projectId, expenseId, category, expiryDate } = req.body

    if (!name) return res.status(400).json({ error: 'name is required' })
    if (!req.file) return res.status(400).json({ error: 'file is required' })

    // Compute SHA-256 of file
    const sha256Hash = computeSHA256(req.file.buffer)

    // Check for duplicate hash within tenant
    const existingDoc = await db.document.findFirst({
      where: { sha256Hash },
      select: { id: true, name: true, uploadedAt: true },
    })
    if (existingDoc && !req.query.allowDuplicate) {
      return res.status(409).json({
        error: 'duplicate_hash',
        message: `This document was previously submitted on ${new Date(existingDoc.uploadedAt).toLocaleDateString()} as "${existingDoc.name}"`,
        existingDocumentId: existingDoc.id,
        existingDocumentName: existingDoc.name,
        existingUploadedAt: existingDoc.uploadedAt,
      })
    }

    // Upload to S3
    const { fileUrl, key: s3FileKey } = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.user.tenantId,
      `documents/${documentLevel || 'project'}`
    )

    // Verify project/expense belong to tenant
    if (projectId) {
      const project = await db.project.findFirst({ where: { id: projectId } })
      if (!project) return res.status(404).json({ error: 'Project not found' })
    }
    if (expenseId) {
      const expense = await db.expense.findFirst({ where: { id: expenseId } })
      if (!expense) return res.status(404).json({ error: 'Expense not found' })
    }

    // Check if user is admin — admins get auto-approved docs
    const adminRole = await prisma.userRole.findFirst({
      where: { userId: req.user.userId, tenantId: req.user.tenantId, role: { name: 'admin' } },
    })
    const isUserAdmin = !!adminRole

    const document = await db.document.create({
      data: {
        name,
        description: description || null,
        documentType: documentType || null,
        documentLevel: documentLevel || 'project',
        fileUrl,
        fileType: req.file.originalname.split('.').pop().toLowerCase(),
        fileSize: req.file.size,
        sha256Hash,
        projectId: projectId || null,
        expenseId: expenseId || null,
        uploadedById: req.user.userId,
        category: category || null,
        expiryDate: (category && isKeyCategory(category) && expiryDate) ? new Date(expiryDate) : null,
        approvalStatus: isUserAdmin ? 'approved' : 'pending_review',
      },
      include: {
        project: { select: { id: true, name: true } },
        expense: { select: { id: true, description: true, amount: true } }
      }
    })

    // Non-admin uploads: create workflow task for approval
    if (!isUserAdmin) {
      prisma.workflowTask.create({
        data: {
          tenantId: req.user.tenantId,
          type: 'document_approval',
          title: `Document approval: ${name}`,
          description: `New document "${name}" uploaded and requires review.`,
          entityId: document.id,
          entityType: 'document',
          submittedBy: req.user.userId,
        },
      }).catch(err => console.error('[workflow] auto-create task failed:', err.message))
    }

    // Create audit log entry for blockchain anchoring
    await createAuditLog({
      action: 'DOCUMENT_UPLOADED',
      entityType: 'Document',
      entityId: document.id,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      metadata: {
        name: document.name,
        sha256Hash,
        fileType: document.fileType,
        fileSize: document.fileSize,
        documentLevel: document.documentLevel,
        projectId: document.projectId,
        expenseId: document.expenseId,
      }
    })

    // Auto-issue Trust Seal (non-blocking but awaited for documentId linkage)
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { name: true } })
    const orgName = tenant?.name || 'Organization'
    const docSeal = await autoIssueSeal({
      documentTitle: name,
      documentType: 'ngo-document',
      rawHash: sha256Hash,
      issuedBy: orgName,
      issuedTo: orgName,
      tenantId: req.user.tenantId,
      fileKey: s3FileKey,
      fileType: document.fileType,
      metadata: { source: 'document-upload', documentId: document.id, documentLevel: document.documentLevel },
    }).catch(err => { console.error('[seal] auto-issue failed:', err.message); return null })
    // Set entity reference + ocrEngine on seal
    if (docSeal) {
      prisma.trustSeal.update({
        where: { id: docSeal.id },
        data: { documentId: document.id, ocrEngine: 'TEXTRACT', sourceType: 'DASHBOARD' },
      }).catch(err => console.error('[seal] documentId update failed:', err.message))
      notifySealIssued({ tenantId: req.user.tenantId, documentName: name, documentType: documentType || 'Document', sealId: docSeal.id }).catch(() => {})
    }

    // Hybrid duplicate detection — OCR fingerprint + pHash combined (non-blocking)
    const ocrExtTypes = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif']
    const pHashTypes = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'gif']
    const ft = (document.fileType || '').toLowerCase()
    if (ocrExtTypes.includes(ft) || pHashTypes.includes(ft)) {
      ;(async () => {
        try {
          let ocrRawText = null
          if (ocrExtTypes.includes(ft)) {
            const { extractText } = require('../services/ocrService')
            const ocrResult = await extractText(s3FileKey)
            ocrRawText = ocrResult.rawText
          }

          const dupResult = await detectDuplicates({
            fileBuffer: req.file.buffer,
            fileType: document.fileType,
            ocrRawText,
            documentId: document.id,
            tenantId: req.user.tenantId,
            userId: req.user.userId,
            entityTable: 'document',
          })

          if (Object.keys(dupResult.updateData).length > 0) {
            await db.document.update({
              where: { id: document.id },
              data: dupResult.updateData,
            })
          }

          // Copy duplicate detection fields to TrustSeal
          if (docSeal) {
            const sealDupData = {}
            if (dupResult.ocrFingerprint) sealDupData.ocrFingerprint = dupResult.ocrFingerprint
            if (dupResult.pHash) sealDupData.pHash = dupResult.pHash
            if (dupResult.updateData) {
              if (dupResult.updateData.isDuplicate) sealDupData.isDuplicate = true
              if (dupResult.updateData.duplicateOfId) sealDupData.duplicateOfId = dupResult.updateData.duplicateOfId
              if (dupResult.updateData.duplicateOfName) sealDupData.duplicateOfName = dupResult.updateData.duplicateOfName
              if (dupResult.updateData.crossTenantDuplicate) sealDupData.crossTenantDuplicate = true
              if (dupResult.updateData.isVisualDuplicate) sealDupData.isVisualDuplicate = true
            }
            if (dupResult.confidence) sealDupData.duplicateConfidence = dupResult.confidence
            if (dupResult.method) sealDupData.duplicateMethod = dupResult.method
            if (Object.keys(sealDupData).length > 0) {
              prisma.trustSeal.update({
                where: { id: docSeal.id },
                data: sealDupData,
              }).catch(err => console.error('[seal-dup] update failed:', err.message))
            }
          }

          // Fraud risk scoring
          const updatedDoc = await db.document.findFirst({ where: { id: document.id } })
          if (updatedDoc) {
            const risk = scoreFraudRisk(updatedDoc)
            await db.document.update({
              where: { id: document.id },
              data: { fraudRiskScore: risk.score, fraudRiskLevel: risk.level, fraudSignals: risk.breakdown.signals },
            })
            // Copy fraud risk to TrustSeal
            if (docSeal) {
              prisma.trustSeal.update({
                where: { id: docSeal.id },
                data: {
                  fraudRiskScore: risk.score,
                  fraudRiskLevel: risk.level,
                  fraudSignals: risk.breakdown.signals,
                },
              }).catch(err => console.error('[seal-fraud] update failed:', err.message))
            }
            if (risk.score > 0) {
              createAuditLog({
                action: 'FRAUD_RISK_SCORED',
                entityType: 'Document',
                entityId: document.id,
                userId: req.user.userId,
                tenantId: req.user.tenantId,
                dataHash: JSON.stringify({ score: risk.score, level: risk.level, signals: risk.breakdown.signals }),
              }).catch(() => {})
              console.log(`[fraud-risk] doc=${document.id} score=${risk.score} level=${risk.level}`)
            }
          }
        } catch (err) {
          console.error('[hybrid-dup] document detection failed:', err.message)
        }
      })()
    }

    // Notify admin (non-blocking)
    notifyDocumentUploaded({
      tenantId: req.user.tenantId,
      documentName: document.name,
      uploaderName: req.user.name || null,
      projectName: document.project?.name || null,
    }).catch(() => {})

    // Webhook: document.created (non-blocking)
    webhookDispatch(req.user.tenantId, 'document.created', {
      id: document.id, name: document.name, category: document.category || null,
      sha256Hash, projectId: document.projectId, fileType: document.fileType,
    }).catch(() => {})

    // Notify linked donors (non-blocking)
    notifyDonorsNewDocument({
      tenantId: req.user.tenantId,
      documentName: document.name,
      projectName: document.project?.name || null,
      category: document.category || null,
    }).catch(() => {})

    res.status(201).json(document)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Failed to create document' })
  }
}

// PATCH /api/documents/:id
exports.updateDocument = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.document.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Document not found' })

    const { name, description, documentType, category, expiryDate } = req.body
    const data = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (documentType !== undefined) data.documentType = documentType
    if (category !== undefined) {
      data.category = category || null
      // Only save expiryDate if category is a key type
      if (isKeyCategory(category) && expiryDate !== undefined) {
        data.expiryDate = expiryDate ? new Date(expiryDate) : null
        // Reset alert flags when expiry date changes
        data.expiryAlertSent30 = false
        data.expiryAlertSent7 = false
        data.expiryAlertSent1 = false
      } else if (!isKeyCategory(category)) {
        data.expiryDate = null
      }
    } else if (expiryDate !== undefined && isKeyCategory(existing.category)) {
      data.expiryDate = expiryDate ? new Date(expiryDate) : null
      data.expiryAlertSent30 = false
      data.expiryAlertSent7 = false
      data.expiryAlertSent1 = false
    }

    const document = await db.document.update({
      where: { id: req.params.id },
      data,
      include: { project: { select: { id: true, name: true } } }
    })
    res.json(document)
  } catch (err) {
    console.error('[document/update]', err)
    res.status(500).json({ error: 'Failed to update document' })
  }
}

// GET /api/documents/expiring
exports.getExpiring = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const documents = await db.document.findMany({
      where: {
        category: { in: KEY_DOCUMENT_CATEGORIES },
        expiryDate: { not: null, lte: thirtyDays },
      },
      include: {
        project: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    })

    res.json({ data: documents })
  } catch (err) {
    console.error('[document/expiring]', err)
    res.status(500).json({ error: 'Failed to fetch expiring documents' })
  }
}

// DELETE /api/documents/:id
exports.deleteDocument = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.document.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Document not found' })
    await db.document.delete({ where: { id: req.params.id } })
    res.json({ message: 'Document deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' })
  }
}

// GET /api/documents/:id/view — returns presigned URL
exports.getDocumentUrl = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const document = await db.document.findFirst({ where: { id: req.params.id } })
    if (!document) return res.status(404).json({ error: 'Document not found' })
    const { getPresignedUrl } = require('../lib/s3Upload')
    const url = await getPresignedUrl(document.fileUrl)
    if (!url) return res.status(500).json({ error: 'Could not generate view URL' })
    res.json({ url, expiresIn: 3600 })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get document URL' })
  }
}
