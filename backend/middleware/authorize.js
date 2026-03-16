const prisma = require('../prisma/client')

module.exports = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userRoles = await prisma.userRole.findMany({
        where: { userId: req.user.userId },
        include: { Role: true }
      })

      const roleNames = userRoles.map(ur => ur.Role.name)

      const hasRole = allowedRoles.some(role =>
        roleNames.includes(role)
      )

      if (!hasRole) {
        return res.status(403).json({ error: 'Forbidden — insufficient role' })
      }

      next()

    } catch (err) {
      res.status(500).json({ error: 'Authorization check failed' })
    }
  }
}
