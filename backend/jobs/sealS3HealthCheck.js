// ─────────────────────────────────────────────────────────────
//  jobs/sealS3HealthCheck.js — Periodic S3 health check for seals
//
//  HEAD-checks S3 objects for recent seals to verify files exist.
//  Runs every 6 hours via anchorScheduler. Logs missing files
//  so issues are caught before demos.
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')
const { headObject } = require('../lib/s3Upload')
const logger = require('../lib/logger')

async function checkSealS3Health() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const seals = await prisma.trustSeal.findMany({
    where: {
      s3Key: { not: null },
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { id: true, s3Key: true, tenantId: true, documentTitle: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  let checked = 0, healthy = 0, missing = 0, errors = 0
  const missingSeals = []

  for (const seal of seals) {
    checked++
    try {
      // Handle legacy full-URL keys
      let key = seal.s3Key
      if (key.startsWith('http')) {
        try { key = decodeURIComponent(new URL(key).pathname.substring(1)) } catch {}
      }

      const head = await headObject(key)
      if (head.exists) {
        healthy++
      } else if (head.notFound) {
        missing++
        missingSeals.push({ sealId: seal.id, s3Key: seal.s3Key, title: seal.documentTitle })
        logger.error('[s3-health] MISSING object', { sealId: seal.id, s3Key: seal.s3Key, tenantId: seal.tenantId })
      }
    } catch (err) {
      errors++
      logger.error('[s3-health] Check failed', { sealId: seal.id, error: err.message })
    }
  }

  return { checked, healthy, missing, errors, missingSeals }
}

module.exports = { checkSealS3Health }
