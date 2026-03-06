// ─────────────────────────────────────────────────────────────
//  services/apiKeyService.js — v1
//
//  Stripe-style API key management:
//  ✔ Keys generated as: tl_live_{random32hex}
//  ✔ Only prefix stored in plaintext (for display)
//  ✔ Full key bcrypt-hashed before storage
//  ✔ Key returned ONCE at creation — never again
//  ✔ Scoped permissions per key
//  ✔ Expiry + revocation support
//  ✔ lastUsedAt updated on every authenticated request
// ─────────────────────────────────────────────────────────────

const crypto  = require('crypto')
const bcrypt  = require('bcryptjs')
const prisma  = require('../lib/client')

const KEY_PREFIX  = 'tl_live_'
const BCRYPT_SALT = 10

// ── Generate a new API key ────────────────────────────────────
async function createApiKey({ tenantId, createdBy, name, permissions, expiresAt }) {
  if (!name)        throw new Error('name is required')
  if (!tenantId)    throw new Error('tenantId is required')
  if (!createdBy)   throw new Error('createdBy (userId) is required')

  // Generate: tl_live_ + 32 random hex chars
  const secret  = KEY_PREFIX + crypto.randomBytes(16).toString('hex')
  const prefix  = secret.slice(0, 16)   // "tl_live_ab12cd34" — safe to display
  const keyHash = await bcrypt.hash(secret, BCRYPT_SALT)

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId,
      createdBy,
      name,
      prefix,
      keyHash,
      permissions: permissions || [],
      expiresAt:   expiresAt   || null,
    }
  })

  // Return the full secret ONCE — never stored, never retrievable again
  return {
    id:          apiKey.id,
    name:        apiKey.name,
    prefix:      apiKey.prefix,
    permissions: apiKey.permissions,
    expiresAt:   apiKey.expiresAt,
    createdAt:   apiKey.createdAt,
    key:         secret,   // ONLY returned here
    _notice:     'Store this key securely. It will not be shown again.'
  }
}

// ── Validate an incoming API key ──────────────────────────────
// Called from authenticate middleware when Authorization: ApiKey tl_live_...
async function validateApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null

  const prefix = rawKey.slice(0, 16)

  const apiKey = await prisma.apiKey.findUnique({
    where: { prefix }
  })

  if (!apiKey)              return null   // not found
  if (apiKey.revokedAt)     return null   // revoked
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null  // expired

  // Verify full key against stored hash
  const valid = await bcrypt.compare(rawKey, apiKey.keyHash)
  if (!valid) return null

  // Update lastUsedAt (non-blocking)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data:  { lastUsedAt: new Date() }
  }).catch(() => {})

  return apiKey
}

// ── List API keys for a tenant ────────────────────────────────
async function listApiKeys(tenantId) {
  return prisma.apiKey.findMany({
    where:   { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id:          true,
      name:        true,
      prefix:      true,
      permissions: true,
      lastUsedAt:  true,
      expiresAt:   true,
      revokedAt:   true,
      createdAt:   true,
      // never return keyHash
    }
  })
}

// ── Revoke an API key ─────────────────────────────────────────
async function revokeApiKey(keyId, tenantId) {
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, tenantId }
  })
  if (!key) throw new Error('API key not found')
  if (key.revokedAt) throw new Error('API key already revoked')

  return prisma.apiKey.update({
    where: { id: keyId },
    data:  { revokedAt: new Date() },
    select: { id:true, name:true, prefix:true, revokedAt:true }
  })
}

// ── Rotate an API key ─────────────────────────────────────────
// Revokes old key and creates new one with same settings
async function rotateApiKey(keyId, tenantId, createdBy) {
  const old = await prisma.apiKey.findFirst({
    where: { id: keyId, tenantId }
  })
  if (!old)          throw new Error('API key not found')
  if (old.revokedAt) throw new Error('Cannot rotate a revoked key')

  // Revoke old key
  await prisma.apiKey.update({
    where: { id: keyId },
    data:  { revokedAt: new Date() }
  })

  // Create new key with same settings
  return createApiKey({
    tenantId,
    createdBy,
    name:        `${old.name} (rotated)`,
    permissions: old.permissions,
    expiresAt:   old.expiresAt,
  })
}

module.exports = { createApiKey, validateApiKey, listApiKeys, revokeApiKey, rotateApiKey }
