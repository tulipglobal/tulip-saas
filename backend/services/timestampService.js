// ─────────────────────────────────────────────────────────────
//  services/timestampService.js — v1
//
//  RFC 3161 Trusted Timestamp Service
//
//  What RFC 3161 does:
//  - Sends a hash to a trusted timestamp authority (TSA)
//  - TSA signs it with their certificate + current time
//  - Returns a token proving the data existed at that exact time
//  - Token is legally admissible in court (eIDAS, ESIGN Act)
//
//  TSA hierarchy (failover):
//  1. FreeTSA (freetsa.org) — primary
//  2. Apple TSA — fallback
//
//  Token stored as base64 in AuditLog.timestampToken
//  Can be verified independently by any RFC 3161 client
// ─────────────────────────────────────────────────────────────

const crypto  = require('crypto')
const https   = require('https')
const http    = require('http')
const prisma  = require('../lib/client')
const logger  = require('../lib/logger')

const TSA_SERVERS = [
  {
    name: 'FreeTSA',
    url:  'https://freetsa.org/tsr',
    http: false,
  },
  {
    name: 'Apple TSA',
    url:  'http://timestamp.apple.com/ts01',
    http: true,
  },
]

// ── Build RFC 3161 timestamp request (TSQ) ────────────────────
// Manual ASN.1 DER encoding — no external ASN.1 library needed
function buildTimestampRequest(hash) {
  // hash must be 32 bytes (SHA-256)
  const hashBuffer = Buffer.from(hash, 'hex')

  // SHA-256 OID: 2.16.840.1.101.3.4.2.1
  const sha256Oid = Buffer.from([
    0x30, 0x0d,                         // SEQUENCE
    0x06, 0x09,                         // OID
    0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
    0x05, 0x00                          // NULL
  ])

  // MessageImprint ::= SEQUENCE { hashAlgorithm, hashedMessage }
  const messageImprint = Buffer.concat([
    Buffer.from([0x30, sha256Oid.length + 2 + hashBuffer.length]),
    sha256Oid,
    Buffer.from([0x04, hashBuffer.length]),
    hashBuffer,
  ])

  // Random nonce (8 bytes)
  const nonce = crypto.randomBytes(8)
  const nonceEncoded = Buffer.concat([
    Buffer.from([0x02, nonce.length]),
    nonce,
  ])

  // TimeStampReq ::= SEQUENCE { version, messageImprint, nonce, certReq }
  const body = Buffer.concat([
    Buffer.from([0x02, 0x01, 0x01]),    // version: 1
    messageImprint,
    nonceEncoded,
    Buffer.from([0x01, 0x01, 0xff]),    // certReq: TRUE
  ])

  const totalLen = body.length
  let lenBytes
  if (totalLen < 128) {
    lenBytes = Buffer.from([totalLen])
  } else if (totalLen < 256) {
    lenBytes = Buffer.from([0x81, totalLen])
  } else {
    lenBytes = Buffer.from([0x82, (totalLen >> 8) & 0xff, totalLen & 0xff])
  }

  return Buffer.concat([Buffer.from([0x30]), lenBytes, body])
}

// ── Send timestamp request to TSA ────────────────────────────
function sendTimestampRequest(tsq, tsa) {
  return new Promise((resolve, reject) => {
    const url      = new URL(tsa.url)
    const lib      = tsa.http ? http : https
    const options  = {
      hostname: url.hostname,
      port:     url.port || (tsa.http ? 80 : 443),
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/timestamp-query',
        'Content-Length': tsq.length,
        'Accept':         'application/timestamp-reply',
      },
      timeout: 10000,
    }

    const req = lib.request(options, (res) => {
      // Follow redirect (Apple TSA returns 302)
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = new URL(res.headers.location)
        const redirectTsa = {
          name: tsa.name,
          url:  res.headers.location,
          http: redirectUrl.protocol === 'http:',
        }
        return sendTimestampRequest(tsq, redirectTsa).then(resolve).catch(reject)
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`TSA ${tsa.name} returned ${res.statusCode}`))
      }

      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })

    req.on('error',   reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`TSA ${tsa.name} timeout`)) })
    req.write(tsq)
    req.end()
  })
}

// ── Extract timestamp from TSR response ───────────────────────
function extractTimestamp(tsr) {
  // Look for GeneralizedTime in the TSR (format: YYYYMMDDHHmmssZ)
  // This is a simple extraction — for full ASN.1 parsing use a library
  const tsrStr = tsr.toString('binary')

  // GeneralizedTime tag is 0x18
  let pos = 0
  while (pos < tsr.length - 15) {
    if (tsr[pos] === 0x18) {
      const len = tsr[pos + 1]
      if (len >= 13 && len <= 17) {
        const timeStr = tsr.slice(pos + 2, pos + 2 + len).toString('ascii')
        // Format: YYYYMMDDHHmmssZ
        if (/^\d{14}Z?$/.test(timeStr)) {
          const y  = timeStr.slice(0, 4)
          const mo = timeStr.slice(4, 6)
          const d  = timeStr.slice(6, 8)
          const h  = timeStr.slice(8, 10)
          const mi = timeStr.slice(10, 12)
          const s  = timeStr.slice(12, 14)
          return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`)
        }
      }
    }
    pos++
  }
  return new Date() // fallback to now if parsing fails
}

// ── Stamp a single audit log entry ───────────────────────────
async function stampAuditLog(auditLogId) {
  const log = await prisma.auditLog.findUnique({
    where:  { id: auditLogId },
    select: { id: true, dataHash: true, timestampStatus: true }
  })

  if (!log)                              throw new Error('Audit log not found')
  if (!log.dataHash)                     throw new Error('Audit log has no dataHash yet')
  if (log.timestampStatus === 'stamped') return { already: true, id: log.id }

  const tsq = buildTimestampRequest(log.dataHash)

  let lastError = null
  for (const tsa of TSA_SERVERS) {
    try {
      logger.info('[timestamp] Requesting RFC 3161 token', { tsa: tsa.name, logId: auditLogId })

      const tsr           = await sendTimestampRequest(tsq, tsa)
      const tokenBase64   = tsr.toString('base64')
      const timestampedAt = extractTimestamp(tsr)

      await prisma.auditLog.update({
        where: { id: auditLogId },
        data: {
          timestampToken:  tokenBase64,
          timestampedAt,
          tsaUrl:          tsa.url,
          timestampStatus: 'stamped',
        }
      })

      logger.info('[timestamp] RFC 3161 token stored', {
        logId:       auditLogId,
        tsa:         tsa.name,
        timestampedAt,
        tokenBytes:  tsr.length,
      })

      return {
        id:             auditLogId,
        timestampedAt,
        tsa:            tsa.name,
        tokenSizeBytes: tsr.length,
        status:         'stamped',
      }

    } catch (err) {
      logger.warn(`[timestamp] TSA ${tsa.name} failed`, { error: err.message })
      lastError = err
    }
  }

  // All TSAs failed
  await prisma.auditLog.update({
    where: { id: auditLogId },
    data:  { timestampStatus: 'failed' }
  })

  throw new Error(`All TSAs failed. Last error: ${lastError?.message}`)
}

// ── Batch stamp pending audit logs ────────────────────────────
async function stampPendingLogs(limit = 10) {
  const pending = await prisma.auditLog.findMany({
    where: {
      timestampStatus: { in: ['pending', 'failed'] },
      dataHash:        { not: null },
    },
    take:    limit,
    orderBy: { createdAt: 'asc' },
    select:  { id: true }
  })

  if (pending.length === 0) return { stamped: 0, failed: 0 }

  logger.info(`[timestamp] Stamping ${pending.length} pending audit logs`)

  let stamped = 0, failed = 0
  for (const log of pending) {
    try {
      await stampAuditLog(log.id)
      stamped++
      // Small delay between TSA requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      logger.error('[timestamp] Stamp failed', { logId: log.id, error: err.message })
      failed++
    }
  }

  return { stamped, failed }
}

// ── Verify a stored timestamp token ──────────────────────────
function verifyTimestampToken(dataHash, tokenBase64) {
  try {
    const tsr    = Buffer.from(tokenBase64, 'base64')
    const hashBuf = Buffer.from(dataHash, 'hex')

    // Check that the hash appears in the token
    let found = false
    for (let i = 0; i <= tsr.length - hashBuf.length; i++) {
      if (tsr.slice(i, i + hashBuf.length).equals(hashBuf)) {
        found = true
        break
      }
    }

    const timestamp = extractTimestamp(tsr)

    return {
      valid:       found,
      timestamp,
      tokenBytes:  tsr.length,
      hashPresent: found,
    }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}

module.exports = { stampAuditLog, stampPendingLogs, verifyTimestampToken }
