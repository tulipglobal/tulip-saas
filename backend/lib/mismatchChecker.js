// lib/mismatchChecker.js
// Compares expense fields against OCR-extracted values and returns mismatch flags + note

/**
 * @param {{ amount: number, vendor: string|null, expenseDate: string|null }} expense
 * @param {{ ocrAmount: number|null, ocrVendor: string|null, ocrDate: string|null }} ocr
 * @returns {{ amountMismatch: boolean, vendorMismatch: boolean, dateMismatch: boolean, mismatchNote: string|null }}
 */
function checkMismatches(expense, ocr) {
  const notes = []
  let amountMismatch = false
  let vendorMismatch = false
  let dateMismatch = false

  // Amount mismatch
  if (ocr.ocrAmount != null && expense.amount != null) {
    const diff = Math.abs(expense.amount - ocr.ocrAmount)
    if (diff > 0.01) {
      amountMismatch = true
      notes.push(`OCR extracted ${ocr.ocrAmount.toLocaleString()} but logged as ${expense.amount.toLocaleString()}`)
    }
  }

  // Vendor mismatch
  if (ocr.ocrVendor && expense.vendor) {
    const a = ocr.ocrVendor.toLowerCase().replace(/\s+/g, ' ').trim()
    const b = expense.vendor.toLowerCase().replace(/\s+/g, ' ').trim()
    if (a !== b) {
      vendorMismatch = true
      notes.push(`OCR extracted vendor "${ocr.ocrVendor}" but logged as "${expense.vendor}"`)
    }
  }

  // Date mismatch (>30 days difference)
  if (ocr.ocrDate && expense.expenseDate) {
    try {
      const ocrD = new Date(ocr.ocrDate)
      const expD = new Date(expense.expenseDate)
      if (!isNaN(ocrD.getTime()) && !isNaN(expD.getTime())) {
        const diffDays = Math.abs(ocrD.getTime() - expD.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays > 30) {
          dateMismatch = true
          notes.push(`OCR extracted date ${ocr.ocrDate} but logged as ${expense.expenseDate} (${Math.round(diffDays)} days difference)`)
        }
      }
    } catch {}
  }

  return {
    amountMismatch,
    vendorMismatch,
    dateMismatch,
    mismatchNote: notes.length > 0 ? notes.join('; ') : null,
  }
}

module.exports = { checkMismatches }
