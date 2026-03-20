// ─────────────────────────────────────────────────────────────
//  lib/currency.ts — Currency formatting & rounding for donor portal
// ─────────────────────────────────────────────────────────────

const ZERO_DECIMAL_CURRENCIES = [
  'XAF', 'XOF', 'JPY', 'KRW', 'VND', 'BIF', 'CLP', 'DJF',
  'GNF', 'ISK', 'KMF', 'PYG', 'RWF', 'UGX', 'VUV', 'MGA', 'XPF',
]

const THREE_DECIMAL_CURRENCIES = ['OMR', 'KWD', 'BHD', 'TND', 'LYD', 'IQD']

/** Get the correct number of decimal places for a currency */
export function getDecimalPlaces(currencyCode: string): number {
  if (!currencyCode) return 2
  const code = currencyCode.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.includes(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.includes(code)) return 3
  return 2
}

/**
 * Format an amount with its currency symbol using Intl.NumberFormat.
 * Respects per-currency decimal rules (0 for XAF/JPY, 3 for OMR/KWD, 2 default).
 */
export function formatMoney(amount: number, currencyCode: string = 'USD'): string {
  const decimals = getDecimalPlaces(currencyCode)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount || 0)
  } catch {
    return `${currencyCode} ${(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`
  }
}

/**
 * Compact format for dashboard cards: "USD 1.2M", "XAF 16M"
 */
export function formatMoneyCompact(amount: number, currencyCode: string = 'USD'): string {
  const abs = Math.abs(amount || 0)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}${currencyCode} ${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${sign}${currencyCode} ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${currencyCode} ${(abs / 1_000).toFixed(0)}K`
  return formatMoney(amount, currencyCode)
}
