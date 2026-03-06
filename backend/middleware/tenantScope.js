// ─────────────────────────────────────────────────────────────
//  middleware/tenantScope.js
//  Automatically injects req.tenantId from the JWT.
//  Must be used AFTER authenticate middleware.
//
//  Usage in app.js:
//    app.use('/api/projects', authenticate, tenantScope, projectRoutes)
// ─────────────────────────────────────────────────────────────

module.exports = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(403).json({ error: 'Tenant context missing' })
  }
  req.tenantId = req.user.tenantId
  next()
}
