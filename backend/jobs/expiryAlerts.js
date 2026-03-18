// ─────────────────────────────────────────────────────────────
//  jobs/expiryAlerts.js — daily document expiry alert emails
//  Runs at 8:00 AM UAE time (UTC+4 = 04:00 UTC)
// ─────────────────────────────────────────────────────────────

const cron = require('node-cron')
const prisma = require('../prisma/client')
const { sendEmail } = require('../services/emailService')
const { KEY_DOCUMENT_CATEGORIES } = require('../lib/documentCategories')
const logger = require('../lib/logger')
const { dispatch: webhookDispatch } = require('../services/webhookService')
const { createAuditLog } = require('../services/auditService')

const APP_URL = process.env.APP_URL || 'https://app.sealayer.io'

// Get admin emails for a tenant
async function getAdminEmails(tenantId) {
  const admins = await prisma.user.findMany({
    where: {
      tenantId,
      deletedAt: null,
      roles: { some: { role: { name: 'admin' } } },
    },
    select: { email: true, name: true },
  })
  if (admins.length > 0) return admins
  return prisma.user.findMany({
    where: { tenantId, deletedAt: null },
    select: { email: true, name: true },
    take: 1,
    orderBy: { createdAt: 'asc' },
  })
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function categoryLabel(cat) {
  const labels = {
    licence: 'Licence', certificate: 'Certificate', contract: 'Contract',
    permit: 'Permit', insurance: 'Insurance', visa: 'Visa',
    id_document: 'ID Document', mou: 'MOU',
  }
  return labels[cat] || cat
}

async function sendExpiryEmail({ doc, daysLeft, adminEmails, projectName }) {
  const urgencyColor = daysLeft <= 1 ? '#dc2626' : daysLeft <= 7 ? '#dc2626' : '#f59e0b'
  const urgencyBg = daysLeft <= 7 ? '#fef2f2' : '#fffbeb'
  const urgencyBorder = daysLeft <= 7 ? '#fecaca' : '#fde68a'
  const urgencyLabel = daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 1 ? 'Expires tomorrow' : `Expires in ${daysLeft} days`

  for (const admin of adminEmails) {
    try {
      await sendEmail({
        to: admin.email,
        subject: `⚠️ Document Expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${doc.name}`,
        html: [
          '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:30px">',
          '<div style="text-align:center;margin-bottom:30px">',
          '<h1 style="color:#0c7aed;font-size:24px;margin:0">Sealayer</h1>',
          '<p style="color:#64748b;font-size:13px;margin-top:4px">Verification Infrastructure</p>',
          '</div>',
          '<h2 style="color:#1e293b;font-size:20px;margin:0 0 16px">Document Expiry Alert</h2>',
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">',
          `<p style="color:#1e293b;font-size:15px;font-weight:600;margin:0 0 8px">${doc.name}</p>`,
          `<p style="color:#475569;font-size:13px;margin:0 0 4px">Category: <strong>${categoryLabel(doc.category)}</strong></p>`,
          projectName ? `<p style="color:#475569;font-size:13px;margin:0 0 4px">Project: ${projectName}</p>` : '',
          `<p style="color:#475569;font-size:13px;margin:0">Expiry Date: <strong>${formatDate(doc.expiryDate)}</strong></p>`,
          '</div>',
          `<div style="background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:8px;padding:16px;margin:16px 0;text-align:center">`,
          `<p style="color:${urgencyColor};font-size:18px;font-weight:700;margin:0">${urgencyLabel}</p>`,
          '</div>',
          '<p style="color:#475569;font-size:13px;line-height:1.6">Please review this document and arrange for renewal before it expires.</p>',
          '<div style="text-align:center;margin:30px 0">',
          `<a href="${APP_URL}/dashboard/documents" style="display:inline-block;padding:14px 28px;background-color:#0c7aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">View Document</a>`,
          '</div>',
          '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>',
          '<p style="color:#94a3b8;font-size:11px;text-align:center">Sealayer</p>',
          '</div>',
        ].join(''),
      })
    } catch (err) {
      logger.error(`[expiry-alerts] Failed to send email to ${admin.email}: ${err.message}`)
    }
  }
}

async function checkDocumentExpiry() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Find all documents with expiry dates that are key categories
  const documents = await prisma.document.findMany({
    where: {
      category: { in: KEY_DOCUMENT_CATEGORIES },
      expiryDate: { not: null },
      OR: [
        { expiryAlertSent30: false },
        { expiryAlertSent7: false },
        { expiryAlertSent1: false },
      ],
    },
    include: {
      project: { select: { name: true } },
    },
  })

  let alertsSent = 0

  for (const doc of documents) {
    const expiryDate = new Date(doc.expiryDate)
    const diffMs = expiryDate.getTime() - today.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const adminEmails = await getAdminEmails(doc.tenantId)
    if (adminEmails.length === 0) continue

    // 30-day alert
    if (daysLeft <= 30 && !doc.expiryAlertSent30) {
      await sendExpiryEmail({ doc, daysLeft: Math.max(daysLeft, 0), adminEmails, projectName: doc.project?.name })
      await prisma.document.update({ where: { id: doc.id }, data: { expiryAlertSent30: true } })
      createAuditLog({ action: 'DOCUMENT_EXPIRY_ALERT', entityType: 'Document', entityId: doc.id, tenantId: doc.tenantId, dataHash: JSON.stringify({ daysLeft: Math.max(daysLeft, 0), alertLevel: '30day' }) }).catch(() => {})
      webhookDispatch(doc.tenantId, 'document.expiring', {
        id: doc.id, name: doc.name, expiryDate: doc.expiryDate, daysLeft: Math.max(daysLeft, 0),
      }).catch(() => {})
      alertsSent++
    }

    // 7-day alert
    if (daysLeft <= 7 && !doc.expiryAlertSent7) {
      await sendExpiryEmail({ doc, daysLeft: Math.max(daysLeft, 0), adminEmails, projectName: doc.project?.name })
      await prisma.document.update({ where: { id: doc.id }, data: { expiryAlertSent7: true } })
      createAuditLog({ action: 'DOCUMENT_EXPIRY_ALERT', entityType: 'Document', entityId: doc.id, tenantId: doc.tenantId, dataHash: JSON.stringify({ daysLeft: Math.max(daysLeft, 0), alertLevel: '7day' }) }).catch(() => {})
      alertsSent++
    }

    // 1-day alert
    if (daysLeft <= 1 && !doc.expiryAlertSent1) {
      await sendExpiryEmail({ doc, daysLeft: Math.max(daysLeft, 0), adminEmails, projectName: doc.project?.name })
      await prisma.document.update({ where: { id: doc.id }, data: { expiryAlertSent1: true } })
      createAuditLog({ action: 'DOCUMENT_EXPIRY_ALERT', entityType: 'Document', entityId: doc.id, tenantId: doc.tenantId, dataHash: JSON.stringify({ daysLeft: Math.max(daysLeft, 0), alertLevel: '1day' }) }).catch(() => {})
      alertsSent++
    }
  }

  return { checked: documents.length, alertsSent }
}

function startExpiryAlertJob() {
  // Daily at 8:00 AM UAE time (UTC+4) = 04:00 UTC
  cron.schedule('0 4 * * *', async () => {
    logger.info('Running document expiry alert check...')
    try {
      const result = await checkDocumentExpiry()
      if (result.alertsSent > 0) {
        logger.info('[expiry-alerts] Complete', result)
      }
    } catch (err) {
      logger.error('[expiry-alerts] Job failed', { error: err.message })
    }
  })

  logger.info('Document expiry alert job scheduled (daily 4:00 UTC / 8:00 AM UAE)')
}

module.exports = { startExpiryAlertJob, checkDocumentExpiry }
