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

  logger.info('Blockchain anchor scheduler started (every 5 minutes)')
  logger.info('Webhook retry worker started (every 5 minutes)')
  logger.info('RFC 3161 timestamp job started (every 10 minutes)')
  logger.info('Refresh token cleanup scheduled (daily 3am)')
  logger.info('Trial expiration check scheduled (daily 9am)')
  logger.info('Document expiry alert check scheduled (daily 4am UTC / 8am UAE)')
  logger.info('Engagement email sequences scheduled (daily 5am UTC / 9am UAE)')
}

module.exports = { startAnchorScheduler }
