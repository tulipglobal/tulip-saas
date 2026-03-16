// ─────────────────────────────────────────────────────────────
//  services/exchangeRateService.js — Monthly exchange rate fetcher
//
//  Primary: Frankfurter.app (free, no key)
//  Backup:  Open Exchange Rates (OXR_APP_ID env var)
//  Failure: Falls back to previous month's rate
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')
const { createAuditLog } = require('./auditService')

/**
 * Fetch ALL rates from Frankfurter.app for a given base currency.
 * When no targets specified, returns every world currency.
 * @param {string} base - e.g. 'USD'
 * @param {string[]} [targets] - optional filter; omit for all currencies
 * @returns {{ [currency: string]: number }} or null on failure
 */
async function fetchFromFrankfurter(base, targets) {
  try {
    const url = targets && targets.length > 0
      ? `https://api.frankfurter.app/latest?from=${base}&to=${targets.join(',')}`
      : `https://api.frankfurter.app/latest?from=${base}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.rates || null
  } catch (err) {
    console.error('[ExchangeRate] Frankfurter fetch failed:', err.message)
    return null
  }
}

/**
 * Fetch rates from Open Exchange Rates (requires OXR_APP_ID)
 * Note: Free tier only supports USD as base
 */
async function fetchFromOpenExchangeRates(base, targets) {
  const appId = process.env.OXR_APP_ID
  if (!appId) return null
  try {
    const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.rates) return null

    // OXR always returns USD-based rates — convert if base != USD
    const result = {}
    for (const target of targets) {
      if (base === 'USD') {
        if (data.rates[target]) result[target] = data.rates[target]
      } else {
        // Cross rate: base→target = (USD→target) / (USD→base)
        if (data.rates[target] && data.rates[base]) {
          result[target] = data.rates[target] / data.rates[base]
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null
  } catch (err) {
    console.error('[ExchangeRate] OXR fetch failed:', err.message)
    return null
  }
}

/**
 * Fetch rates with retry logic
 */
async function fetchWithRetry(base, targets, maxRetries = 3) {
  // Try Frankfurter first (targets=null means fetch all)
  for (let i = 0; i < maxRetries; i++) {
    const rates = await fetchFromFrankfurter(base, targets)
    if (rates) return { rates, source: 'frankfurter' }
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 2000))
  }

  // Fallback to Open Exchange Rates (only if we have specific targets)
  if (targets && targets.length > 0) {
    for (let i = 0; i < maxRetries; i++) {
      const rates = await fetchFromOpenExchangeRates(base, targets)
      if (rates) return { rates, source: 'openexchangerates' }
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 2000))
    }
  }

  return null
}

/**
 * Main function: Fetch and store ALL world currency rates from USD.
 * Uses a single Frankfurter call: GET /latest?from=USD (returns ~30 currencies).
 * Also fetches EUR-based rates for full coverage.
 * @param {string} month - "YYYY-MM" format
 */
async function fetchMonthlyRates(month) {
  if (!month) month = new Date().toISOString().slice(0, 7)

  console.log(`[ExchangeRate] Fetching ALL world currency rates for month: ${month}`)

  let fetched = 0
  let failed = 0

  // Fetch all currencies with USD as base (single API call)
  const bases = ['USD', 'EUR', 'GBP']

  for (const base of bases) {
    const result = await fetchWithRetry(base, null) // null = fetch ALL

    if (result) {
      for (const [target, rate] of Object.entries(result.rates)) {
        try {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ExchangeRate" (id, "baseCurrency", "targetCurrency", rate, month, source, "fetchedAt", "createdAt")
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT ("baseCurrency", "targetCurrency", month)
            DO UPDATE SET rate = $3, source = $5, "fetchedAt" = NOW()
            WHERE "ExchangeRate"."lockedAt" IS NULL
          `, base, target, rate, month, result.source)
          fetched++
        } catch (err) {
          console.error(`[ExchangeRate] Failed to store ${base}→${target}:`, err.message)
          failed++
        }
      }
      console.log(`[ExchangeRate] ${base}: ${Object.keys(result.rates).length} currencies stored (${result.source})`)
    } else {
      // Both APIs failed — use previous month's rates for this base
      console.warn(`[ExchangeRate] Both APIs failed for ${base}. Using previous month rates.`)
      const prevMonth = getPreviousMonth(month)
      try {
        const prevRates = await prisma.$queryRawUnsafe(`
          SELECT "targetCurrency", rate FROM "ExchangeRate"
          WHERE "baseCurrency" = $1 AND month = $2
        `, base, prevMonth)

        for (const prev of prevRates) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO "ExchangeRate" (id, "baseCurrency", "targetCurrency", rate, month, source, "fetchedAt", "createdAt")
              VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'previous', NOW(), NOW())
              ON CONFLICT ("baseCurrency", "targetCurrency", month)
              DO UPDATE SET rate = $3, source = 'previous', "fetchedAt" = NOW()
              WHERE "ExchangeRate"."lockedAt" IS NULL
            `, base, prev.targetCurrency, Number(prev.rate), month)
            fetched++
          } catch (err) { failed++ }
        }
        console.log(`[ExchangeRate] ${base}: ${prevRates.length} rates copied from previous month`)
      } catch (err) {
        console.error(`[ExchangeRate] Fallback failed for ${base}:`, err.message)
      }
    }
  }

  // Audit log
  await createAuditLog({
    action: 'EXCHANGE_RATES_FETCHED',
    entityType: 'ExchangeRate',
    entityId: month,
    userId: null,
    tenantId: 'SYSTEM',
    metadata: { month, fetched, failed },
  }).catch(() => {})

  console.log(`[ExchangeRate] Done: ${fetched} fetched, ${failed} failed`)
  return { fetched, failed }
}

/**
 * Get previous month string
 */
function getPreviousMonth(month) {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 2, 1) // month is 0-indexed, subtract 2 to go back 1
  return d.toISOString().slice(0, 7)
}

/**
 * Get rate for a specific pair and month
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
 * Get all rates for a month
 */
async function getRatesForMonth(month) {
  return prisma.$queryRawUnsafe(`
    SELECT * FROM "ExchangeRate"
    WHERE month = $1
    ORDER BY "baseCurrency", "targetCurrency"
  `, month)
}

/**
 * Get rates for a specific project (its base→donor pair and all relevant months)
 */
async function getRatesForProject(projectId) {
  const project = await prisma.$queryRawUnsafe(`
    SELECT "baseCurrency", "donorReportingCurrency" FROM "Project" WHERE id = $1
  `, projectId)

  if (!project.length || !project[0].donorReportingCurrency) return []

  const { baseCurrency, donorReportingCurrency } = project[0]
  if (baseCurrency === donorReportingCurrency) return []

  return prisma.$queryRawUnsafe(`
    SELECT * FROM "ExchangeRate"
    WHERE ("baseCurrency" = $1 AND "targetCurrency" = $2)
       OR ("baseCurrency" = $2 AND "targetCurrency" = $1)
    ORDER BY month DESC
  `, baseCurrency, donorReportingCurrency)
}

/**
 * Manually set a rate (admin only)
 */
async function setManualRate(baseCurrency, targetCurrency, rate, month, userId) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ExchangeRate" (id, "baseCurrency", "targetCurrency", rate, month, source, "fetchedAt", "createdAt")
    VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'manual', NOW(), NOW())
    ON CONFLICT ("baseCurrency", "targetCurrency", month)
    DO UPDATE SET rate = $3, source = 'manual', "fetchedAt" = NOW()
    WHERE "ExchangeRate"."lockedAt" IS NULL
  `, baseCurrency, targetCurrency, rate, month)

  return { baseCurrency, targetCurrency, rate, month, source: 'manual' }
}

/**
 * Lock a rate (prevents future overwrites)
 */
async function lockRate(rateId, userId) {
  await prisma.$executeRawUnsafe(`
    UPDATE "ExchangeRate" SET "lockedAt" = NOW(), "lockedByUserId" = $1
    WHERE id = $2
  `, userId, rateId)
}

/**
 * Get all available months that have exchange rate data
 */
async function getAvailableMonths() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT month FROM "ExchangeRate" ORDER BY month DESC
  `)
  return rows.map(r => r.month)
}

/**
 * Get all rates for a specific base currency across all months
 */
async function getRatesForBase(baseCurrency, months) {
  const monthFilter = months && months.length > 0
    ? `AND month = ANY($2::text[])`
    : ''
  const params = months && months.length > 0
    ? [baseCurrency, months]
    : [baseCurrency]
  return prisma.$queryRawUnsafe(`
    SELECT "baseCurrency", "targetCurrency", rate, month, source, "lockedAt", "sealTxHash"
    FROM "ExchangeRate"
    WHERE "baseCurrency" = $1 ${monthFilter}
    ORDER BY "targetCurrency", month DESC
  `, ...params)
}

module.exports = {
  fetchMonthlyRates,
  getRate,
  getRatesForMonth,
  getRatesForProject,
  setManualRate,
  lockRate,
  getAvailableMonths,
  getRatesForBase,
  fetchFromFrankfurter,
  fetchFromOpenExchangeRates,
}
