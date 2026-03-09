// ─────────────────────────────────────────────────────────────
//  services/emailNotificationService.js
//  Branded email notifications for platform events
// ─────────────────────────────────────────────────────────────

const { sendEmail } = require('./emailService')
const prisma = require('../lib/client')

const APP_URL = process.env.APP_URL || 'https://app.tulipds.com'

// ── Branded HTML wrapper ─────────────────────────────────────
function wrap(body) {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 28px 0 20px;">
        <h1 style="color: #0c7aed; font-size: 22px; margin: 0; font-weight: 700;">Tulip DS</h1>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 2px;">Verification Infrastructure</p>
      </div>
      <div style="padding: 0 24px 24px;">
        ${body}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">Tulip DS &middot; Bright Bytes Technology &middot; Dubai, UAE</p>
        <p style="color: #cbd5e1; font-size: 10px; margin: 4px 0 0;">You received this because you have an account on <a href="${APP_URL}" style="color: #0c7aed; text-decoration: none;">Tulip DS</a></p>
      </div>
    </div>
  `
}

function button(text, href) {
  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${href}" style="display: inline-block; background: #0c7aed; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">${text}</a>
    </div>
  `
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

module.exports = {
  notifyDocumentUploaded,
  notifyDocumentAnchored,
  notifyExpenseAdded,
  notifyMemberJoined,
  notifyTrialExpiringSoon,
  notifyTrialExpired,
  notifyPaymentFailed,
  checkTrialExpirations,
}
