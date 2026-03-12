// ─────────────────────────────────────────────────────────────
//  lib/unifiedSealEngine.js
//
//  Wraps seal creation with fraud context and source tracking.
//  Delegates to universalSealService for dedup + creation,
//  then attaches fraud scoring and sourceType metadata.
// ─────────────────────────────────────────────────────────────

const { autoIssueSeal } = require('../services/universalSealService')
const prisma = require('./client')

/**
 * @param {Object} opts - All autoIssueSeal params plus:
 * @param {string} [opts.sourceType]   e.g. 'DASHBOARD', 'API', 'VERIFY', 'DOCUMENT_UPLOAD'
 * @param {Object} [opts.fraudContext]
 * @param {number} [opts.fraudContext.riskScore]
 * @param {string} [opts.fraudContext.riskLevel]
 * @param {string[]} [opts.fraudContext.signals]
 * @returns {Promise<Object>} the TrustSeal record
 */
async function createSeal({
  sourceType, fraudContext,
  ...sealOpts
}) {
  const seal = await autoIssueSeal(sealOpts)

  const updateData = {}
  if (sourceType) updateData.sourceType = sourceType
  if (fraudContext) {
    if (fraudContext.riskScore != null) updateData.fraudRiskScore = fraudContext.riskScore
    if (fraudContext.riskLevel) updateData.fraudRiskLevel = fraudContext.riskLevel
    if (fraudContext.signals) updateData.fraudSignals = fraudContext.signals
  }

  if (Object.keys(updateData).length > 0) {
    return prisma.trustSeal.update({ where: { id: seal.id }, data: updateData })
  }
  return seal
}

module.exports = { createSeal }
