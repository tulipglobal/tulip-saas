// ─────────────────────────────────────────────────────────────
//  services/auditService.js — v4
//
//  Changes from v3:
//  ✔ Emits audit.created SIEM event after log creation
// ─────────────────────────────────────────────────────────────

const crypto  = require('crypto')
const prisma  = require('../lib/client')

function generateHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

async function createAuditLog({ action, entityType, entityId, userId, tenantId }) {
  const log = await prisma.auditLog.create({
    data: { action, entityType, entityId, userId, tenantId }
  })

  const payload = {
    id:         log.id,
    action:     log.action,
    entityType: log.entityType,
    entityId:   log.entityId,
    userId:     log.userId,
    tenantId:   log.tenantId,
    createdAt:  log.createdAt.toISOString(),
  }

  const dataHash = generateHash(payload)

  const updated = await prisma.auditLog.update({
    where: { id: log.id },
    data:  { dataHash }
  })

  // Dispatch webhook (non-blocking)
  try {
    const { dispatch } = require('./webhookService')
    dispatch(tenantId, 'audit.created', {
      id: updated.id, action: updated.action, entityType: updated.entityType,
      entityId: updated.entityId, userId: updated.userId, tenantId: updated.tenantId,
      dataHash: updated.dataHash, createdAt: updated.createdAt,
    }).catch(() => {})
  } catch (_) {}

  // Emit SIEM event (non-blocking)
  try {
    const { emit: siemEmit } = require('./siemService')
    siemEmit('audit.created', {
      auditId:    updated.id,
      action:     updated.action,
      entityType: updated.entityType,
      entityId:   updated.entityId,
      userId:     updated.userId,
      tenantId:   updated.tenantId,
      dataHash:   updated.dataHash,
    }).catch(() => {})
  } catch (_) {}

  return updated
}

module.exports = { createAuditLog, generateHash }
