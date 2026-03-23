const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { sendEmail } = require('../services/emailService')

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
    // Send confirmation email (non-blocking)
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true, name: true } }).catch(() => null)
    if (user?.email) {
      const APP_URL = process.env.APP_URL || 'https://app.sealayer.io'
      sendEmail({
        to: user.email,
        subject: `Support ticket received: ${subject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="background: #0d9488; text-align: center; padding: 28px 0 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; font-size: 22px; margin: 0; font-weight: 700;">sealayer</h1>
            </div>
            <div style="padding: 24px;">
              <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">We've received your request</h2>
              <p style="color: #475569; font-size: 14px;">Your support ticket has been created. Our team will get back to you shortly.</p>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;"><strong>Subject:</strong> ${subject}</p>
                <p style="color: #64748b; font-size: 13px; margin: 0;"><strong>Category:</strong> ${category}</p>
              </div>
              <p style="text-align: center; margin: 24px 0;">
                <a href="${APP_URL}/dashboard/support" style="display: inline-block; background: #0d9488; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View Ticket</a>
              </p>
            </div>
          </div>
        `,
      }).catch(err => console.error('[email] ticket confirmation failed:', err.message))
    }

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
