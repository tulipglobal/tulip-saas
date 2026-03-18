// ─────────────────────────────────────────────────────────────
//  services/engagementEmailService.js — Automated email sequences
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')
const { sendEmail } = require('./emailService')
const logger = require('../lib/logger')

const BRAND = '#0c7aed'
const APP_URL = process.env.APP_URL || 'https://app.sealayer.io'
const VERIFY_URL = 'https://verify.sealayer.io'

function wrap(body) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a2e;">
      <div style="text-align: center; padding: 24px 0;">
        <h1 style="color: ${BRAND}; font-size: 22px; margin: 0;">Tulip Verify</h1>
      </div>
      ${body}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">
        Sealayer — Blockchain-anchored document verification<br/>
        <a href="${VERIFY_URL}" style="color: ${BRAND};">verify.sealayer.io</a>
      </p>
    </div>
  `
}

function btn(text, url) {
  return `<a href="${url}" style="display: inline-block; background: ${BRAND}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">${text}</a>`
}

// ── Email templates ──────────────────────────────────────────

function welcomeEmail(firstName, orgName) {
  return {
    subject: 'Welcome to Tulip Verify — verify your first document',
    html: wrap(`
      <p>Hi ${firstName},</p>
      <p>Welcome to Tulip Verify! Your organisation <strong>${orgName}</strong> is set up and ready to go.</p>
      <p>You have <strong>5 free document verifications</strong> to get started. Here's how:</p>
      <ol style="line-height: 1.8;">
        <li>Upload a document (PDF, image, or scan)</li>
        <li>Our AI extracts, normalises, and assesses the content</li>
        <li>Each document gets a SHA-256 hash anchored to the Polygon blockchain</li>
      </ol>
      <p style="margin-top: 24px; text-align: center;">
        ${btn('Verify Your First Document →', APP_URL + '/dashboard/api-portal/ocr')}
      </p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Every verification is tamper-proof and independently verifiable — giving your clients proof they can trust.
      </p>
    `),
  }
}

function nudgeEmail(firstName) {
  return {
    subject: "Did you try Tulip Verify? Here's how to get started",
    html: wrap(`
      <p>Hi ${firstName},</p>
      <p>We noticed you signed up for Tulip Verify but haven't verified your first document yet.</p>
      <p>It only takes 30 seconds:</p>
      <ol style="line-height: 1.8;">
        <li>Go to the <strong>OCR Engine</strong> in your dashboard</li>
        <li>Upload any document (invoice, certificate, ID, contract)</li>
        <li>Watch as AI extracts the data and blockchain anchors the proof</li>
      </ol>
      <p style="margin-top: 24px; text-align: center;">
        ${btn('Try It Now →', APP_URL + '/dashboard/api-portal/ocr')}
      </p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Your 5 free verifications are waiting. No credit card needed.
      </p>
    `),
  }
}

function upgradeEmail(firstName, docCount) {
  return {
    subject: "You've used all your free verifications — upgrade to continue",
    html: wrap(`
      <p>Hi ${firstName},</p>
      <p>Great news — you've already verified <strong>${docCount} documents</strong> with Tulip Verify. That means you've seen the value of blockchain-anchored document verification.</p>
      <p>To continue verifying documents and unlock unlimited features:</p>
      <ul style="line-height: 1.8;">
        <li><strong>Unlimited</strong> document verifications</li>
        <li><strong>Bundle analysis</strong> for cross-document checks</li>
        <li><strong>Trust Seals</strong> with QR codes</li>
        <li><strong>Case management</strong> for client workflows</li>
        <li><strong>API access</strong> for integration</li>
      </ul>
      <p style="margin-top: 24px; text-align: center;">
        ${btn('Upgrade Now →', APP_URL + '/dashboard/billing')}
      </p>
    `),
  }
}

function reEngagementEmail(firstName) {
  return {
    subject: "We miss you — here's what's new on Tulip Verify",
    html: wrap(`
      <p>Hi ${firstName},</p>
      <p>It's been a while since you last used Tulip Verify. Here's what's new:</p>
      <ul style="line-height: 1.8;">
        <li><strong>Trust Seals</strong> — Issue tamper-proof digital seals with QR codes</li>
        <li><strong>Case Management</strong> — Organise documents into client cases with shared verification links</li>
        <li><strong>Bundle Verify</strong> — Cross-analyse multiple documents for inconsistencies</li>
        <li><strong>Improved AI</strong> — Better extraction accuracy and risk assessment</li>
      </ul>
      <p style="margin-top: 24px; text-align: center;">
        ${btn('Check It Out →', APP_URL + '/dashboard')}
      </p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Your account is still active. Pick up right where you left off.
      </p>
    `),
  }
}

// ── Scheduled email jobs ──────────────────────────────────────

/**
 * Run daily at 5am UTC (9am UAE).
 * Sends nudge, upgrade, and re-engagement emails.
 */
async function runEngagementEmails() {
  const results = { nudge: 0, upgrade: 0, reEngagement: 0, errors: 0 }

  try {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 1. Nudge: signed up in last 24hrs but 0 documents
    const recentSignups = await prisma.engagementEvent.findMany({
      where: {
        eventType: 'signup',
        createdAt: { gte: oneDayAgo },
      },
      select: { tenantId: true },
    })

    for (const { tenantId } of recentSignups) {
      try {
        const docCount = await prisma.ocrJob.count({ where: { tenantId } })
        if (docCount > 0) continue

        // Check if nudge already sent
        const nudgeSent = await prisma.engagementEvent.count({
          where: { tenantId, eventType: 'email_nudge_sent' },
        })
        if (nudgeSent > 0) continue

        const user = await prisma.user.findFirst({
          where: { tenantId },
          select: { email: true, name: true },
          orderBy: { createdAt: 'asc' },
        })
        if (!user) continue

        const firstName = user.name.split(' ')[0]
        const email = nudgeEmail(firstName)
        await sendEmail({ to: user.email, ...email })
        await prisma.engagementEvent.create({
          data: { tenantId, eventType: 'email_nudge_sent', metadata: { email: user.email } },
        })
        results.nudge++
      } catch (err) {
        logger.error('Nudge email failed', { tenantId, error: err.message })
        results.errors++
      }
    }

    // 2. Upgrade: tenants who hit 5 doc limit (free plan)
    const freeTenants = await prisma.tenant.findMany({
      where: { plan: 'FREE' },
      select: { id: true },
    })

    for (const { id: tenantId } of freeTenants) {
      try {
        const docCount = await prisma.ocrJob.count({ where: { tenantId } })
        if (docCount < 5) continue

        const upgradeSent = await prisma.engagementEvent.count({
          where: { tenantId, eventType: 'email_upgrade_sent' },
        })
        if (upgradeSent > 0) continue

        const user = await prisma.user.findFirst({
          where: { tenantId },
          select: { email: true, name: true },
          orderBy: { createdAt: 'asc' },
        })
        if (!user) continue

        const firstName = user.name.split(' ')[0]
        const email = upgradeEmail(firstName, docCount)
        await sendEmail({ to: user.email, ...email })
        await prisma.engagementEvent.create({
          data: { tenantId, eventType: 'email_upgrade_sent', metadata: { email: user.email, docCount } },
        })
        results.upgrade++
      } catch (err) {
        logger.error('Upgrade email failed', { tenantId, error: err.message })
        results.errors++
      }
    }

    // 3. Re-engagement: no activity in 7 days
    const allTenants = await prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    })

    for (const { id: tenantId } of allTenants) {
      try {
        const recentActivity = await prisma.engagementEvent.count({
          where: { tenantId, createdAt: { gte: sevenDaysAgo } },
        })
        if (recentActivity > 0) continue

        // Must have at least one event ever (not brand new)
        const anyEvent = await prisma.engagementEvent.count({ where: { tenantId } })
        if (anyEvent === 0) continue

        const reEngageSent = await prisma.engagementEvent.findFirst({
          where: { tenantId, eventType: 'email_reengagement_sent', createdAt: { gte: sevenDaysAgo } },
        })
        if (reEngageSent) continue

        const user = await prisma.user.findFirst({
          where: { tenantId },
          select: { email: true, name: true },
          orderBy: { createdAt: 'asc' },
        })
        if (!user) continue

        const firstName = user.name.split(' ')[0]
        const email = reEngagementEmail(firstName)
        await sendEmail({ to: user.email, ...email })
        await prisma.engagementEvent.create({
          data: { tenantId, eventType: 'email_reengagement_sent', metadata: { email: user.email } },
        })
        results.reEngagement++
      } catch (err) {
        logger.error('Re-engagement email failed', { tenantId, error: err.message })
        results.errors++
      }
    }
  } catch (err) {
    logger.error('Engagement email job failed', { error: err.message })
  }

  return results
}

module.exports = { welcomeEmail, nudgeEmail, upgradeEmail, reEngagementEmail, runEngagementEmails }
