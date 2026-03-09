// ─────────────────────────────────────────────────────────────
//  middleware/donorAuthenticate.js
//
//  JWT authentication for DonorUser tokens.
//  Populates req.donorUser with { donorUserId, donorId, role }
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.slice(7).trim()

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (decoded.role !== 'donor' || !decoded.donorUserId) {
      return res.status(401).json({ error: 'Invalid donor token' })
    }
    req.donorUser = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
