const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')

// All routes require auth
router.use(authenticate, tenantScope)

// POST /api/support/tickets
router.post('/tickets', async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body
    if (!subject || !description || !category) return res.status(400).json({ error: 'Subject, description and category are required' })
    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        subject,
        description,
        category,
        priority: priority || 'medium',
        messages: {
          create: { senderType: 'user', senderId: req.user.id, message: description }
        }
      },
      include: { messages: true }
    })
    res.status(201).json(ticket)
  } catch (err) {
    console.error('Create ticket error:', err)
    res.status(500).json({ error: 'Failed to create ticket' })
  }
})

// GET /api/support/tickets
router.get('/tickets', async (req, res) => {
  try {
    const where = {}
    if (req.user.tenantId) where.tenantId = req.user.tenantId
    if (req.user.donorOrgId) where.donorOrgId = req.user.donorOrgId
    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, where: { isInternal: false } } }
    })
    res.json(tickets)
  } catch (err) {
    console.error('List tickets error:', err)
    res.status(500).json({ error: 'Failed to fetch tickets' })
  }
})

// GET /api/support/tickets/:id
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } } }
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    // Verify ownership
    if (ticket.tenantId && ticket.tenantId !== req.user.tenantId) return res.status(403).json({ error: 'Access denied' })
    res.json(ticket)
  } catch (err) {
    console.error('Get ticket error:', err)
    res.status(500).json({ error: 'Failed to fetch ticket' })
  }
})

// POST /api/support/tickets/:id/messages
router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const message = req.body.message || req.body.content
    if (!message) return res.status(400).json({ error: 'Message is required' })
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    if (ticket.tenantId && ticket.tenantId !== req.user.tenantId) return res.status(403).json({ error: 'Access denied' })
    const msg = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, senderType: 'user', senderId: req.user.id, message }
    })
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } })
    res.status(201).json(msg)
  } catch (err) {
    console.error('Add message error:', err)
    res.status(500).json({ error: 'Failed to add message' })
  }
})

module.exports = router
