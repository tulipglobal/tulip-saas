// ─────────────────────────────────────────────────────────────
//  services/exchangeRateSealService.js — Blockchain seal for monthly rates
//
//  Anchors monthly exchange rate snapshots to Polygon.
//  SHA-256 hashes canonical rate JSON, anchors via ethers,
//  stores txHash on ExchangeRate records.
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto')
const { ethers } = require('ethers')
const prisma = require('../lib/client')
const { uploadToS3, computeSHA256 } = require('../lib/s3Upload')
const logger = require('../lib/logger')

function getProvider() {
  try { return new ethers.JsonRpcProvider(process.env.POLYGON_RPC_PRIMARY || process.env.RPC_URL) }
  catch { return new ethers.JsonRpcProvider(process.env.POLYGON_RPC_FALLBACK) }
}

/**
 * Seal all exchange rates for a given month to blockchain.
 * @param {string} month - "YYYY-MM" format
 */
async function sealMonthlyRates(month) {
  if (!month) month = new Date().toISOString().slice(0, 7)

  logger.info(`[rate-seal] Sealing rates for ${month}`)

  // 1. Fetch all rates for the month
  const rates = await prisma.$queryRawUnsafe(`
    SELECT id, "baseCurrency", "targetCurrency", rate, source, "fetchedAt"
    FROM "ExchangeRate"
    WHERE month = $1 AND "sealTxHash" IS NULL
    ORDER BY "baseCurrency", "targetCurrency"
  `, month)

  if (rates.length === 0) {
    logger.info('[rate-seal] No unsealed rates for this month')
    return { sealed: 0 }
  }

  // 2. Build canonical JSON
  const canonical = rates.map(r => ({
    base: r.baseCurrency,
    target: r.targetCurrency,
    rate: Number(r.rate),
    source: r.source,
    fetchedAt: r.fetchedAt?.toISOString?.() || String(r.fetchedAt),
  }))
  const jsonStr = JSON.stringify({ month, rates: canonical, sealedAt: new Date().toISOString() })

  // 3. SHA-256 hash
  const hash = crypto.createHash('sha256').update(jsonStr).digest('hex')

  // 4. Anchor to Polygon
  const privateKey = process.env.ANCHOR_WALLET_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY
  if (!privateKey) {
    logger.warn('[rate-seal] No blockchain key configured — skipping anchor')
    return { sealed: 0, hash }
  }

  try {
    const provider = getProvider()
    const wallet = new ethers.Wallet(privateKey, provider)
    const anchorData = ethers.hexlify(ethers.toUtf8Bytes(`sealayer:exchange-rates:${month}:${hash}`))

    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0,
      data: anchorData,
    })

    const receipt = await tx.wait(1)
    const txHash = receipt.hash

    logger.info(`[rate-seal] Anchored ${rates.length} rates for ${month} — tx: ${txHash}`)

    // 5. Update all rates with txHash
    const rateIds = rates.map(r => r.id)
    await prisma.$executeRawUnsafe(`
      UPDATE "ExchangeRate"
      SET "sealTxHash" = $1, "sealedAt" = NOW()
      WHERE id = ANY($2::text[])
    `, txHash, rateIds)

    // 6. Upload snapshot to S3
    try {
      const buf = Buffer.from(jsonStr, 'utf-8')
      await uploadToS3(buf, `exchange-rates-${month}.json`, 'SYSTEM', 'rate-seals')
    } catch (s3Err) {
      logger.warn('[rate-seal] S3 upload failed (non-blocking):', s3Err.message)
    }

    return { sealed: rates.length, hash, txHash }
  } catch (err) {
    logger.error('[rate-seal] Blockchain anchor failed:', err.message)
    return { sealed: 0, hash, error: err.message }
  }
}

module.exports = { sealMonthlyRates }
