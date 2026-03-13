// ─────────────────────────────────────────────────────────────
//  routes/webhookRoutes.js — v2
//
//  Changes from v1:
//  ✔ Fixed permissions: tenant:admin → webhooks:read / webhooks:write
//  ✔ Paginated deliveries list
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const prisma  = require('../lib/client')
const crypto  = require('crypto')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

// GET /api/webhooks
router.get('/', can('webhooks:read'), async (req, res) => {
  try {
    const { page, limit, skip, take } = parsePagination(req)
    const where = { tenantId: req.tenantId }

    const [webhooks, total] = await Promise.all([
      prisma.webhook.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: { id: true, url: true, events: true, active: true, createdAt: true }
      }),
      prisma.webhook.count({ where })
    ])
    res.json(paginatedResponse(webhooks, total, page, limit))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/webhooks
router.post('/', can('webhooks:write'), async (req, res) => {
  try {
    const { url, events } = req.body
    if (!url)    return res.status(400).json({ error: 'url is required' })
    if (!events) return res.status(400).json({ error: 'events array is required' })

    const secret  = crypto.randomBytes(32).toString('hex')
    const webhook = await prisma.webhook.create({
      data: { url, events, secret, tenantId: req.tenantId, active: true }
    })
    res.status(201).json({ ...webhook, secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/webhooks/:id
router.put('/:id', can('webhooks:write'), async (req, res) => {
  try {
    const existing = await prisma.webhook.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) return res.status(404).json({ error: 'Webhook not found' })

    const { url, events, active } = req.body
    const webhook = await prisma.webhook.update({
      where: { id: req.params.id },
      data: {
        ...(url    !== undefined && { url }),
        ...(events !== undefined && { events }),
        ...(active !== undefined && { active }),
      }
    })
    res.json(webhook)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/webhooks/:id
router.delete('/:id', can('webhooks:write'), async (req, res) => {
  try {
    const existing = await prisma.webhook.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!existing) return res.status(404).json({ error: 'Webhook not found' })
    await prisma.webhook.delete({ where: { id: req.params.id } })
    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/webhooks/:id/test
router.post('/:id/test', can('webhooks:write'), async (req, res) => {
  try {
    const webhook = await prisma.webhook.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' })

    const { dispatch } = require('../services/webhookService')
    await dispatch(req.tenantId, 'webhook.test', {
      message: 'Test event from Tulip',
      webhookId: webhook.id,
      timestamp: new Date().toISOString(),
    })
    res.json({ sent: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/webhooks/:id/deliveries
router.get('/:id/deliveries', can('webhooks:read'), async (req, res) => {
  try {
    const webhook = await prisma.webhook.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' })

    const { page, limit, skip, take } = parsePagination(req)
    const where = { webhookId: req.params.id }

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.webhookDelivery.count({ where })
    ])
    res.json(paginatedResponse(deliveries, total, page, limit))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/webhooks/:id/deliveries/:deliveryId/resend
router.post('/:id/deliveries/:deliveryId/resend', can('webhooks:write'), async (req, res) => {
  try {
    const webhook = await prisma.webhook.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    })
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' })

    const delivery = await prisma.webhookDelivery.findFirst({
      where: { id: req.params.deliveryId, webhookId: req.params.id }
    })
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' })

    // Reset delivery for re-attempt
    const reset = await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'pending', attempts: 0, nextRetryAt: null, statusCode: null, responseBody: null, deliveredAt: null }
    })

    // Attempt immediate delivery
    const { deliver } = require('../services/webhookService')
    deliver(reset, webhook).catch(err =>
      console.error(`[webhook] Resend ${delivery.id} error:`, err.message)
    )

    res.json({ resent: true, deliveryId: delivery.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
