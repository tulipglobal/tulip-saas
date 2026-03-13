const { createAuditLog } = require('../services/auditService')
const { notifyExpenseAdded } = require('../services/emailNotificationService')
const { dispatch: webhookDispatch } = require('../services/webhookService')
const { checkMismatches } = require('../lib/mismatchChecker')
const { generateOcrFingerprint } = require('../lib/ocrFingerprint')
const { detectDuplicates } = require('../lib/hybridDuplicateDetector')
const { scoreFraudRisk } = require('../lib/fraudRiskScorer')
const prisma = require('../lib/client')
// ─────────────────────────────────────────────────────────────
//  controllers/expenseController.js — v2
//  ✔ Paginated list with ?page, ?limit, ?projectId filter
// ─────────────────────────────────────────────────────────────

const tenantClient = require('../lib/tenantClient')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

exports.getExpenses = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)

    const where = {}
    if (req.query.projectId)       where.projectId       = req.query.projectId
    if (req.query.fundingSourceId) where.fundingSourceId = req.query.fundingSourceId

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where, skip, take,
        include: { fundingSource: true, fundingAgreement: { select: { id: true, title: true, donor: { select: { name: true } } } }, budget: { select: { id: true, name: true } }, budgetLine: { select: { id: true, category: true, subCategory: true, approvedAmount: true } }, project: { select: { id: true, name: true } }, documents: { select: { id: true, name: true, sha256Hash: true, fileType: true, uploadedAt: true, isDuplicate: true, duplicateOfName: true, crossTenantDuplicate: true, isVisualDuplicate: true, visualDuplicateOfName: true, crossTenantVisualDuplicate: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      db.expense.count({ where })
    ])

    res.json(paginatedResponse(expenses, total, page, limit))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
}

exports.getExpense = async (req, res) => {
  try {
    const db      = tenantClient(req.user.tenantId)
    const expense = await db.expense.findFirst({
      where:   { id: req.params.id },
      include: { fundingSource: true, fundingAgreement: { select: { id: true, title: true, donor: { select: { name: true } } } }, project: { select: { id: true, name: true } }, documents: { select: { id: true, name: true, sha256Hash: true, fileType: true, fileSize: true, uploadedAt: true } } }
    })
    if (!expense) return res.status(404).json({ error: 'Expense not found' })
    res.json(expense)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense' })
  }
}

exports.createExpense = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { title, description, amount, currency, projectId, fundingSourceId, fundingAgreementId,
            expenseType, category, subCategory, budgetId, budgetLineId, vendor,
            receiptFileKey, receiptHash, receiptSealId,
            ocrAmount, ocrVendor, ocrDate, expenseDate } = req.body
    const expenseTitle = title || description
    if (!expenseTitle || !amount) {
      return res.status(400).json({ error: 'title and amount are required' })
    }
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number greater than zero' })
    }

    // Budget enforcement: if budgetLineId is provided, check remaining balance
    if (budgetLineId) {
      const line = await prisma.budgetLine.findUnique({ where: { id: budgetLineId } })
      if (!line) return res.status(400).json({ error: 'Budget line not found' })

      const spentAgg = await prisma.expense.aggregate({
        where: { budgetLineId },
        _sum: { amount: true }
      })
      const alreadySpent = Number(spentAgg._sum.amount || 0)
      const remaining = line.approvedAmount - alreadySpent
      if (parseFloat(amount) > remaining) {
        return res.status(400).json({
          error: `Over budget: this line has ${line.currency} ${remaining.toLocaleString()} remaining (approved: ${line.approvedAmount.toLocaleString()}, spent: ${alreadySpent.toLocaleString()})`
        })
      }
    }

    // Compute mismatch flags if OCR values provided
    const mismatch = (ocrAmount != null || ocrVendor || ocrDate)
      ? checkMismatches(
          { amount: parseFloat(amount), vendor: vendor || null, expenseDate: expenseDate || null },
          { ocrAmount: ocrAmount != null ? parseFloat(ocrAmount) : null, ocrVendor: ocrVendor || null, ocrDate: ocrDate || null }
        )
      : { amountMismatch: false, vendorMismatch: false, dateMismatch: false, mismatchNote: null }

    // ── Block HIGH/CRITICAL fraud risk before saving ──
    if (receiptSealId) {
      const seal = await prisma.trustSeal.findUnique({ where: { id: receiptSealId } })
      if (seal) {
        // Check duplicate HIGH confidence first
        if (seal.duplicateConfidence === 'HIGH' || seal.crossTenantDuplicate) {
          createAuditLog({
            action: 'EXPENSE_BLOCKED_FRAUD',
            entityType: 'Expense',
            entityId: receiptSealId,
            userId: req.user.userId,
            tenantId: req.user.tenantId,
            dataHash: JSON.stringify({ reason: 'DUPLICATE_HIGH_CONFIDENCE', duplicateConfidence: seal.duplicateConfidence, crossTenant: !!seal.crossTenantDuplicate }),
          }).catch(() => {})
          return res.status(422).json({
            error: 'DUPLICATE_HIGH_CONFIDENCE',
            message: 'Upload blocked: This receipt appears to be a duplicate.',
            duplicateExpenseId: seal.duplicateOfId || null,
          })
        }

        // Score fraud risk using expense data + seal duplicate/mismatch data
        const fraudRecord = {
          amount: parseFloat(amount),
          vendor: vendor || null,
          ocrAmount: ocrAmount != null ? parseFloat(ocrAmount) : (seal.ocrAmount || null),
          ocrVendor: ocrVendor || seal.ocrVendor || null,
          ocrDate: ocrDate || seal.ocrDate || null,
          amountMismatch: mismatch.amountMismatch,
          vendorMismatch: mismatch.vendorMismatch,
          dateMismatch: mismatch.dateMismatch,
          isDuplicate: seal.isDuplicate || false,
          crossTenantDuplicate: seal.crossTenantDuplicate || false,
          duplicateConfidence: seal.duplicateConfidence,
          isVisualDuplicate: seal.isVisualDuplicate || false,
          sealId: seal.id,
          anchorTxHash: seal.anchorTxHash,
        }
        const risk = scoreFraudRisk(fraudRecord)
        if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
          createAuditLog({
            action: 'EXPENSE_BLOCKED_FRAUD',
            entityType: 'Expense',
            entityId: receiptSealId,
            userId: req.user.userId,
            tenantId: req.user.tenantId,
            dataHash: JSON.stringify({ score: risk.score, level: risk.level, signals: risk.breakdown.signals }),
          }).catch(() => {})
          console.log(`[fraud-block] Expense blocked: score=${risk.score} level=${risk.level}`)
          return res.status(422).json({
            error: 'FRAUD_RISK_HIGH',
            message: 'Upload blocked: HIGH fraud risk detected. OCR found significant discrepancies.',
            fraudScore: risk.score,
            fraudLevel: risk.level,
            reasons: risk.breakdown.signals,
          })
        }
      }
    }

    const expense = await db.expense.create({
      data: {
        description:        expenseTitle,
        amount:             parseFloat(amount),
        currency:           currency || 'USD',
        projectId:          projectId || null,
        fundingSourceId:    fundingSourceId || null,
        fundingAgreementId: fundingAgreementId || null,
        budgetId:           budgetId || null,
        budgetLineId:       budgetLineId || null,
        expenseType:        expenseType || null,
        category:           category || null,
        subCategory:        subCategory || null,
        vendor:             vendor || null,
        receiptFileKey:     receiptFileKey || null,
        receiptHash:        receiptHash || null,
        receiptSealId:      receiptSealId || null,
        approvalStatus:     'pending_review',
        ocrAmount:          ocrAmount != null ? parseFloat(ocrAmount) : null,
        ocrVendor:          ocrVendor || null,
        ocrDate:            ocrDate || null,
        amountMismatch:     mismatch.amountMismatch,
        vendorMismatch:     mismatch.vendorMismatch,
        dateMismatch:       mismatch.dateMismatch,
        mismatchNote:       mismatch.mismatchNote,
      }
    })
    await createAuditLog({ action: 'EXPENSE_CREATED', entityType: 'Expense', entityId: expense.id, userId: req.user.userId, tenantId: req.user.tenantId }).catch(() => {})

    // Log mismatch in audit log if any flag is set
    if (mismatch.amountMismatch || mismatch.vendorMismatch || mismatch.dateMismatch) {
      createAuditLog({
        action: 'EXPENSE_MISMATCH_FLAGGED',
        entityType: 'Expense',
        entityId: expense.id,
        userId: req.user.userId,
        tenantId: req.user.tenantId,
      }).catch(() => {})
    }

    // Auto-create workflow task for expense approval
    prisma.workflowTask.create({
      data: {
        tenantId: req.user.tenantId,
        type: 'expense_approval',
        title: `Expense approval: ${expenseTitle}`,
        description: `New expense of ${currency || 'USD'} ${parseFloat(amount).toLocaleString()} requires review.`,
        entityId: expense.id,
        entityType: 'expense',
        submittedBy: req.user.userId,
      },
    }).catch(err => console.error('[workflow] auto-create expense task failed:', err.message))

    // Notify admin (non-blocking)
    notifyExpenseAdded({
      tenantId: req.user.tenantId,
      description: expenseTitle,
      amount: parseFloat(amount),
      currency: currency || 'USD',
      creatorName: req.user.name || null,
    }).catch(() => {})

    // Webhook: expense.created (non-blocking)
    webhookDispatch(req.user.tenantId, 'expense.created', {
      id: expense.id, description: expenseTitle, amount: parseFloat(amount), currency: currency || 'USD',
    }).catch(() => {})

    res.status(201).json(expense)
  } catch (err) {
    console.error('createExpense error:', err)
    res.status(500).json({ error: 'Failed to create expense' })
  }
}

exports.updateExpense = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })

    const { description, amount, currency, fundingSourceId, fundingAgreementId, expenseType, category, subCategory, budgetId, budgetLineId, vendor, receiptFileKey, receiptHash, receiptSealId } = req.body
    if (amount !== undefined && parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number greater than zero' })
    }

    const updateData = {
      ...(description        !== undefined && { description }),
      ...(amount             !== undefined && { amount: parseFloat(amount) }),
      ...(currency           !== undefined && { currency }),
      ...(fundingSourceId    !== undefined && { fundingSourceId }),
      ...(fundingAgreementId !== undefined && { fundingAgreementId }),
      ...(budgetId           !== undefined && { budgetId: budgetId || null }),
      ...(budgetLineId       !== undefined && { budgetLineId: budgetLineId || null }),
      ...(expenseType        !== undefined && { expenseType }),
      ...(category           !== undefined && { category }),
      ...(subCategory        !== undefined && { subCategory }),
      ...(vendor             !== undefined && { vendor: vendor || null }),
      ...(receiptFileKey     !== undefined && { receiptFileKey }),
      ...(receiptHash        !== undefined && { receiptHash }),
      ...(receiptSealId      !== undefined && { receiptSealId }),
    }

    // Recompute mismatches if OCR values exist on the record
    if (existing.ocrAmount != null || existing.ocrVendor || existing.ocrDate) {
      const finalAmount = amount !== undefined ? parseFloat(amount) : existing.amount
      const finalVendor = vendor !== undefined ? (vendor || null) : existing.vendor
      const mismatch = checkMismatches(
        { amount: finalAmount, vendor: finalVendor, expenseDate: existing.createdAt?.toISOString().split('T')[0] },
        { ocrAmount: existing.ocrAmount, ocrVendor: existing.ocrVendor, ocrDate: existing.ocrDate }
      )
      updateData.amountMismatch = mismatch.amountMismatch
      updateData.vendorMismatch = mismatch.vendorMismatch
      updateData.dateMismatch = mismatch.dateMismatch
      updateData.mismatchNote = mismatch.mismatchNote

      if (mismatch.amountMismatch || mismatch.vendorMismatch || mismatch.dateMismatch) {
        createAuditLog({
          action: 'EXPENSE_MISMATCH_FLAGGED',
          entityType: 'Expense',
          entityId: req.params.id,
          userId: req.user.userId,
          tenantId: req.user.tenantId,
          }).catch(() => {})
      }
    }

    const expense = await db.expense.update({
      where: { id: req.params.id },
      data: updateData,
    })
    res.json(expense)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense' })
  }
}

// POST /api/expenses/upload-receipt — upload receipt, compute hash, create trust seal
const multer = require('multer')
const { uploadToS3, computeSHA256 } = require('../lib/s3Upload')
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.jpg','.jpeg','.png','.doc','.docx','.xlsx','.xls','.csv']
    const ext = '.' + file.originalname.split('.').pop().toLowerCase()
    allowed.includes(ext) ? cb(null, true) : cb(new Error('File type not allowed'))
  }
})
exports.receiptUploadMiddleware = receiptUpload.single('file')

exports.uploadReceipt = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' })
    const db = tenantClient(req.user.tenantId)

    const sha256Hash = computeSHA256(req.file.buffer)
    const ext = req.file.originalname.split('.').pop().toLowerCase()

    const { fileUrl, key: s3Key } = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.user.tenantId,
      'receipts'
    )

    // Validate tenant exists before creating seal (prevents FK constraint violation)
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { id: true, name: true } })
    if (!tenant) {
      console.error('[uploadReceipt] Tenant not found for tenantId:', req.user.tenantId, 'userId:', req.user.userId)
      return res.status(400).json({ error: 'Invalid tenant — please log out and log back in' })
    }
    const orgName = tenant.name || 'Organization'
    const docTitle = req.body.title || req.file.originalname

    // Create trust seal via global prisma (so anchor cron can find it)
    const seal = await prisma.trustSeal.create({
      data: {
        tenantId: req.user.tenantId,
        documentTitle: docTitle,
        documentType: 'expense-receipt',
        issuedTo: orgName,
        issuedBy: orgName,
        rawHash: sha256Hash,
        s3Key,
        fileType: ext,
        anchorTxHash: null,
        status: 'pending',
        sourceType: 'DASHBOARD',
        ocrEngine: 'TEXTRACT',
        expenseId: req.body.expenseId || null,
      }
    })

    // If expenseId provided, link receipt to expense
    if (req.body.expenseId) {
      await db.expense.update({
        where: { id: req.body.expenseId },
        data: { receiptFileKey: s3Key, receiptHash: sha256Hash, receiptSealId: seal.id },
      }).catch(err => console.error('linkReceipt error:', err.message))
    }

    // Run OCR and auto-fill expense fields (non-blocking for the seal response)
    let ocrFields = null
    try {
      const ocrExtractable = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext)
      if (ocrExtractable) {
        const { extractText } = require('../services/ocrService')
        const { extractExpenseFields } = require('../lib/ocrFieldExtractor')

        const ocrResult = await extractText(s3Key)
        const fields = extractExpenseFields(ocrResult)
        ocrFields = fields

        // Hybrid duplicate detection — OCR fingerprint + pHash combined
        const dupResult = await detectDuplicates({
          fileBuffer: req.file.buffer,
          fileType: ext,
          ocrRawText: ocrResult.rawText,
          documentId: seal.id,
          tenantId: req.user.tenantId,
          userId: req.user.userId,
          entityTable: 'trustseal',
        })

        // Store fingerprint + duplicate detection fields on the TrustSeal
        const sealDupData = {}
        if (dupResult.ocrFingerprint) {
          ocrFields.ocrFingerprint = dupResult.ocrFingerprint
          sealDupData.ocrFingerprint = dupResult.ocrFingerprint
        }
        if (dupResult.updateData) {
          if (dupResult.updateData.isDuplicate) sealDupData.isDuplicate = true
          if (dupResult.updateData.duplicateOfId) sealDupData.duplicateOfId = dupResult.updateData.duplicateOfId
          if (dupResult.updateData.duplicateOfName) sealDupData.duplicateOfName = dupResult.updateData.duplicateOfName
          if (dupResult.updateData.crossTenantDuplicate) sealDupData.crossTenantDuplicate = true
          if (dupResult.updateData.isVisualDuplicate) sealDupData.isVisualDuplicate = true
        }
        if (dupResult.confidence) sealDupData.duplicateConfidence = dupResult.confidence
        if (dupResult.method) sealDupData.duplicateMethod = dupResult.method
        if (dupResult.pHash) sealDupData.pHash = dupResult.pHash
        if (Object.keys(sealDupData).length > 0) {
          await prisma.trustSeal.update({
            where: { id: seal.id },
            data: sealDupData,
          }).catch(err => console.error('[dup-detect] seal update failed:', err.message))
        }

        // Map hybrid result to ocrFields for frontend
        if (dupResult.matchedDocumentId) {
          ocrFields.duplicateOf = {
            id: dupResult.matchedDocumentId,
            name: dupResult.matchedDocumentName,
            uploadedAt: new Date().toISOString(),
          }
        }
        if (dupResult.crossTenant) {
          ocrFields.crossTenantDuplicate = true
        }
        ocrFields.duplicateConfidence = dupResult.confidence
        ocrFields.duplicateMethod = dupResult.method

        // Block duplicate HIGH confidence or cross-tenant
        if (dupResult.confidence === 'HIGH' || dupResult.crossTenant) {
          if (req.body.expenseId) {
            await db.expense.update({
              where: { id: req.body.expenseId },
              data: { voided: true, voidedAt: new Date(), voidedReason: `Blocked: duplicate receipt (${dupResult.crossTenant ? 'cross-org' : 'HIGH confidence'})`, voidedBy: req.user.userId },
            }).catch(err => console.error('[dup-block] void failed:', err.message))
          }
          createAuditLog({
            action: 'EXPENSE_BLOCKED_FRAUD',
            entityType: 'Expense',
            entityId: req.body.expenseId || seal.id,
            userId: req.user.userId,
            tenantId: req.user.tenantId,
            dataHash: JSON.stringify({ reason: 'DUPLICATE_HIGH_CONFIDENCE', confidence: dupResult.confidence, crossTenant: !!dupResult.crossTenant }),
          }).catch(() => {})
          return res.status(422).json({
            error: 'DUPLICATE_HIGH_CONFIDENCE',
            message: 'Upload blocked: This receipt appears to be a duplicate.',
            duplicateExpenseId: dupResult.matchedDocumentId || null,
          })
        }

        // Build update data — only update fields that OCR found AND that are empty/default on the expense
        const existing = req.body.expenseId ? await db.expense.findFirst({ where: { id: req.body.expenseId } }) : null
        if (existing) {
          const updateData = {}

          // Only auto-fill amount if current amount is 0 or not set
          if (fields.amount && (!existing.amount || existing.amount === 0)) {
            updateData.amount = fields.amount
          }

          // Only auto-fill currency if still default 'USD' and OCR found something different
          if (fields.currency && existing.currency === 'USD' && fields.currency !== 'USD') {
            updateData.currency = fields.currency
          }

          // Only auto-fill vendor if empty
          if (fields.vendor && !existing.vendor) {
            updateData.vendor = fields.vendor
          }

          // Append extra OCR fields to description
          const extraEntries = Object.entries(fields.extras)
          if (extraEntries.length > 0) {
            const extraText = extraEntries.map(([k, v]) => `${k}: ${v}`).join(' | ')
            const separator = existing.description ? '\n\n' : ''
            const ocrTag = `[OCR] ${extraText}`
            // Only append if not already there
            if (!existing.description?.includes('[OCR]')) {
              updateData.description = (existing.description || '') + separator + ocrTag
            }
          }

          // Always store OCR extracted values for mismatch tracking
          if (fields.amount) updateData.ocrAmount = fields.amount
          if (fields.vendor) updateData.ocrVendor = fields.vendor
          if (fields.date) updateData.ocrDate = fields.date

          // Compute mismatches against current (possibly auto-filled) values
          const finalAmount = updateData.amount ?? existing.amount
          const finalVendor = updateData.vendor ?? existing.vendor
          const mismatch = checkMismatches(
            { amount: finalAmount, vendor: finalVendor, expenseDate: existing.createdAt?.toISOString().split('T')[0] },
            { ocrAmount: fields.amount, ocrVendor: fields.vendor, ocrDate: fields.date }
          )
          updateData.amountMismatch = mismatch.amountMismatch
          updateData.vendorMismatch = mismatch.vendorMismatch
          updateData.dateMismatch = mismatch.dateMismatch
          updateData.mismatchNote = mismatch.mismatchNote

          if (Object.keys(updateData).length > 0) {
            await db.expense.update({
              where: { id: req.body.expenseId },
              data: updateData,
            })
            console.log(`[OCR auto-fill] expense=${req.body.expenseId} fields=${Object.keys(updateData).join(',')}`)
          }

          if (mismatch.amountMismatch || mismatch.vendorMismatch || mismatch.dateMismatch) {
            createAuditLog({
              action: 'EXPENSE_MISMATCH_FLAGGED',
              entityType: 'Expense',
              entityId: req.body.expenseId,
              userId: req.user.userId,
              tenantId: req.user.tenantId,
                  }).catch(() => {})
          }

          // Fraud risk scoring on expense
          const freshExpense = await db.expense.findFirst({ where: { id: req.body.expenseId } })
          if (freshExpense) {
            const risk = scoreFraudRisk({ ...freshExpense, sealId: seal.id })
            await db.expense.update({
              where: { id: req.body.expenseId },
              data: { fraudRiskScore: risk.score, fraudRiskLevel: risk.level, fraudSignals: risk.breakdown.signals },
            })
            // Copy fraud risk + OCR/mismatch/duplicate data to the TrustSeal
            await prisma.trustSeal.update({
              where: { id: seal.id },
              data: {
                fraudRiskScore: risk.score,
                fraudRiskLevel: risk.level,
                fraudSignals: risk.breakdown.signals,
                sourceType: 'DASHBOARD',
                ocrAmount: freshExpense.ocrAmount,
                ocrVendor: freshExpense.ocrVendor,
                ocrDate: freshExpense.ocrDate,
                amountMismatch: freshExpense.amountMismatch || false,
                vendorMismatch: freshExpense.vendorMismatch || false,
                dateMismatch: freshExpense.dateMismatch || false,
                mismatchNote: freshExpense.mismatchNote || null,
              },
            }).catch(err => console.error('[fraud-risk] seal update failed:', err.message))
            if (risk.score > 0) {
              createAuditLog({
                action: 'FRAUD_RISK_SCORED',
                entityType: 'Expense',
                entityId: req.body.expenseId,
                userId: req.user.userId,
                tenantId: req.user.tenantId,
                dataHash: JSON.stringify({ score: risk.score, level: risk.level, signals: risk.breakdown.signals }),
              }).catch(() => {})
              console.log(`[fraud-risk] expense=${req.body.expenseId} score=${risk.score} level=${risk.level}`)

              // Block HIGH/CRITICAL — void the expense and return 422
              if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
                await db.expense.update({
                  where: { id: req.body.expenseId },
                  data: { voided: true, voidedAt: new Date(), voidedReason: `Blocked: ${risk.level} fraud risk (score ${risk.score})`, voidedBy: req.user.userId },
                })
                createAuditLog({
                  action: 'EXPENSE_BLOCKED_FRAUD',
                  entityType: 'Expense',
                  entityId: req.body.expenseId,
                  userId: req.user.userId,
                  tenantId: req.user.tenantId,
                  dataHash: JSON.stringify({ score: risk.score, level: risk.level, signals: risk.breakdown.signals }),
                }).catch(() => {})
                console.log(`[fraud-block] Expense ${req.body.expenseId} voided: score=${risk.score} level=${risk.level}`)
                return res.status(422).json({
                  error: 'FRAUD_RISK_HIGH',
                  message: 'Upload blocked: HIGH fraud risk detected. OCR found significant discrepancies.',
                  fraudScore: risk.score,
                  fraudLevel: risk.level,
                  reasons: risk.breakdown.signals,
                })
              }
            }
          }
        }
      }
    } catch (ocrErr) {
      // OCR failure should not block the receipt upload
      console.error('[OCR auto-fill] failed:', ocrErr.message)
    }

    res.json({
      fileKey: s3Key,
      fileUrl,
      hash: sha256Hash,
      sealId: seal.id,
      sealStatus: seal.status,
      ocrFields,
    })
  } catch (err) {
    console.error('uploadReceipt error:', err)
    res.status(500).json({ error: 'Failed to upload receipt' })
  }
}

exports.voidExpense = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { reason } = req.body
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Void reason is required' })
    }

    const existing = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })
    if (existing.voided) return res.status(400).json({ error: 'Expense is already voided' })

    const updated = await db.expense.update({
      where: { id: req.params.id },
      data: {
        voided: true,
        voidedAt: new Date(),
        voidedReason: reason.trim(),
        voidedBy: req.user.userId,
      },
    })

    await createAuditLog({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      action: 'EXPENSE_VOIDED',
      entityType: 'expense',
      entityId: req.params.id,
      metadata: {
        amount: existing.amount,
        currency: existing.currency,
        description: existing.description,
        reason: reason.trim(),
      },
    })

    res.json(updated)
  } catch (err) {
    console.error('[void] expense void error:', err.message)
    res.status(500).json({ error: 'Failed to void expense' })
  }
}

exports.deleteExpense = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.expense.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Expense not found' })
    await db.expense.delete({ where: { id: req.params.id } })
    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' })
  }
}
