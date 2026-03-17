// ─────────────────────────────────────────────────────────────
//  routes/adminAuthRoutes.js — Admin panel authentication
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/client')

// POST /api/admin-auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { adminId: admin.id, role: 'SYSTEM_ADMIN' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        preferredLanguage: admin.preferredLanguage,
        themePreference: admin.themePreference,
      },
    })
  } catch (err) {
    console.error('Admin login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Middleware to verify admin JWT
function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const token = authHeader.slice(7).trim()
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (decoded.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    req.admin = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// GET /api/admin-auth/me
router.get('/me', adminAuth, async (req, res) => {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.admin.adminId },
      select: { id: true, email: true, name: true, preferredLanguage: true, themePreference: true, createdAt: true },
    })
    if (!admin) return res.status(404).json({ error: 'Admin not found' })
    res.json(admin)
  } catch (err) {
    console.error('Admin me error:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PUT /api/admin-auth/profile
router.put('/profile', adminAuth, async (req, res) => {
  try {
    const { name, password, preferredLanguage, themePreference } = req.body
    const data = {}
    if (name) data.name = name
    if (preferredLanguage) data.preferredLanguage = preferredLanguage
    if (themePreference) data.themePreference = themePreference
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' })
      }
      data.password = await bcrypt.hash(password, 12)
    }

    const admin = await prisma.adminUser.update({
      where: { id: req.admin.adminId },
      data,
      select: { id: true, email: true, name: true, preferredLanguage: true, themePreference: true },
    })
    res.json(admin)
  } catch (err) {
    console.error('Admin profile update error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

module.exports = router
