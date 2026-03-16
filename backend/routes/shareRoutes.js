// ─────────────────────────────────────────────────────────────
//  routes/shareRoutes.js — Donor share link management
//
//  Authenticated donor routes for creating, listing, and
//  revoking shareable read-only project links.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const prisma = require('../lib/client')

const JWT_SECRET = process.env.JWT_SECRET
const DONOR_APP_URL = process.env.DONOR_APP_URL || 'https://donor.sealayer.io'

// ── Donor JWT middleware ──────────────────────────────────────
function donorAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = authHeader.slice(7).trim()
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.role !== 'DONOR' || !decoded.donorMemberId) {
      return res.status(401).json({ error: 'Invalid donor token' })
    }
    req.donor = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── POST /api/donor/share — create share link ────────────────
router.post('/', donorAuth, async (req, res) => {
  try {
    const { donorOrgId, donorMemberId } = req.donor
    const { projectId, expiresInDays } = req.body

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }

    // Verify donor has access to this project
    const access = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "DonorProjectAccess"
       WHERE "donorOrgId" = $1 AND "projectId" = $2
       LIMIT 1`,
      donorOrgId, projectId
    )
    if (!access.length) {
      return res.status(403).json({ error: 'No access to this project' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const days = expiresInDays || 30
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    const [link] = await prisma.$queryRawUnsafe(
      `INSERT INTO "ShareLink" (id, token, "projectId", "donorOrgId", "donorMemberId", "expiresAt", "expiryDays", "viewCount", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, NOW())
       RETURNING id, token, "expiresAt", "createdAt"`,
      token, projectId, donorOrgId, donorMemberId, expiresAt, days
    )

    res.status(201).json({
      id: link.id,
      token: link.token,
      url: `${DONOR_APP_URL}/share/${link.token}`,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    })
  } catch (err) {
    console.error('Create share link error:', err)
    res.status(500).json({ error: 'Failed to create share link' })
  }
})

// ── GET /api/donor/share — list share links for donor org ────
router.get('/', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor

    const links = await prisma.$queryRawUnsafe(
      `SELECT sl.id, sl.token, sl."projectId", sl."expiresAt", sl."viewCount",
              sl."isRevoked", sl."createdAt", p.name as "projectName"
       FROM "ShareLink" sl
       LEFT JOIN "Project" p ON p.id = sl."projectId"
       WHERE sl."donorOrgId" = $1 AND (sl."isRevoked" = false OR sl."isRevoked" IS NULL)
       ORDER BY sl."createdAt" DESC`,
      donorOrgId
    )

    res.json({
      links: links.map(l => ({
        ...l,
        url: `${DONOR_APP_URL}/share/${l.token}`,
        viewCount: Number(l.viewCount || 0),
      })),
    })
  } catch (err) {
    console.error('List share links error:', err)
    res.status(500).json({ error: 'Failed to list share links' })
  }
})

// ── GET /api/donor/share/project/:projectId — links for a specific project
router.get('/project/:projectId', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId } = req.params

    const links = await prisma.$queryRawUnsafe(
      `SELECT id, token, "expiresAt", "viewCount", "isRevoked", "createdAt"
       FROM "ShareLink"
       WHERE "donorOrgId" = $1 AND "projectId" = $2 AND ("isRevoked" = false OR "isRevoked" IS NULL)
       ORDER BY "createdAt" DESC`,
      donorOrgId, projectId
    )

    res.json({
      links: links.map(l => ({
        ...l,
        url: `${DONOR_APP_URL}/share/${l.token}`,
        viewCount: Number(l.viewCount || 0),
      })),
    })
  } catch (err) {
    console.error('List project share links error:', err)
    res.status(500).json({ error: 'Failed to list share links' })
  }
})

// ── DELETE /api/donor/share/:id — revoke a share link ────────
router.delete('/:id', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { id } = req.params

    const result = await prisma.$executeRawUnsafe(
      `UPDATE "ShareLink"
       SET "isRevoked" = true, "revokedAt" = NOW()
       WHERE id = $1 AND "donorOrgId" = $2`,
      id, donorOrgId
    )

    if (result === 0) {
      return res.status(404).json({ error: 'Share link not found' })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Revoke share link error:', err)
    res.status(500).json({ error: 'Failed to revoke share link' })
  }
})

module.exports = router
