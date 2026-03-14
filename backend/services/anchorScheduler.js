// ─────────────────────────────────────────────────────────────
//  services/anchorScheduler.js — v5
//
//  Changes from v4:
//  ✔ RFC 3161 timestamp job (runs every 10 minutes)
// ─────────────────────────────────────────────────────────────

const cron    = require('node-cron')
const { anchorBatch }             = require('./batchAnchorService')
const { retryFailed: retryFailedDeliveries } = require('./webhookService')
const { cleanupExpiredTokens }    = require('./refreshTokenService')
const { stampPendingLogs }        = require('./timestampService')
const { checkTrialExpirations }  = require('./emailNotificationService')
const { checkDocumentExpiry }   = require('../jobs/expiryAlerts')
const { runEngagementEmails }  = require('./engagementEmailService')
const { retryFailedAnchors }   = require('./anchorRetryService')
const { sendMonthlyReports }  = require('../jobs/monthlyReport')
const prisma  = require('../lib/client')
const { notifyDonorOrgsForProject } = require('./donorNotificationService')
const logger  = require('../lib/logger')

function startAnchorScheduler() {
  // Anchor job — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running batch anchor job...')
    try { await anchorBatch() } catch (err) { logger.error('Anchor job failed', { error: err.message }) }
  })

  // Webhook retry worker — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try { await retryFailedDeliveries() } catch (err) { logger.error('Webhook retry failed', { error: err.message }) }
  })

  // RFC 3161 timestamp job — every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    logger.info('Running RFC 3161 timestamp job...')
    try {
      const result = await stampPendingLogs(10)
      if (result.stamped > 0 || result.failed > 0) {
        logger.info('[timestamp] Batch complete', result)
      }
    } catch (err) {
      logger.error('Timestamp job failed', { error: err.message })
    }
  })

  // Refresh token cleanup — daily at 3am
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running refresh token cleanup...')
    try { await cleanupExpiredTokens() } catch (err) { logger.error('Token cleanup failed', { error: err.message }) }
  })

  // Trial expiration check — daily at 9am
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running trial expiration check...')
    try {
      const result = await checkTrialExpirations()
      if (result.expiringSoon > 0 || result.justExpired > 0) {
        logger.info('[trial-check] Complete', result)
      }
    } catch (err) { logger.error('Trial check failed', { error: err.message }) }
  })

  // Document expiry alert — daily at 8am UAE (4am UTC)
  cron.schedule('0 4 * * *', async () => {
    logger.info('Running document expiry alert check...')
    try {
      const result = await checkDocumentExpiry()
      if (result.alertsSent > 0) {
        logger.info('[expiry-alerts] Complete', result)
      }
    } catch (err) { logger.error('Expiry alert job failed', { error: err.message }) }
  })

  // Engagement email sequences — daily at 5am UTC (9am UAE)
  cron.schedule('0 5 * * *', async () => {
    logger.info('Running engagement email sequences...')
    try {
      const result = await runEngagementEmails()
      if (result.nudge > 0 || result.upgrade > 0 || result.reEngagement > 0) {
        logger.info('[engagement-emails] Complete', result)
      }
    } catch (err) { logger.error('Engagement email job failed', { error: err.message }) }
  })

  // Anchor retry worker — every 5 minutes (retries failed seal anchors)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await retryFailedAnchors()
      if (result.retried > 0 || result.alerted > 0) {
        logger.info('[anchor-retry] Complete', result)
      }
    } catch (err) { logger.error('Anchor retry failed', { error: err.message }) }
  })

  // Monthly donor report — 1st of every month at 02:00 UTC (07:30 IST)
  cron.schedule('0 2 1 * *', async () => {
    logger.info('[monthly-report] Generating monthly donor reports...')
    try {
      const count = await sendMonthlyReports()
      logger.info(`[monthly-report] Sent ${count} report emails`)
    } catch (err) {
      logger.error('[monthly-report] Failed', { error: err.message })
    }
  })

  // Donor document expiry notifications — daily at 02:00 UTC
  cron.schedule('0 2 * * *', async () => {
    logger.info('[donor-doc-expiry] Checking for expiring documents...')
    try {
      // Find documents expiring within 30 days on projects that have donor access
      const expiringDocs = await prisma.$queryRawUnsafe(`
        SELECT d.id, d.name, d."expiryDate", d."projectId", p.name as "projectName"
        FROM "Document" d
        JOIN "Project" p ON p.id = d."projectId"
        WHERE d."expiryDate" IS NOT NULL
          AND d."expiryDate" > NOW()
          AND d."expiryDate" <= NOW() + INTERVAL '30 days'
          AND d."projectId" IN (
            SELECT DISTINCT "projectId" FROM "DonorProjectAccess" WHERE "revokedAt" IS NULL
          )
      `)

      let notified = 0
      for (const doc of expiringDocs) {
        // Dedup: don't send if a notification with the same entityId and alertType was created in the last 7 days
        const recent = await prisma.$queryRawUnsafe(
          `SELECT id FROM "DonorNotification"
           WHERE "alertType" = 'document.expiring' AND "entityId" = $1 AND "createdAt" > NOW() - INTERVAL '7 days'
           LIMIT 1`,
          doc.id
        )
        if (recent.length > 0) continue

        const daysUntil = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        await notifyDonorOrgsForProject(
          doc.projectId,
          'document.expiring',
          `Document expiring — ${doc.name}`,
          `"${doc.name}" on ${doc.projectName} expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${new Date(doc.expiryDate).toISOString().split('T')[0]}). Please ensure it is renewed or replaced.`,
          'document',
          doc.id
        )
        notified++
      }

      if (notified > 0) {
        logger.info(`[donor-doc-expiry] Sent ${notified} expiry notifications`)
      }
    } catch (err) {
      logger.error('[donor-doc-expiry] Failed', { error: err.message })
    }
  })

  logger.info('Blockchain anchor scheduler started (every 5 minutes)')
  logger.info('Anchor retry worker started (every 5 minutes)')
  logger.info('Webhook retry worker started (every 5 minutes)')
  logger.info('RFC 3161 timestamp job started (every 10 minutes)')
  logger.info('Refresh token cleanup scheduled (daily 3am)')
  logger.info('Trial expiration check scheduled (daily 9am)')
  logger.info('Document expiry alert check scheduled (daily 4am UTC / 8am UAE)')
  logger.info('Engagement email sequences scheduled (daily 5am UTC / 9am UAE)')
  logger.info('Monthly donor report scheduled (1st of month, 2am UTC)')
  logger.info('Donor document expiry notifications scheduled (daily 2am UTC)')
}

module.exports = { startAnchorScheduler }
