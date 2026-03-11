// ─────────────────────────────────────────────────────────────
//  services/anchorRetryService.js
//
//  Retries failed Polygon anchors for trust seals.
//  - Picks up seals with status 'pending' or 'issued' that have
//    no anchorTxHash and were created > 5 minutes ago.
//  - Retries by re-queuing them (the normal anchorBatch picks
//    them up as pendingSeals).
//  - Tracks retry count. After 3 failures, logs alert.
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')
const logger = require('../lib/logger')
const { emit: siemEmit } = require('./siemService')

const MAX_RETRIES = 3

async function retryFailedAnchors() {
  // Find seals that should have been anchored but weren't
  // Status is 'pending' or 'issued', no anchorTxHash, created > 5 min ago
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

  const staleSeals = await prisma.trustSeal.findMany({
    where: {
      anchorTxHash: null,
      status: { in: ['pending', 'issued'] },
      createdAt: { lt: fiveMinAgo },
      anchorRetryCount: { lt: MAX_RETRIES },
    },
    take: 20,
    orderBy: { createdAt: 'asc' },
    select: { id: true, tenantId: true, anchorRetryCount: true, rawHash: true },
  })

  if (staleSeals.length === 0) return { retried: 0, alerted: 0 }

  // Increment retry count so anchorBatch will pick them up on next run
  let retried = 0
  for (const seal of staleSeals) {
    await prisma.trustSeal.update({
      where: { id: seal.id },
      data: {
        anchorRetryCount: seal.anchorRetryCount + 1,
        anchorLastRetryAt: new Date(),
        status: 'pending', // Reset to pending so anchorBatch picks it up
      },
    })
    retried++
    logger.info('[anchor-retry] Retrying seal', {
      sealId: seal.id,
      attempt: seal.anchorRetryCount + 1,
    })
  }

  // Find seals that have hit max retries
  const failedSeals = await prisma.trustSeal.findMany({
    where: {
      anchorTxHash: null,
      anchorRetryCount: { gte: MAX_RETRIES },
      status: { in: ['pending', 'issued'] },
    },
    select: { id: true, tenantId: true, anchorRetryCount: true },
  })

  let alerted = 0
  for (const seal of failedSeals) {
    logger.error('[anchor-retry] ALERT: Seal failed after max retries', {
      sealId: seal.id,
      tenantId: seal.tenantId,
      retries: seal.anchorRetryCount,
    })
    siemEmit('anchor.retry_exhausted', {
      sealId: seal.id,
      tenantId: seal.tenantId,
      retries: seal.anchorRetryCount,
    }).catch(() => {})
    alerted++
  }

  return { retried, alerted }
}

module.exports = { retryFailedAnchors }
