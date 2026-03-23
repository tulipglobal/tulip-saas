const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const { sendEmail } = require('../services/emailService')

// Admin auth check — accepts NGO superadmin or admin panel JWT
async function adminCheck(req, res, next) {
  if (req.user && req.user.role === 'SYSTEM_ADMIN') return next()
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { email: true } })
    if (user?.email === 'info@tulipglobal.org') return next()
  } catch {}
  return res.status(403).json({ error: 'Admin access required' })
}
router.use(adminCheck)

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

    // Send email notification to user when admin replies (skip internal notes)
    if (message && !isInternal && ticket.userId) {
      const ticketUser = await prisma.user.findUnique({ where: { id: ticket.userId }, select: { email: true } }).catch(() => null)
      if (ticketUser?.email) {
        const APP_URL = process.env.APP_URL || 'https://app.sealayer.io'
        const preview = message.length > 200 ? message.slice(0, 200) + '...' : message
        sendEmail({
          to: ticketUser.email,
          subject: `Reply on your ticket: ${ticket.subject}`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
              <div style="background: #0d9488; text-align: center; padding: 28px 0 20px; border-radius: 8px 8px 0 0;">
                <h1 style="color: #fff; font-size: 22px; margin: 0; font-weight: 700;">sealayer</h1>
              </div>
              <div style="padding: 24px;">
                <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">New reply on your ticket</h2>
                <div style="background: #f8fafc; border-left: 3px solid #0d9488; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
                  <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">${preview}</p>
                </div>
                <p style="text-align: center; margin: 24px 0;">
                  <a href="${APP_URL}/dashboard/support" style="display: inline-block; background: #0d9488; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View Full Reply</a>
                </p>
              </div>
            </div>
          `,
        }).catch(err => console.error('[email] ticket reply notification failed:', err.message))
      }
    }

    res.json(updated)
  } catch (err) {
    console.error('Admin update ticket error:', err)
    res.status(500).json({ error: 'Failed to update ticket' })
  }
})

module.exports = router
