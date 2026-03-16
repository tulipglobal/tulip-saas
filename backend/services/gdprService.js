// ─────────────────────────────────────────────────────────────
//  services/gdprService.js — v1
//
//  GDPR compliance for Tulip:
//  ✔ Data export  — full tenant data as JSON
//  ✔ Right to erasure — soft-delete user, anonymise audit trail
//  ✔ Consent logging — logged as AuditLog entries
//
//  IMPORTANT:
//  AuditLog rows are NEVER deleted — they are an immutable
//  blockchain-anchored record. On erasure, we anonymise the
//  userId reference only (set to null), preserving the audit
//  trail integrity while removing personal data linkage.
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')
const { createAuditLog } = require('./auditService')

// ── Data Export ───────────────────────────────────────────────
// Returns all data Tulip holds for a user as a JSON object.
// Required by GDPR Article 20 (data portability).
async function exportUserData(userId, tenantId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id:        true,
      email:     true,
      name:      true,
      tenantId:  true,
      createdAt: true,
      roles: {
        include: { role: { select: { name: true } } }
      }
    }
  })

  if (!user) throw new Error('User not found')

  const auditLogs = await prisma.auditLog.findMany({
    where:   { userId, tenantId },
    orderBy: { createdAt: 'asc' },
    select: {
      id:          true,
      action:      true,
      entityType:  true,
      entityId:    true,
      createdAt:   true,
      anchorStatus:true,
      blockchainTx:true,
      blockNumber: true,
    }
  })

  const documents = await prisma.document.findMany({
    where:   { uploadedById: userId, tenantId },
    select: {
      id:         true,
      name:       true,
      fileType:   true,
      uploadedAt: true,
    }
  })

  // Log the export event itself as an audit entry
  await createAuditLog({
    action:     'GDPR_DATA_EXPORT',
    entityType: 'User',
    entityId:   userId,
    userId,
    tenantId,
  })

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id:        user.id,
      email:     user.email,
      name:      user.name,
      tenantId:  user.tenantId,
      createdAt: user.createdAt,
      roles:     (user.UserRole || user.roles || []).map(r => (r.Role || r.role)?.name),
    },
    auditLogs,
    documents,
    _notice: 'AuditLog records are immutable blockchain-anchored entries and cannot be deleted under GDPR Article 17(3)(b) — legal obligation.'
  }
}

// ── Right to Erasure ──────────────────────────────────────────
// Soft-deletes the user and anonymises their AuditLog references.
// Required by GDPR Article 17.
// AuditLog rows are preserved (legal obligation) but userId is
// set to null, removing the personal data linkage.
async function eraseUser(userId, tenantId, requestedBy) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId }
  })

  if (!user) throw new Error('User not found')
  if (user.deletedAt) throw new Error('User already erased')

  await prisma.$transaction([
    // 1. Soft-delete the user
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email:     `erased-${userId}@deleted.invalid`,  // anonymise email (unique constraint)
        name:      '[Erased]',
        password:  '[ERASED]',
      }
    }),

    // 2. Remove role assignments
    prisma.userRole.deleteMany({
      where: { userId }
    }),

    // 3. Clear permission cache
    prisma.userPermissionCache.deleteMany({
      where: { userId }
    }),

    // 4. Anonymise AuditLog references (set userId to null)
    // Rows remain — blockchain anchors are immutable legal records
    prisma.auditLog.updateMany({
      where: { userId, tenantId },
      data:  { userId: null }
    }),
  ])

  // Log the erasure (by the requesting admin, not the erased user)
  await createAuditLog({
    action:     'GDPR_ERASURE',
    entityType: 'User',
    entityId:   userId,
    userId:     requestedBy,
    tenantId,
  })

  return {
    erased:    true,
    userId,
    erasedAt:  new Date().toISOString(),
    notice:    'User soft-deleted. AuditLog entries preserved with userId anonymised per GDPR Article 17(3)(b).'
  }
}

// ── Consent Logging ───────────────────────────────────────────
// Logs a consent event as an immutable AuditLog entry.
async function logConsent(userId, tenantId, consentType, granted) {
  return createAuditLog({
    action:     granted ? 'CONSENT_GIVEN' : 'CONSENT_WITHDRAWN',
    entityType: 'Consent',
    entityId:   consentType,   // e.g. 'marketing', 'analytics', 'data_processing'
    userId,
    tenantId,
  })
}

module.exports = { exportUserData, eraseUser, logConsent }
