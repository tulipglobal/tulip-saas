// ─────────────────────────────────────────────────────────────
//  lib/currencyUtils.js — Currency formatting, rounding, conversion
// ─────────────────────────────────────────────────────────────

const prisma = require('./client')

// Currencies with 0 decimal places
const ZERO_DECIMAL_CURRENCIES = [
  'XAF', 'XOF', 'JPY', 'KRW', 'VND', 'BIF', 'CLP', 'DJF',
  'GNF', 'ISK', 'KMF', 'PYG', 'RWF', 'UGX', 'VUV', 'MGA',
  'XPF',
]

// Currencies with 3 decimal places
const THREE_DECIMAL_CURRENCIES = ['OMR', 'KWD', 'BHD', 'TND', 'LYD', 'IQD']

function getDecimalPlaces(currencyCode) {
  if (!currencyCode) return 2
  const code = currencyCode.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.includes(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.includes(code)) return 3
  return 2
}

/**
 * Round amount to correct decimal places for the currency.
 * Only use at display time — store full precision in DB.
 */
function roundForCurrency(amount, currencyCode) {
  const decimals = getDecimalPlaces(currencyCode)
  const factor = Math.pow(10, decimals)
  return Math.round(amount * factor) / factor
}

/**
 * Format amount with currency symbol using Intl.NumberFormat.
 */
function formatMoney(amount, currencyCode = 'USD') {
  const decimals = getDecimalPlaces(currencyCode)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0)
  } catch {
    // Fallback for unknown currency codes
    return `${currencyCode} ${(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`
  }
}

/**
 * Compact format for large amounts: "USD 1.2M", "XAF 16M"
 */
function formatMoneyCompact(amount, currencyCode = 'USD') {
  const abs = Math.abs(amount || 0)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}${currencyCode} ${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${sign}${currencyCode} ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${currencyCode} ${(abs / 1_000).toFixed(0)}K`
  return formatMoney(amount, currencyCode)
}

/**
 * Look up exchange rate for a given month.
 * @returns {number} rate (1 base = rate target)
 */
async function getRate(baseCurrency, targetCurrency, month) {
  if (baseCurrency === targetCurrency) return 1

  const rows = await prisma.$queryRawUnsafe(`
    SELECT rate FROM "ExchangeRate"
    WHERE "baseCurrency" = $1 AND "targetCurrency" = $2 AND month = $3
    LIMIT 1
  `, baseCurrency, targetCurrency, month)

  if (rows.length > 0) return Number(rows[0].rate)

  // Try inverse
  const inverse = await prisma.$queryRawUnsafe(`
    SELECT rate FROM "ExchangeRate"
    WHERE "baseCurrency" = $1 AND "targetCurrency" = $2 AND month = $3
    LIMIT 1
  `, targetCurrency, baseCurrency, month)

  if (inverse.length > 0) return 1 / Number(inverse[0].rate)

  return null
}

/**
 * Convert an amount between currencies using the stored rate for a given month.
 * Returns { convertedAmount, rate, month } or null if no rate found.
 */
async function convertAmount(amount, fromCurrency, toCurrency, month) {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, rate: 1, month }
  }
  const rate = await getRate(fromCurrency, toCurrency, month)
  if (rate === null) return null
  return {
    convertedAmount: amount * rate,
    rate,
    month,
  }
}

/**
 * Get the month string for a date (YYYY-MM format).
 */
function getMonthKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().slice(0, 7)
}

module.exports = {
  ZERO_DECIMAL_CURRENCIES,
  THREE_DECIMAL_CURRENCIES,
  getDecimalPlaces,
  roundForCurrency,
  formatMoney,
  formatMoneyCompact,
  getRate,
  convertAmount,
  getMonthKey,
}
