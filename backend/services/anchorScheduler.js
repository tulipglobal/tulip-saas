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

  logger.info('Blockchain anchor scheduler started (every 5 minutes)')
  logger.info('Webhook retry worker started (every 5 minutes)')
  logger.info('RFC 3161 timestamp job started (every 10 minutes)')
  logger.info('Refresh token cleanup scheduled (daily 3am)')
}

module.exports = { startAnchorScheduler }
