// ─────────────────────────────────────────────────────────────
//  services/emailNotificationService.js
//  Branded email notifications for platform events
// ─────────────────────────────────────────────────────────────

const { sendEmail } = require('./emailService')
const prisma = require('../lib/client')

const APP_URL = process.env.APP_URL || 'https://app.sealayer.io'

// ── Branded HTML wrapper — Sealayer.io ────────────────────────
function wrap(body) {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
      <div style="background: #0d9488; text-align: center; padding: 28px 0 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700;">Sealayer</h1>
        <p style="color: #ccfbf1; font-size: 12px; margin-top: 2px;">Verification Infrastructure</p>
      </div>
      <div style="padding: 0 24px 24px;">
        ${body}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Powered by <strong>Sealayer.io</strong></p>
        <p style="color: #cbd5e1; font-size: 10px; margin: 4px 0 0;">You received this because you have an account on <a href="${APP_URL}" style="color: #0d9488; text-decoration: none;">Sealayer</a></p>
      </div>
    </div>
  `
}

function button(text, href) {
  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${href}" style="display: inline-block; background: #0d9488; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">${text}</a>
    </div>
  `
}

// ── Helper: check if notification type is enabled for tenant ─
async function isNotifEnabled(tenantId, type) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notificationPrefs: true },
    })
    const defaults = { fraud: true, duplicate: true, mismatch: true, void: true, seal: false }
    const prefs = { ...defaults, ...(tenant?.notificationPrefs || {}) }
    return prefs[type] !== false
  } catch { return true }
}

// ── Helper: get admin emails for a tenant ────────────────────
async function getAdminEmails(tenantId) {
  const admins = await prisma.user.findMany({
    where: {
      tenantId,
      deletedAt: null,
      roles: { some: { role: { name: 'admin' } } },
    },
    select: { email: true, name: true },
  })
  return admins.length > 0 ? admins : await prisma.user.findMany({
    where: { tenantId, deletedAt: null },
    select: { email: true, name: true },
    take: 1,
    orderBy: { createdAt: 'asc' },
  })
}

// ── 1. Document uploaded — notify tenant admin ───────────────
async function notifyDocumentUploaded({ tenantId, documentName, uploaderName, projectName }) {
  try {
    const admins = await getAdminEmails(tenantId)
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `New document uploaded: ${documentName}`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">New Document Uploaded</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            <strong>${uploaderName || 'A team member'}</strong> uploaded a new document to your workspace.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px;"><strong>${documentName}</strong></p>
            ${projectName ? `<p style="color: #64748b; font-size: 13px; margin: 0;">Project: ${projectName}</p>` : ''}
          </div>
          <p style="color: #64748b; font-size: 13px;">This document will be SHA-256 hashed and anchored to the blockchain in the next batch.</p>
          ${button('View Documents', `${APP_URL}/dashboard/documents`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] documentUploaded failed:', err.message)
  }
}

// ── 2. Document anchored to blockchain — notify uploader ─────
async function notifyDocumentAnchored({ tenantId, documentName, uploaderEmail, uploaderName, txHash }) {
  try {
    if (!uploaderEmail) return
    const firstName = (uploaderName || '').split(' ')[0] || 'there'
    await sendEmail({
      to: uploaderEmail,
      subject: `Your document "${documentName}" is now blockchain verified`,
      html: wrap(`
        <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">Document Verified on Blockchain</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Hi ${firstName}, your document <strong>${documentName}</strong> has been cryptographically verified and anchored to the Polygon blockchain.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #166534; font-size: 13px; margin: 0 0 4px;"><strong>Status: Blockchain Confirmed</strong></p>
          ${txHash ? `<p style="color: #64748b; font-size: 12px; margin: 0; word-break: break-all;">TX: ${txHash}</p>` : ''}
        </div>
        <p style="color: #64748b; font-size: 13px;">Anyone can independently verify this document's integrity using the public verifier.</p>
        ${button('View Verification', `${APP_URL}/dashboard/audit`)}
      `),
    })
  } catch (err) {
    console.error('[email-notify] documentAnchored failed:', err.message)
  }
}

// ── 3. Expense added — notify tenant admin ───────────────────
async function notifyExpenseAdded({ tenantId, description, amount, currency, creatorName }) {
  try {
    const admins = await getAdminEmails(tenantId)
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount)
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `New expense logged: ${description} ${formatted}`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">New Expense Logged</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            <strong>${creatorName || 'A team member'}</strong> logged a new expense in your workspace.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px;"><strong>${description}</strong></p>
            <p style="color: #0c7aed; font-size: 20px; font-weight: 700; margin: 8px 0 0;">${formatted}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">This expense has been added to the audit trail and will be blockchain-anchored.</p>
          ${button('View Expenses', `${APP_URL}/dashboard/expenses`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] expenseAdded failed:', err.message)
  }
}

// ── 4. Team member invite accepted — notify admin ────────────
async function notifyMemberJoined({ tenantId, memberName, memberEmail }) {
  try {
    const admins = await getAdminEmails(tenantId)
    for (const admin of admins) {
      if (admin.email === memberEmail) continue // don't notify the person who just joined
      await sendEmail({
        to: admin.email,
        subject: `${memberName} has joined your workspace`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">New Team Member</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            <strong>${memberName}</strong> (${memberEmail}) has joined your Tulip DS workspace.
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #166534; font-size: 14px; margin: 0;">Team member added successfully</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">You can manage team roles and permissions in Settings.</p>
          ${button('Manage Team', `${APP_URL}/dashboard/settings`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] memberJoined failed:', err.message)
  }
}

// ── 5. Trial expiring soon (3 days before) — notify admins ───
async function notifyTrialExpiringSoon({ tenantId, tenantName, daysLeft }) {
  try {
    const admins = await getAdminEmails(tenantId)
    for (const admin of admins) {
      const firstName = (admin.name || '').split(' ')[0] || 'there'
      await sendEmail({
        to: admin.email,
        subject: `Your Tulip DS trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">Your Trial is Ending Soon</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Hi ${firstName}, your free trial for <strong>${tenantName}</strong> expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            After your trial ends, you'll be limited to 5 documents. Upgrade now to keep full access to all features.
          </p>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0;"><strong>Plans start at AED 299/month</strong></p>
            <p style="color: #a16207; font-size: 13px; margin: 4px 0 0;">Includes blockchain anchoring, RFC 3161 timestamps, and up to 100 documents/month.</p>
          </div>
          ${button('Upgrade Now', `${APP_URL}/dashboard/billing`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] trialExpiringSoon failed:', err.message)
  }
}

// ── 6. Trial expired — notify admin with upgrade link ────────
async function notifyTrialExpired({ tenantId, tenantName }) {
  try {
    const admins = await getAdminEmails(tenantId)
    for (const admin of admins) {
      const firstName = (admin.name || '').split(' ')[0] || 'there'
      await sendEmail({
        to: admin.email,
        subject: `Your Tulip DS free trial has expired`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">Your Free Trial Has Expired</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Hi ${firstName}, your free trial for <strong>${tenantName}</strong> has ended. Your workspace is now limited to 5 documents.
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            All your existing data is safe and intact. Upgrade to a paid plan to restore full access.
          </p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #991b1b; font-size: 14px; margin: 0;"><strong>Account limited</strong></p>
            <p style="color: #b91c1c; font-size: 13px; margin: 4px 0 0;">Document uploads are restricted until you upgrade.</p>
          </div>
          ${button('Choose a Plan', `${APP_URL}/dashboard/billing`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] trialExpired failed:', err.message)
  }
}

// ── 7. Payment failed — notify admin immediately ─────────────
async function notifyPaymentFailed({ tenantId, tenantName }) {
  try {
    const admins = await getAdminEmails(tenantId)
    for (const admin of admins) {
      const firstName = (admin.name || '').split(' ')[0] || 'there'
      await sendEmail({
        to: admin.email,
        subject: `Payment failed for your Tulip DS subscription`,
        html: wrap(`
          <h2 style="color: #dc2626; font-size: 18px; margin: 0 0 12px;">Payment Failed</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Hi ${firstName}, we were unable to process the latest payment for <strong>${tenantName}</strong>'s Tulip DS subscription.
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Please update your payment method to avoid any interruption to your service.
          </p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #991b1b; font-size: 14px; margin: 0;"><strong>Action required</strong></p>
            <p style="color: #b91c1c; font-size: 13px; margin: 4px 0 0;">Your subscription will be paused if payment is not resolved.</p>
          </div>
          ${button('Update Payment Method', `${APP_URL}/dashboard/billing`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] paymentFailed failed:', err.message)
  }
}

// ── 8. New document uploaded — notify linked donors ──────────
async function notifyDonorsNewDocument({ tenantId, documentName, projectName, category }) {
  try {
    // Find all donors linked to this tenant via funding agreements
    const agreements = await prisma.fundingAgreement.findMany({
      where: { tenantId, donorId: { not: null } },
      select: { donorId: true },
      distinct: ['donorId'],
    })
    if (agreements.length === 0) return

    const donorIds = agreements.map(a => a.donorId)
    const donorUsers = await prisma.donorUser.findMany({
      where: { donorId: { in: donorIds }, isActive: true },
      select: { email: true, firstName: true },
    })
    if (donorUsers.length === 0) return

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    })
    const orgName = tenant?.name || 'Your NGO partner'
    const DONOR_URL = process.env.DONOR_URL || 'https://donor.tulipds.com'

    const categoryLabels = {
      licence: 'Licence', certificate: 'Certificate', contract: 'Contract',
      permit: 'Permit', insurance: 'Insurance', visa: 'Visa',
      id_document: 'ID Document', mou: 'MOU',
    }

    for (const du of donorUsers) {
      await sendEmail({
        to: du.email,
        subject: `New Document Available — ${documentName}`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">New Document Shared</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Hi ${du.firstName}, <strong>${orgName}</strong> has added a new document.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px;"><strong>${documentName}</strong></p>
            ${category && categoryLabels[category] ? `<p style="color: #64748b; font-size: 13px; margin: 0 0 4px;">Category: ${categoryLabels[category]}</p>` : ''}
            ${projectName ? `<p style="color: #64748b; font-size: 13px; margin: 0;">Project: ${projectName}</p>` : ''}
          </div>
          <p style="color: #64748b; font-size: 13px;">This document will be SHA-256 hashed and anchored to the blockchain for verification.</p>
          ${button('View in Donor Portal', `${DONOR_URL}/donor/dashboard`)}
        `),
      }).catch(err => {
        console.error(`[email-notify] donorNewDoc failed for ${du.email}:`, err.message)
      })
    }
  } catch (err) {
    console.error('[email-notify] notifyDonorsNewDocument failed:', err.message)
  }
}

// ── Trial check cron — find tenants with trials expiring in 3 days or expired today
async function checkTrialExpirations() {
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Tenants with trial expiring in ~3 days (between 2.5 and 3.5 days from now)
  const expiringSoon = await prisma.tenant.findMany({
    where: {
      plan: 'FREE',
      trialEndsAt: {
        gte: new Date(threeDaysFromNow.getTime() - 12 * 60 * 60 * 1000),
        lte: new Date(threeDaysFromNow.getTime() + 12 * 60 * 60 * 1000),
      },
    },
    select: { id: true, name: true, trialEndsAt: true },
  })

  for (const tenant of expiringSoon) {
    const daysLeft = Math.ceil((new Date(tenant.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    await notifyTrialExpiringSoon({ tenantId: tenant.id, tenantName: tenant.name, daysLeft })
    console.log(`[trial-check] Notified trial expiring soon: ${tenant.name} (${daysLeft} days)`)
  }

  // Tenants whose trial expired in the last 24 hours
  const justExpired = await prisma.tenant.findMany({
    where: {
      plan: 'FREE',
      trialEndsAt: {
        gte: oneDayAgo,
        lte: now,
      },
    },
    select: { id: true, name: true },
  })

  for (const tenant of justExpired) {
    await notifyTrialExpired({ tenantId: tenant.id, tenantName: tenant.name })
    console.log(`[trial-check] Notified trial expired: ${tenant.name}`)
  }

  return { expiringSoon: expiringSoon.length, justExpired: justExpired.length }
}

// ── 9. Fraud alert — HIGH risk expense blocked ───────────────
async function notifyFraudAlert({ tenantId, description, amount, currency, vendor, fraudScore, fraudLevel, reasons }) {
  try {
    if (!await isNotifEnabled(tenantId, 'fraud')) return
    const admins = await getAdminEmails(tenantId)
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount || 0)
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `⚠ Fraud Alert: ${fraudLevel} risk expense detected — ${vendor || description || 'Unknown'}`,
        html: wrap(`
          <h2 style="color: #dc2626; font-size: 18px; margin: 0 0 12px;">⚠ Expense Blocked — ${fraudLevel} Fraud Risk</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            An expense was <strong>automatically blocked</strong> due to high fraud risk detected by OCR analysis.
          </p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #991b1b; font-size: 16px; font-weight: 700; margin: 0 0 8px;">Fraud Score: ${fraudScore}/100 (${fraudLevel})</p>
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px;"><strong>${description || 'Untitled expense'}</strong></p>
            <p style="color: #475569; font-size: 14px; margin: 0 0 4px;">Amount: ${formatted}</p>
            ${vendor ? `<p style="color: #475569; font-size: 14px; margin: 0;">Vendor: ${vendor}</p>` : ''}
          </div>
          ${reasons && reasons.length > 0 ? `
          <div style="margin: 16px 0;">
            <p style="color: #1e293b; font-size: 13px; font-weight: 600; margin: 0 0 8px;">Fraud Signals:</p>
            <ul style="color: #dc2626; font-size: 13px; margin: 0; padding-left: 20px;">
              ${reasons.map(r => `<li style="margin-bottom: 4px;">${r}</li>`).join('')}
            </ul>
          </div>` : ''}
          <p style="color: #64748b; font-size: 13px;">The expense was not saved. Please investigate the receipt and contact the submitter.</p>
          ${button('View Audit Log', `${APP_URL}/dashboard/audit`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] fraudAlert failed:', err.message)
  }
}

// ── 10. Duplicate alert — HIGH confidence duplicate blocked ──
async function notifyDuplicateAlert({ tenantId, description, amount, currency, vendor, duplicateExpenseId }) {
  try {
    if (!await isNotifEnabled(tenantId, 'duplicate')) return
    const admins = await getAdminEmails(tenantId)
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount || 0)
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `⚠ Duplicate Receipt: ${vendor || description || 'Unknown'} may be duplicate`,
        html: wrap(`
          <h2 style="color: #ea580c; font-size: 18px; margin: 0 0 12px;">⚠ Duplicate Receipt Detected</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            An expense was <strong>automatically blocked</strong> because the receipt appears to be a duplicate.
          </p>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px;"><strong>${description || 'Untitled expense'}</strong></p>
            <p style="color: #475569; font-size: 14px; margin: 0 0 4px;">Amount: ${formatted}</p>
            ${vendor ? `<p style="color: #475569; font-size: 14px; margin: 0;">Vendor: ${vendor}</p>` : ''}
          </div>
          <p style="color: #64748b; font-size: 13px;">This receipt has already been submitted. The expense was not saved to prevent duplicate claims.</p>
          ${button('View Expenses', `${APP_URL}/dashboard/expenses`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] duplicateAlert failed:', err.message)
  }
}

// ── 11. Mismatch alert — OCR mismatch detected ──────────────
async function notifyMismatchAlert({ tenantId, description, amount, currency, vendor, ocrAmount, ocrVendor, ocrDate, amountMismatch, vendorMismatch, dateMismatch }) {
  try {
    if (!await isNotifEnabled(tenantId, 'mismatch')) return
    const admins = await getAdminEmails(tenantId)
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount || 0)
    const mismatches = []
    if (amountMismatch) mismatches.push(`Amount: receipt shows ${ocrAmount ?? '?'}, logged as ${amount}`)
    if (vendorMismatch) mismatches.push(`Vendor: receipt shows "${ocrVendor || '?'}", logged as "${vendor || '?'}"`)
    if (dateMismatch) mismatches.push(`Date: receipt shows ${ocrDate || '?'}, differs by 30+ days`)
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `⚠ OCR Mismatch: ${vendor || description || 'Unknown'} receipt altered`,
        html: wrap(`
          <h2 style="color: #d97706; font-size: 18px; margin: 0 0 12px;">⚠ OCR Mismatch Detected</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            An expense receipt has discrepancies between the OCR-extracted values and the logged values.
          </p>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px;"><strong>${description || 'Untitled expense'}</strong></p>
            <p style="color: #475569; font-size: 14px; margin: 0 0 4px;">Amount: ${formatted}</p>
            ${vendor ? `<p style="color: #475569; font-size: 14px; margin: 0;">Vendor: ${vendor}</p>` : ''}
          </div>
          ${mismatches.length > 0 ? `
          <div style="margin: 16px 0;">
            <p style="color: #1e293b; font-size: 13px; font-weight: 600; margin: 0 0 8px;">Discrepancies Found:</p>
            <ul style="color: #d97706; font-size: 13px; margin: 0; padding-left: 20px;">
              ${mismatches.map(m => `<li style="margin-bottom: 4px;">${m}</li>`).join('')}
            </ul>
          </div>` : ''}
          <p style="color: #64748b; font-size: 13px;">The expense was saved but flagged. Please review the receipt for accuracy.</p>
          ${button('View Expenses', `${APP_URL}/dashboard/expenses`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] mismatchAlert failed:', err.message)
  }
}

// ── 12. Void alert — expense voided ─────────────────────────
async function notifyVoidAlert({ tenantId, description, amount, currency, vendor, reason, voidedByName }) {
  try {
    if (!await isNotifEnabled(tenantId, 'void')) return
    const admins = await getAdminEmails(tenantId)
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount || 0)
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `✓ Expense Voided: ${vendor || description || 'Unknown'} — ${reason || 'No reason given'}`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">Expense Voided</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            An expense has been voided by <strong>${voidedByName || 'a team member'}</strong>.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px; text-decoration: line-through;"><strong>${description || 'Untitled expense'}</strong></p>
            <p style="color: #475569; font-size: 14px; margin: 0 0 4px;">Amount: ${formatted}</p>
            ${vendor ? `<p style="color: #475569; font-size: 14px; margin: 0 0 8px;">Vendor: ${vendor}</p>` : ''}
            <p style="color: #991b1b; font-size: 13px; margin: 0;"><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">The expense remains in the audit trail but is marked as voided. It cannot be un-voided.</p>
          ${button('View Expenses', `${APP_URL}/dashboard/expenses`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] voidAlert failed:', err.message)
  }
}

// ── 13. Seal issued alert — document sealed ─────────────────
async function notifySealIssued({ tenantId, documentName, documentType, sealId }) {
  try {
    if (!await isNotifEnabled(tenantId, 'seal')) return
    const admins = await getAdminEmails(tenantId)
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `✓ Document Sealed: ${documentName}`,
        html: wrap(`
          <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">Trust Seal Issued</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            A new Trust Seal has been issued for a document in your workspace.
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color: #166534; font-size: 13px; margin: 0 0 4px;"><strong>Status: Sealed</strong></p>
            <p style="color: #1e293b; font-size: 14px; margin: 0 0 4px;"><strong>${documentName}</strong></p>
            <p style="color: #475569; font-size: 13px; margin: 0;">Type: ${documentType || 'Document'}</p>
            ${sealId ? `<p style="color: #64748b; font-size: 12px; margin: 4px 0 0; font-family: monospace;">Seal ID: ${sealId}</p>` : ''}
          </div>
          <p style="color: #64748b; font-size: 13px;">This document has been SHA-256 hashed and will be anchored to the Polygon blockchain in the next batch.</p>
          ${button('View Documents', `${APP_URL}/dashboard/documents`)}
        `),
      })
    }
  } catch (err) {
    console.error('[email-notify] sealIssued failed:', err.message)
  }
}

module.exports = {
  notifyDocumentUploaded,
  notifyDocumentAnchored,
  notifyExpenseAdded,
  notifyMemberJoined,
  notifyTrialExpiringSoon,
  notifyTrialExpired,
  notifyPaymentFailed,
  notifyDonorsNewDocument,
  checkTrialExpirations,
  notifyFraudAlert,
  notifyDuplicateAlert,
  notifyMismatchAlert,
  notifyVoidAlert,
  notifySealIssued,
}
