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

// All ISO 4217 currency codes supported by the platform
const ALL_CURRENCY_CODES = [
  'AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF',
  'BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC',
  'CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','GBP','GEL','GHS','GMD',
  'GNF','GTQ','GYD','HKD','HNL','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY',
  'KES','KGS','KHR','KMF','KRW','KWD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA',
  'MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR',
  'NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD',
  'SCR','SDG','SEK','SGD','SLL','SOS','SRD','SSP','STN','SYP','SZL','THB','TJS','TMT','TND','TOP',
  'TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XOF',
  'YER','ZAR','ZMW','ZWL',
]
const CURRENCY_CODE_SET = new Set(ALL_CURRENCY_CODES)

function extractCurrency(kvLower, rawText) {
  const currencyKeys = ['currency']
  for (const key of currencyKeys) {
    const val = findKV(kvLower, key)
    if (val) {
      const cur = parseCurrency(val)
      if (cur) return cur
    }
  }

  // Scan for any 3-letter ISO currency code in raw text
  const codePattern = /\b([A-Z]{3})\b/g
  let match
  while ((match = codePattern.exec(rawText)) !== null) {
    if (CURRENCY_CODE_SET.has(match[1])) return match[1]
  }
  // Also try case-insensitive for OCR that may lowercase
  const codeLower = rawText.match(/\b([A-Za-z]{3})\b/g)
  if (codeLower) {
    for (const c of codeLower) {
      if (CURRENCY_CODE_SET.has(c.toUpperCase())) return c.toUpperCase()
    }
  }

  // Symbol detection
  const symbols = {
    '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY', '₩': 'KRW', '₱': 'PHP',
    '₫': 'VND', '₦': 'NGN', '₵': 'GHS', '₪': 'ILS', '₸': 'KZT', '₴': 'UAH',
    '₽': 'RUB', '₺': 'TRY', '₡': 'CRC', '₲': 'PYG', '฿': 'THB', '៛': 'KHR',
    '₭': 'LAK', '₮': 'MNT', '﷼': 'IRR', '₠': 'EUR',
    'Dhs': 'AED', 'DH': 'AED', 'KSh': 'KES', 'USh': 'UGX', 'TSh': 'TZS',
    'R$': 'BRL', 'S/.': 'PEN', 'Bs.': 'BOB', 'Bs.S': 'VES', 'Mex$': 'MXN',
    'RM': 'MYR', 'Rp': 'IDR', 'Rs': 'INR', 'Rs.': 'INR',
  }
  for (const [sym, code] of Object.entries(symbols)) {
    if (rawText.includes(sym)) return code
  }

  // $ is ambiguous — check context for non-USD dollar currencies
  if (rawText.includes('$')) {
    // Check for specific dollar prefixes first
    if (/\bA\$/.test(rawText)) return 'AUD'
    if (/\bC\$/.test(rawText)) return 'CAD'
    if (/\bNZ\$/.test(rawText)) return 'NZD'
    if (/\bHK\$/.test(rawText)) return 'HKD'
    if (/\bS\$/.test(rawText)) return 'SGD'
    if (/\bTT\$/.test(rawText)) return 'TTD'
    return 'USD'
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
  return normaliseAmount(str)
}

/**
 * Normalise an OCR-extracted amount string to a number.
 * Handles:
 *  - European: 25.000,00 → 25000.00
 *  - Swiss:    25'000.00 → 25000.00
 *  - Indian:   2,50,000.00 → 250000.00
 *  - Arabic-Indic numerals: ٢٥٠٠٠ → 25000
 *  - Non-breaking spaces: 25 000,00 → 25000.00
 */
function normaliseAmount(str) {
  if (!str) return null

  // Replace Arabic-Indic numerals (٠-٩) with Western digits
  let cleaned = str.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
  // Replace Extended Arabic-Indic numerals (۰-۹)
  cleaned = cleaned.replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))

  // Strip currency symbols, letters, and non-breaking/regular spaces
  cleaned = cleaned.replace(/[A-Za-z$€£₹¥₦₫₱₩₪₵]/g, '').replace(/[\s\u00A0]/g, '')

  // Strip apostrophes used as thousands separators (Swiss: 25'000.00)
  cleaned = cleaned.replace(/'/g, '')

  if (!cleaned) return null

  // Determine decimal separator: check the last separator character
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma > lastDot) {
    // Comma is the decimal separator (European: 25.000,00)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // Dot is the decimal separator (US/UK: 25,000.00 or Indian: 2,50,000.00)
    cleaned = cleaned.replace(/,/g, '')
  } else {
    // No mixed separators — just strip commas
    cleaned = cleaned.replace(/,/g, '')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.round(num * 100) / 100
}

function parseCurrency(str) {
  if (!str) return null
  const upper = str.toUpperCase().trim()
  // Direct 3-letter code match
  if (CURRENCY_CODE_SET.has(upper)) return upper
  // Try extracting a 3-letter code from a longer string (e.g. "AED - Dirham")
  const codeMatch = upper.match(/\b([A-Z]{3})\b/)
  if (codeMatch && CURRENCY_CODE_SET.has(codeMatch[1])) return codeMatch[1]
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

module.exports = { extractExpenseFields, normaliseAmount }
