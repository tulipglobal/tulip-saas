// ─────────────────────────────────────────────────────────────
//  routes/messengerRoutes.js — Messenger REST routes
//  Both donor and NGO conversation endpoints
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const multer = require('multer')
const { uploadToS3 } = require('../lib/s3Upload')

const JWT_SECRET = process.env.JWT_SECRET
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
}).single('file')

// ── Donor auth helper ────────────────────────────────────────
function donorAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    if (!payload.donorOrgId) return res.status(401).json({ error: 'Not a donor token' })
    req.donor = payload
    next()
  } catch { return res.status(401).json({ error: 'Invalid token' }) }
}

// ═══════════════════════════════════════════════════════════════
//  DONOR CONVERSATION ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/messenger/donor/conversations
router.get('/donor/conversations', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor

    // Get or create conversations for this donor org
    const conversations = await prisma.$queryRawUnsafe(`
      SELECT c.*,
        t.name as "tenantName",
        (SELECT COUNT(*)::int FROM "Message" m
         WHERE m."conversationId" = c.id AND m."isRead" = false AND m."senderType" = 'NGO') as "unreadCount"
      FROM "Conversation" c
      LEFT JOIN "Tenant" t ON t.id = c."tenantId"
      WHERE c."donorOrgId" = $1
      ORDER BY c."lastMessageAt" DESC NULLS LAST
    `, donorOrgId)

    // Get last 30 messages for each conversation
    const result = []
    for (const conv of conversations) {
      const messages = await prisma.$queryRawUnsafe(`
        SELECT * FROM "Message"
        WHERE "conversationId" = $1::uuid AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        ORDER BY "createdAt" DESC LIMIT 30
      `, conv.id)
      result.push({ ...conv, messages: messages.reverse() })
    }

    res.json({ conversations: result })
  } catch (err) {
    console.error('Donor get conversations error:', err)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// GET /api/messenger/donor/conversations/:id/messages
router.get('/donor/conversations/:id/messages', donorAuth, async (req, res) => {
  try {
    const { id } = req.params
    const before = req.query.before
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)

    // Verify donor has access to this conversation
    const conv = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Conversation" WHERE id = $1::uuid AND "donorOrgId" = $2`, id, req.donor.donorOrgId
    )
    if (!conv.length) return res.status(403).json({ error: 'Not your conversation' })

    let query = `
      SELECT * FROM "Message"
      WHERE "conversationId" = $1::uuid AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    `
    const params = [id]

    if (before) {
      query += ` AND "createdAt" < (SELECT "createdAt" FROM "Message" WHERE id = $${params.length + 1}::uuid)`
      params.push(before)
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const messages = await prisma.$queryRawUnsafe(query, ...params)
    res.json({ messages: messages.reverse() })
  } catch (err) {
    console.error('Donor get messages error:', err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// POST /api/messenger/donor/conversations/file
router.post('/donor/conversations/file', donorAuth, uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const { fileUrl, key } = await uploadToS3(req.file.buffer, req.file.originalname, `chat/${req.donor.donorOrgId}`)
    res.json({ fileUrl, fileName: req.file.originalname, fileSize: req.file.size })
  } catch (err) {
    console.error('Donor file upload error:', err)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

// POST /api/messenger/donor/conversations/ensure — get or create conversation
router.post('/donor/conversations/ensure', donorAuth, async (req, res) => {
  try {
    const { tenantId } = req.body
    const { donorOrgId } = req.donor
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' })

    // Upsert conversation
    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "Conversation" ("tenantId", "donorOrgId")
      VALUES ($1, $2)
      ON CONFLICT ("tenantId", "donorOrgId") DO UPDATE SET "updatedAt" = NOW()
      RETURNING *
    `, tenantId, donorOrgId)

    res.json({ conversation: rows[0] })
  } catch (err) {
    console.error('Ensure conversation error:', err)
    res.status(500).json({ error: 'Failed to ensure conversation' })
  }
})

// ═══════════════════════════════════════════════════════════════
//  NGO CONVERSATION ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/messenger/ngo/conversations
router.get('/ngo/conversations', authenticate, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.tenantId

    const conversations = await prisma.$queryRawUnsafe(`
      SELECT c.*,
        dorg.name as "donorOrgName",
        (SELECT COUNT(*)::int FROM "Message" m
         WHERE m."conversationId" = c.id AND m."isRead" = false AND m."senderType" = 'DONOR') as "unreadCount"
      FROM "Conversation" c
      LEFT JOIN "DonorOrganisation" dorg ON dorg.id = c."donorOrgId"
      WHERE c."tenantId" = $1
      ORDER BY c."lastMessageAt" DESC NULLS LAST
    `, tenantId)

    const result = []
    for (const conv of conversations) {
      const messages = await prisma.$queryRawUnsafe(`
        SELECT * FROM "Message"
        WHERE "conversationId" = $1::uuid AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        ORDER BY "createdAt" DESC LIMIT 30
      `, conv.id)
      result.push({ ...conv, messages: messages.reverse() })
    }

    res.json({ conversations: result })
  } catch (err) {
    console.error('NGO get conversations error:', err)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// GET /api/messenger/ngo/conversations/:id/messages
router.get('/ngo/conversations/:id/messages', authenticate, tenantScope, async (req, res) => {
  try {
    const { id } = req.params
    const before = req.query.before
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)

    const conv = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Conversation" WHERE id = $1::uuid AND "tenantId" = $2`, id, req.user.tenantId
    )
    if (!conv.length) return res.status(403).json({ error: 'Not your conversation' })

    let query = `
      SELECT * FROM "Message"
      WHERE "conversationId" = $1::uuid AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    `
    const params = [id]

    if (before) {
      query += ` AND "createdAt" < (SELECT "createdAt" FROM "Message" WHERE id = $${params.length + 1}::uuid)`
      params.push(before)
    }

    query += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const messages = await prisma.$queryRawUnsafe(query, ...params)
    res.json({ messages: messages.reverse() })
  } catch (err) {
    console.error('NGO get messages error:', err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// POST /api/messenger/ngo/conversations/file
router.post('/ngo/conversations/file', authenticate, tenantScope, uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const { fileUrl } = await uploadToS3(req.file.buffer, req.file.originalname, `chat/${req.user.tenantId}`)
    res.json({ fileUrl, fileName: req.file.originalname, fileSize: req.file.size })
  } catch (err) {
    console.error('NGO file upload error:', err)
    res.status(500).json({ error: 'Failed to upload file' })
  }
})

// POST /api/messenger/ngo/conversations/ensure
router.post('/ngo/conversations/ensure', authenticate, tenantScope, async (req, res) => {
  try {
    const { donorOrgId } = req.body
    const tenantId = req.user.tenantId
    if (!donorOrgId) return res.status(400).json({ error: 'donorOrgId required' })

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "Conversation" ("tenantId", "donorOrgId")
      VALUES ($1, $2)
      ON CONFLICT ("tenantId", "donorOrgId") DO UPDATE SET "updatedAt" = NOW()
      RETURNING *
    `, tenantId, donorOrgId)

    res.json({ conversation: rows[0] })
  } catch (err) {
    console.error('NGO ensure conversation error:', err)
    res.status(500).json({ error: 'Failed to ensure conversation' })
  }
})

// GET /api/messenger/ngo/unread-count
router.get('/ngo/unread-count', authenticate, tenantScope, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(sub.cnt), 0)::int as total FROM (
        SELECT COUNT(*) as cnt FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE c."tenantId" = $1 AND m."isRead" = false AND m."senderType" = 'DONOR'
      ) sub
    `, req.user.tenantId)
    res.json({ count: rows[0]?.total || 0 })
  } catch (err) {
    res.json({ count: 0 })
  }
})

// GET /api/messenger/donor/unread-count
router.get('/donor/unread-count', donorAuth, async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(sub.cnt), 0)::int as total FROM (
        SELECT COUNT(*) as cnt FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE c."donorOrgId" = $1 AND m."isRead" = false AND m."senderType" = 'NGO'
      ) sub
    `, req.donor.donorOrgId)
    res.json({ count: rows[0]?.total || 0 })
  } catch (err) {
    res.json({ count: 0 })
  }
})

// GET /api/messenger/online-users — returns online user IDs for a tenant
router.get('/online-users', donorAuth, async (req, res) => {
  try {
    const { getOnlineUsers } = require('../lib/socketio')
    const online = getOnlineUsers()
    const users = []
    for (const [userId, data] of online) {
      // Return users that match any tenant the donor has access to
      users.push({ userId, userType: data.userType, tenantId: data.tenantId, donorOrgId: data.donorOrgId })
    }
    res.json({ onlineUsers: users })
  } catch (err) {
    res.json({ onlineUsers: [] })
  }
})

// GET /api/messenger/ngo/online-users — returns online users for NGO's tenant
router.get('/ngo/online-users', authenticate, tenantScope, async (req, res) => {
  try {
    const { getOnlineUsers } = require('../lib/socketio')
    const online = getOnlineUsers()
    const users = []
    for (const [userId, data] of online) {
      if (data.tenantId === req.user.tenantId || data.donorOrgId) {
        users.push({ userId, userType: data.userType, tenantId: data.tenantId, donorOrgId: data.donorOrgId })
      }
    }
    res.json({ onlineUsers: users })
  } catch (err) {
    res.json({ onlineUsers: [] })
  }
})

module.exports = router
