const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// GET /api/admin/support/tickets — all tickets
router.get('/tickets', async (req, res) => {
  try {
    const { status, priority, category } = req.query
    const where = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category
    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
    })
    res.json(tickets)
  } catch (err) {
    console.error('Admin tickets error:', err)
    res.status(500).json({ error: 'Failed to fetch tickets' })
  }
})

// GET /api/admin/support/tickets/:id — single ticket with all messages
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    res.json(ticket)
  } catch (err) {
    console.error('Admin get ticket error:', err)
    res.status(500).json({ error: 'Failed to fetch ticket' })
  }
})

// PATCH /api/admin/support/tickets/:id — update ticket (status, assign, reply, internal note)
router.patch('/tickets/:id', async (req, res) => {
  try {
    const { status, assignedTo, message, isInternal, priority } = req.body
    const data = {}
    if (status) data.status = status
    if (assignedTo !== undefined) data.assignedTo = assignedTo
    if (priority) data.priority = priority
    const ticket = await prisma.supportTicket.update({ where: { id: req.params.id }, data })
    if (message) {
      await prisma.ticketMessage.create({
        data: { ticketId: ticket.id, senderType: 'admin', senderId: req.user?.id || 'admin', message, isInternal: isInternal || false }
      })
    }
    const updated = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    })
    res.json(updated)
  } catch (err) {
    console.error('Admin update ticket error:', err)
    res.status(500).json({ error: 'Failed to update ticket' })
  }
})

module.exports = router
