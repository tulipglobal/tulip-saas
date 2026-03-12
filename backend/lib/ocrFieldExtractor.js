// ─────────────────────────────────────────────────────────────
//  lib/ocrFieldExtractor.js
//
//  Extracts structured expense fields from OCR key-value pairs
//  and raw text. Returns { amount, currency, vendor, date, extras }
// ─────────────────────────────────────────────────────────────

/**
 * @param {Object} ocrResult — from ocrService.extractText()
 * @param {string} ocrResult.rawText
 * @param {Record<string,string>} ocrResult.keyValuePairs
 * @returns {{ amount: number|null, currency: string|null, vendor: string|null, date: string|null, extras: Record<string,string> }}
 */
function extractExpenseFields(ocrResult) {
  const { rawText = '', keyValuePairs = {} } = ocrResult
  const kvLower = {}
  for (const [k, v] of Object.entries(keyValuePairs)) {
    kvLower[k.toLowerCase().trim()] = v
  }

  const result = {
    amount: null,
    currency: null,
    vendor: null,
    date: null,
    extras: {},
  }

  // ── Amount ──
  result.amount = extractAmount(kvLower, rawText)

  // ── Currency ──
  result.currency = extractCurrency(kvLower, rawText)

  // ── Vendor ──
  result.vendor = extractVendor(kvLower, rawText)

  // ── Date ──
  result.date = extractDate(kvLower, rawText)

  // ── Extras (TRN, PO number, payment terms, etc.) ──
  const extraKeys = [
    ['trn', 'TRN'], ['tax registration', 'TRN'], ['vat number', 'VAT Number'], ['vat no', 'VAT Number'],
    ['po number', 'PO Number'], ['purchase order', 'PO Number'], ['po no', 'PO Number'], ['p.o. number', 'PO Number'],
    ['payment terms', 'Payment Terms'], ['payment term', 'Payment Terms'], ['terms', 'Payment Terms'],
    ['invoice number', 'Invoice Number'], ['invoice no', 'Invoice Number'], ['inv no', 'Invoice Number'],
    ['reference', 'Reference'], ['ref', 'Reference'], ['ref no', 'Reference'],
    ['due date', 'Due Date'],
    ['delivery date', 'Delivery Date'],
    ['ship to', 'Ship To'], ['shipping address', 'Ship To'],
    ['bill to', 'Bill To'], ['billing address', 'Bill To'],
  ]

  for (const [kvKey, label] of extraKeys) {
    const val = findKV(kvLower, kvKey)
    if (val && !result.extras[label]) {
      result.extras[label] = val
    }
  }

  return result
}

function extractAmount(kvLower, rawText) {
  // Try key-value pairs first
  const amountKeys = ['total', 'total amount', 'grand total', 'net amount', 'amount due', 'amount', 'balance due', 'total due', 'sub total', 'subtotal']
  for (const key of amountKeys) {
    const val = findKV(kvLower, key)
    if (val) {
      const num = parseAmount(val)
      if (num !== null && num > 0) return num
    }
  }

  // Fallback: scan raw text for total line
  const totalPattern = /(?:total|amount\s*due|grand\s*total|balance\s*due)[:\s]*[A-Z]{0,3}\s*[\d,]+\.?\d*/i
  const match = rawText.match(totalPattern)
  if (match) {
    const num = parseAmount(match[0])
    if (num !== null && num > 0) return num
  }

  return null
}

function extractCurrency(kvLower, rawText) {
  const currencyKeys = ['currency']
  for (const key of currencyKeys) {
    const val = findKV(kvLower, key)
    if (val) {
      const cur = parseCurrency(val)
      if (cur) return cur
    }
  }

  // Scan for currency codes/symbols in raw text
  const codes = rawText.match(/\b(AED|USD|EUR|GBP|INR|SAR|QAR|BHD|OMR|KWD|KES|UGX|TZS|NGN|ZAR|CAD|AUD|SGD|CHF|JPY)\b/i)
  if (codes) return codes[1].toUpperCase()

  const symbols = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY', 'AED': 'AED', 'Dhs': 'AED', 'KSh': 'KES' }
  for (const [sym, code] of Object.entries(symbols)) {
    if (rawText.includes(sym)) return code
  }

  return null
}

function extractVendor(kvLower, rawText) {
  const vendorKeys = ['vendor', 'supplier', 'company', 'from', 'seller', 'sold by', 'billed by', 'merchant', 'payee']
  for (const key of vendorKeys) {
    const val = findKV(kvLower, key)
    if (val && val.length > 2 && val.length < 100) return val
  }

  // Try to find company name from first few lines
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length > 0) {
    // First non-date, non-number line that looks like a company name
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i]
      if (line.length > 3 && line.length < 80 &&
          !/^\d{1,2}[\/\-]/.test(line) &&
          !/^(invoice|receipt|tax|date|total|amount|page)/i.test(line) &&
          !/^\d+$/.test(line)) {
        return line
      }
    }
  }

  return null
}

function extractDate(kvLower, rawText) {
  const dateKeys = ['date', 'invoice date', 'receipt date', 'issue date', 'document date', 'transaction date']
  for (const key of dateKeys) {
    const val = findKV(kvLower, key)
    if (val) {
      const d = parseDate(val)
      if (d) return d
    }
  }

  // Scan raw text for date patterns
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/i,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  ]
  for (const pat of datePatterns) {
    const match = rawText.match(pat)
    if (match) {
      const d = parseDate(match[1])
      if (d) return d
    }
  }

  return null
}

// ── Helpers ──

function findKV(kvLower, key) {
  // Exact match first
  if (kvLower[key]) return kvLower[key]
  // Key starts with search term (e.g. "date" matches "date issued" but not "due date")
  for (const [k, v] of Object.entries(kvLower)) {
    if (k.startsWith(key + ' ') || k.startsWith(key + ':')) return v
  }
  // Key ends with search term (e.g. "invoice date" matches searching for "date")
  for (const [k, v] of Object.entries(kvLower)) {
    if (k.endsWith(' ' + key)) return v
  }
  return null
}

function parseAmount(str) {
  if (!str) return null
  // Remove currency symbols, letters, whitespace, then parse
  const cleaned = str.replace(/[A-Za-z$€£₹¥]/g, '').replace(/\s/g, '').replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.round(num * 100) / 100
}

function parseCurrency(str) {
  if (!str) return null
  const upper = str.toUpperCase().trim()
  const known = ['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'QAR', 'BHD', 'OMR', 'KWD', 'KES', 'UGX', 'TZS', 'NGN', 'ZAR', 'CAD', 'AUD', 'SGD', 'CHF', 'JPY']
  if (known.includes(upper)) return upper
  return null
}

function parseDate(str) {
  if (!str) return null
  try {
    // Handle DD/MM/YYYY or DD-MM-YYYY (common in Gulf/UK)
    const dmyMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch
      const yy = parseInt(year), mm = String(parseInt(month)).padStart(2, '0'), dd = String(parseInt(day)).padStart(2, '0')
      if (yy > 2000) return `${yy}-${mm}-${dd}`
    }
    // Handle YYYY-MM-DD
    const ymdMatch = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
    if (ymdMatch) {
      const d = new Date(str)
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d.toISOString().split('T')[0]
    }
    // Fallback to native parser
    const d = new Date(str)
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
      return d.toISOString().split('T')[0]
    }
  } catch {}
  return null
}

module.exports = { extractExpenseFields }
