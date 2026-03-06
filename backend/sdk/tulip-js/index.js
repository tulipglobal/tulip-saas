// ─────────────────────────────────────────────────────────────
//  sdk/tulip-js/index.js — v1
//
//  Tulip Verification SDK (JavaScript/Node.js)
//  For external auditors and third-party integrations.
//
//  Usage:
//    const { TulipClient } = require('./sdk/tulip-js')
//    const tulip = new TulipClient('https://your-tulip-instance.com')
//
//    // Verify a single record
//    const result = await tulip.verify('sha256hashhere')
//    console.log(result.verified)   // true/false
//
//    // Verify a batch
//    const batch = await tulip.verifyBatch('batchIdHere')
//    console.log(batch.chainIntact) // true/false
//
//    // With authentication (for protected endpoints)
//    await tulip.login('admin@org.com', 'password')
//    const projects = await tulip.get('/api/projects')
// ─────────────────────────────────────────────────────────────

class TulipClient {
  constructor(baseUrl) {
    if (!baseUrl) throw new Error('TulipClient requires a baseUrl')
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token   = null
  }

  // ── Authentication ────────────────────────────────────────
  async login(email, password) {
    const res = await this._fetch('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    })
    if (!res.token) throw new Error('Login failed')
    this.token = res.token
    return res
  }

  logout() {
    this.token = null
  }

  // ── Public verification (no auth required) ────────────────

  /**
   * Verify an audit log entry by its SHA-256 hash.
   * @param {string} dataHash - 64-char hex SHA-256 hash
   * @returns {VerifyResult}
   */
  async verify(dataHash) {
    if (!dataHash || dataHash.length !== 64) {
      throw new Error('dataHash must be a 64-character hex string')
    }
    return this._fetch(`/api/verify/${dataHash}`, { auth: false })
  }

  /**
   * Verify all entries in an anchor batch.
   * @param {string} batchId - Merkle root used as batch identifier
   * @returns {BatchVerifyResult}
   */
  async verifyBatch(batchId) {
    if (!batchId) throw new Error('batchId is required')
    return this._fetch(`/api/verify/batch/${batchId}`, { auth: false })
  }

  // ── Convenience helpers ───────────────────────────────────

  /**
   * Check if a specific audit record is fully verified.
   * Returns true only if: hashIntact + chainIntact + onChainConfirmed
   * @param {string} dataHash
   * @returns {boolean}
   */
  async isVerified(dataHash) {
    const result = await this.verify(dataHash)
    return result.verified === true
  }

  /**
   * Get full health status of the Tulip instance.
   * @returns {HealthResult}
   */
  async health() {
    return this._fetch('/api/health', { auth: false })
  }

  // ── Generic authenticated request ─────────────────────────
  async get(path)              { return this._fetch(path) }
  async post(path, body)       { return this._fetch(path, { method: 'POST', body: JSON.stringify(body) }) }
  async put(path, body)        { return this._fetch(path, { method: 'PUT',  body: JSON.stringify(body) }) }
  async delete(path)           { return this._fetch(path, { method: 'DELETE' }) }

  // ── Internal fetch wrapper ────────────────────────────────
  async _fetch(path, options = {}) {
    const { auth = true, method = 'GET', body, headers = {} } = options

    const reqHeaders = { 'Content-Type': 'application/json', ...headers }
    if (auth && this.token) {
      reqHeaders['Authorization'] = `Bearer ${this.token}`
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: reqHeaders,
      body,
    })

    const data = await res.json()

    if (!res.ok && res.status !== 200) {
      const err = new Error(data.error || `HTTP ${res.status}`)
      err.status   = res.status
      err.response = data
      throw err
    }

    return data
  }
}

// ── Type definitions (JSDoc) ──────────────────────────────────
/**
 * @typedef {Object} VerifyResult
 * @property {boolean} verified
 * @property {string}  dataHash
 * @property {string}  batchId
 * @property {string}  entityType
 * @property {string}  entityId
 * @property {string}  action
 * @property {string}  recordedAt
 * @property {{ hashIntact: boolean, chainIntact: boolean }} integrity
 * @property {{ onChainConfirmed: boolean, txHash: string, blockNumber: number }} blockchain
 */

/**
 * @typedef {Object} BatchVerifyResult
 * @property {boolean} verified
 * @property {string}  batchId
 * @property {number}  recordCount
 * @property {boolean} chainIntact
 * @property {string}  anchorStatus
 * @property {Array}   records
 */

module.exports = { TulipClient }
