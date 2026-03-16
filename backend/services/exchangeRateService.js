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
 * Fetch rates from Frankfurter.app
 * @param {string} base - e.g. 'USD'
 * @param {string[]} targets - e.g. ['XAF', 'EUR', 'GBP']
 * @returns {{ [currency: string]: number }} or null on failure
 */
async function fetchFromFrankfurter(base, targets) {
  try {
    const url = `https://api.frankfurter.app/latest?from=${base}&to=${targets.join(',')}`
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
  // Try Frankfurter first
  for (let i = 0; i < maxRetries; i++) {
    const rates = await fetchFromFrankfurter(base, targets)
    if (rates) return { rates, source: 'frankfurter' }
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 2000))
  }

  // Fallback to Open Exchange Rates
  for (let i = 0; i < maxRetries; i++) {
    const rates = await fetchFromOpenExchangeRates(base, targets)
    if (rates) return { rates, source: 'openexchangerates' }
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 2000))
  }

  return null
}

/**
 * Main function: Fetch and store monthly rates for all active project currency pairs.
 * @param {string} month - "YYYY-MM" format
 */
async function fetchMonthlyRates(month) {
  if (!month) month = new Date().toISOString().slice(0, 7)

  console.log(`[ExchangeRate] Fetching rates for month: ${month}`)

  // 1. Determine which currency pairs we need
  const projects = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT "baseCurrency", "donorReportingCurrency"
    FROM "Project"
    WHERE "donorReportingCurrency" IS NOT NULL
      AND "baseCurrency" != "donorReportingCurrency"
      AND status = 'active'
  `)

  // Also get currencies from funding agreements
  const agreements = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT fa.currency as "agreementCurrency", p."baseCurrency"
    FROM "FundingAgreement" fa
    JOIN "ProjectFunding" pf ON pf."fundingAgreementId" = fa.id
    JOIN "Project" p ON p.id = pf."projectId"
    WHERE fa.currency != p."baseCurrency"
  `)

  // Build unique pairs: { base -> Set<target> }
  const pairs = {}
  for (const p of projects) {
    if (!pairs[p.baseCurrency]) pairs[p.baseCurrency] = new Set()
    pairs[p.baseCurrency].add(p.donorReportingCurrency)
  }
  for (const a of agreements) {
    if (!pairs[a.baseCurrency]) pairs[a.baseCurrency] = new Set()
    pairs[a.baseCurrency].add(a.agreementCurrency)
    // Also store inverse for donor→base lookups
    if (!pairs[a.agreementCurrency]) pairs[a.agreementCurrency] = new Set()
    pairs[a.agreementCurrency].add(a.baseCurrency)
  }

  if (Object.keys(pairs).length === 0) {
    console.log('[ExchangeRate] No currency pairs needed — skipping')
    return { fetched: 0, failed: 0 }
  }

  let fetched = 0
  let failed = 0

  for (const [base, targetSet] of Object.entries(pairs)) {
    const targets = [...targetSet]
    const result = await fetchWithRetry(base, targets)

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
          console.log(`[ExchangeRate] ${base}→${target} = ${rate} (${result.source})`)
        } catch (err) {
          console.error(`[ExchangeRate] Failed to store ${base}→${target}:`, err.message)
          failed++
        }
      }
    } else {
      // Both APIs failed — use previous month's rate
      console.warn(`[ExchangeRate] Both APIs failed for ${base}→${targets.join(',')}. Using previous month rates.`)
      const prevMonth = getPreviousMonth(month)
      for (const target of targets) {
        try {
          const prev = await prisma.$queryRawUnsafe(`
            SELECT rate FROM "ExchangeRate"
            WHERE "baseCurrency" = $1 AND "targetCurrency" = $2 AND month = $3
            LIMIT 1
          `, base, target, prevMonth)

          if (prev.length > 0) {
            await prisma.$executeRawUnsafe(`
              INSERT INTO "ExchangeRate" (id, "baseCurrency", "targetCurrency", rate, month, source, "fetchedAt", "createdAt")
              VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'previous', NOW(), NOW())
              ON CONFLICT ("baseCurrency", "targetCurrency", month)
              DO UPDATE SET rate = $3, source = 'previous', "fetchedAt" = NOW()
              WHERE "ExchangeRate"."lockedAt" IS NULL
            `, base, target, Number(prev[0].rate), month)
            fetched++
            console.log(`[ExchangeRate] ${base}→${target} = ${prev[0].rate} (previous month fallback)`)
          } else {
            failed++
            console.error(`[ExchangeRate] No previous rate for ${base}→${target}`)
          }
        } catch (err) {
          failed++
          console.error(`[ExchangeRate] Fallback failed for ${base}→${target}:`, err.message)
        }
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

module.exports = {
  fetchMonthlyRates,
  getRate,
  getRatesForMonth,
  getRatesForProject,
  setManualRate,
  lockRate,
  fetchFromFrankfurter,
  fetchFromOpenExchangeRates,
}
