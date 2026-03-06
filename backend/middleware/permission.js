// ─────────────────────────────────────────────────────────────
//  middleware/permission.js — v3
//
//  Changes from v2:
//  ✔ Emits permission.denied SIEM event on 403
// ─────────────────────────────────────────────────────────────

const prisma  = require('../lib/client')
const { buildCache }    = require('../services/permissionCacheService')
const { emit: siemEmit } = require('../services/siemService')

async function loadPermissions(userId, tenantId) {
  const cached = await prisma.userPermissionCache.findUnique({
    where: { userId_tenantId: { userId, tenantId } }
  })
  if (cached) return new Set(cached.permissions)
  const permissions = await buildCache(userId, tenantId)
  return new Set(permissions)
}

const can = (requiredPermission) => async (req, res, next) => {
  try {
    const { userId, tenantId } = req.user
    if (!userId || !tenantId) return res.status(403).json({ error: 'Missing user or tenant context' })

    if (!req._permissions) {
      req._permissions = await loadPermissions(userId, tenantId)
    }

    if (!req._permissions.has(requiredPermission)) {
      // SIEM — permission denied
      siemEmit('permission.denied', {
        userId, tenantId,
        required:   requiredPermission,
        path:       req.path,
        method:     req.method,
        authMethod: req.user.authMethod,
      }, req).catch(() => {})

      return res.status(403).json({
        error:    'Forbidden',
        required: requiredPermission,
        message:  `You need the '${requiredPermission}' permission to perform this action`
      })
    }
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Permission check failed' })
  }
}

const canAny = (...requiredPermissions) => async (req, res, next) => {
  try {
    const { userId, tenantId } = req.user
    if (!req._permissions) req._permissions = await loadPermissions(userId, tenantId)
    const hasAny = requiredPermissions.some(p => req._permissions.has(p))
    if (!hasAny) {
      siemEmit('permission.denied', { userId, tenantId, required: requiredPermissions }, req).catch(() => {})
      return res.status(403).json({ error: 'Forbidden', required: requiredPermissions })
    }
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Permission check failed' })
  }
}

const canAll = (...requiredPermissions) => async (req, res, next) => {
  try {
    const { userId, tenantId } = req.user
    if (!req._permissions) req._permissions = await loadPermissions(userId, tenantId)
    const missing = requiredPermissions.filter(p => !req._permissions.has(p))
    if (missing.length > 0) {
      siemEmit('permission.denied', { userId, tenantId, required: missing }, req).catch(() => {})
      return res.status(403).json({ error: 'Forbidden', missing })
    }
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Permission check failed' })
  }
}

module.exports = { can, canAny, canAll }
