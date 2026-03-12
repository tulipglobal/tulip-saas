/**
 * Fraud Risk Scorer — computes a 0-100 risk score for documents and expenses.
 *
 * @param {Object} record - document or expense record with duplicate/mismatch fields
 * @returns {{ score: number, level: string, breakdown: Object }}
 */
function scoreFraudRisk(record) {
  let duplicateScore = 0
  let mismatchScore = 0
  let combinedPenalty = 0
  let positiveReductions = 0
  const signals = []

  // ── Duplicate signals ──
  if (record.crossTenantDuplicate || record.crossTenantVisualDuplicate) {
    duplicateScore += 40
    signals.push('Cross-organisation duplicate detected (+40)')
  }

  if (record.duplicateConfidence === 'HIGH') {
    duplicateScore += 30
    signals.push('Duplicate confirmed — text + visual match (+30)')
  } else if (record.duplicateConfidence === 'MEDIUM') {
    duplicateScore += 20
    signals.push('Likely duplicate — OCR content match (+20)')
  } else if (record.duplicateConfidence === 'LOW') {
    duplicateScore += 10
    signals.push('Possible duplicate — visual similarity (+10)')
  } else if (record.isDuplicate) {
    duplicateScore += 25
    signals.push('OCR fingerprint duplicate match (+25)')
  }

  // ── Mismatch signals ──
  if (record.amountMismatch) {
    let amountPenalty = 20
    if (record.ocrAmount != null && record.amount != null && record.ocrAmount > 0) {
      const alteration = Math.abs(record.amount - record.ocrAmount) / record.ocrAmount
      const pct = Math.round(alteration * 100)
      if (alteration > 0.8) {
        amountPenalty = 50
        signals.push(`Amount altered by ${pct}% — OCR read ${record.ocrAmount.toLocaleString()}, saved as ${record.amount.toLocaleString()} (+50)`)
      } else if (alteration > 0.5) {
        amountPenalty = 35
        signals.push(`Amount altered by ${pct}% — OCR read ${record.ocrAmount.toLocaleString()}, saved as ${record.amount.toLocaleString()} (+35)`)
      } else if (alteration >= 0.2) {
        amountPenalty = 20
        signals.push(`Amount altered by ${pct}% — OCR read ${record.ocrAmount.toLocaleString()}, saved as ${record.amount.toLocaleString()} (+20)`)
      } else {
        amountPenalty = 10
        signals.push(`Amount altered by ${pct}% — minor discrepancy (+10)`)
      }
    } else {
      signals.push('Amount mismatch — OCR vs logged amount (+20)')
    }
    mismatchScore += amountPenalty
  }
  if (record.vendorMismatch) {
    mismatchScore += 15
    signals.push('Vendor mismatch — OCR vs logged vendor (+15)')
  }
  if (record.dateMismatch) {
    mismatchScore += 10
    signals.push('Date mismatch — 30+ day difference (+10)')
  }

  // ── Combined signals ──
  if (record.amountMismatch && record.vendorMismatch) {
    combinedPenalty += 10
    signals.push('Amount + vendor both differ — suspicious receipt (+10)')
  }
  if ((record.isDuplicate || record.duplicateConfidence) && (record.amountMismatch || record.vendorMismatch || record.dateMismatch)) {
    combinedPenalty += 10
    signals.push('Duplicate AND tampered — high fraud indicator (+10)')
  }

  // ── Positive signals ──
  if (record.anchorTxHash) {
    positiveReductions += 5
    signals.push('Blockchain anchored — integrity verified (-5)')
  }
  if (record.sealId || record.receiptSealId) {
    positiveReductions += 5
    signals.push('TrustSeal issued — authenticity verified (-5)')
  }

  let score = duplicateScore + mismatchScore + combinedPenalty - positiveReductions
  if (score > 100) score = 100
  if (score < 0) score = 0

  let level = 'LOW'
  if (score >= 81) level = 'CRITICAL'
  else if (score >= 51) level = 'HIGH'
  else if (score >= 21) level = 'MEDIUM'

  return {
    score,
    level,
    breakdown: {
      duplicateScore,
      mismatchScore,
      combinedPenalty,
      positiveReductions,
      signals,
    },
  }
}

module.exports = { scoreFraudRisk }
