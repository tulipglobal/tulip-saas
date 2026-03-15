// ─────────────────────────────────────────────────────────────
//  routes/userPreferenceRoutes.js — User preference endpoints
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// PUT /api/user/preferences/theme
router.put('/theme', async (req, res) => {
  try {
    const { theme } = req.body
    if (!theme || !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme. Must be light, dark, or system.' })
    }

    const userId = req.user.id
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "themePreference" = $1 WHERE id = $2`,
      theme,
      userId
    )

    res.json({ theme })
  } catch (err) {
    console.error('Failed to update theme preference:', err)
    res.status(500).json({ error: 'Failed to update theme preference' })
  }
})

module.exports = router
