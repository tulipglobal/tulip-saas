// ─────────────────────────────────────────────────────────────
//  services/engagementService.js — Customer engagement tracking
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')
const logger = require('../lib/logger')

/**
 * Track an engagement event.
 * @param {string} tenantId
 * @param {string} eventType — signup, first_document, free_limit_reached, upgrade, daily_active, support_message, bundle_processed, seal_issued
 * @param {object} [metadata] — optional JSON metadata
 * @param {string} [userId] — optional user ID
 */
async function trackEvent(tenantId, eventType, metadata = null, userId = null) {
  try {
    await prisma.engagementEvent.create({
      data: { tenantId, userId, eventType, metadata },
    })
  } catch (err) {
    logger.error('Failed to track engagement event', { error: err.message, tenantId, eventType })
  }
}

/**
 * Check if a tenant has any events of the given type.
 */
async function hasEvent(tenantId, eventType) {
  const count = await prisma.engagementEvent.count({
    where: { tenantId, eventType },
  })
  return count > 0
}

module.exports = { trackEvent, hasEvent }
