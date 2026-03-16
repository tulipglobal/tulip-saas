// ─────────────────────────────────────────────────────────────
//  services/webhookService.js — v1
//
//  Stripe-style webhook delivery:
//  ✔ HMAC-SHA256 signatures on every delivery
//  ✔ Async delivery queue (non-blocking)
//  ✔ Exponential backoff retry (3 attempts: 1m, 5m, 30m)
//  ✔ Delivery log in WebhookDelivery table
//  ✔ Retry worker runs on schedule via anchorScheduler pattern
//
//  Events supported:
//    audit.created         — new AuditLog entry
//    anchor.confirmed      — blockchain TX confirmed
//    anchor.failed         — blockchain TX failed
//    gdpr.export           — data export requested
//    gdpr.erasure          — user erased
//    document.created      — new document uploaded
//    document.verified     — document blockchain anchored
//    document.expiring     — document expiring within 30 days
//    expense.created       — new expense added
//    expense.blocked       — expense blocked due to HIGH fraud
//    expense.flagged       — expense sent to pending review
//    expense.approved      — expense approved
//    expense.voided        — expense voided
//    seal.issued           — TrustSeal created
//    seal.anchored         — TrustSeal anchored to Polygon
//    funding.created       — new funding agreement created
//    member.invited        — team member invited
//    member.joined         — team member accepted invite
//    webhook.test          — test event
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto')
const prisma  = require('../lib/client')

const MAX_ATTEMPTS  = 3
const RETRY_DELAYS  = [60, 300, 1800] // seconds: 1min, 5min, 30min

// ── Sign a payload ────────────────────────────────────────────
// Stripe-style: HMAC-SHA256 of timestamp + payload
// Header: Tulip-Signature: t=TIMESTAMP,v1=SIGNATURE
function sign(secret, timestamp, payload) {
  const body = `${timestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`
  const sig  = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return `t=${timestamp},v1=${sig}`
}

// ── Deliver a single webhook ──────────────────────────────────
async function deliver(delivery, webhook) {
  const timestamp   = Math.floor(Date.now() / 1000)
  const payloadStr  = JSON.stringify(delivery.payload)
  const signature   = sign(webhook.secret, timestamp, payloadStr)

  let statusCode, responseBody, success

  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const res = await fetch(webhook.url, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':    'application/json',
        'Tulip-Signature': signature,
        'Tulip-Event':     delivery.event,
        'Tulip-Delivery':  delivery.id,
      },
      body: payloadStr,
    })

    clearTimeout(timeout)
    statusCode   = res.status
    responseBody = await res.text().catch(() => '')
    success      = res.status >= 200 && res.status < 300

  } catch (err) {
    statusCode   = 0
    responseBody = err.message
    success      = false
  }

  const attempts = delivery.attempts + 1
  const failed   = !success && attempts >= MAX_ATTEMPTS

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attempts,
      statusCode,
      responseBody: responseBody?.slice(0, 500), // truncate
      status:       success ? 'success' : (failed ? 'failed' : 'pending'),
      deliveredAt:  success ? new Date() : null,
      nextRetryAt:  (!success && !failed)
        ? new Date(Date.now() + RETRY_DELAYS[attempts - 1] * 1000)
        : null,
    }
  })

  return success
}

// ── Dispatch an event to all matching webhooks ─────────────────
// Called from auditService, anchorService, gdprService etc.
// Non-blocking — fires and forgets
async function dispatch(tenantId, event, payload) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        tenantId,
        active: true,
        events: { has: event }
      }
    })

    if (webhooks.length === 0) return

    // Create delivery records for all matching webhooks
    const deliveries = await Promise.all(
      webhooks.map(wh => prisma.webhookDelivery.create({
        data: {
          webhookId: wh.id,
          tenantId,
          event,
          payload,
          status:    'pending',
          attempts:  0,
        }
      }))
    )

    // Attempt immediate delivery (non-blocking)
    deliveries.forEach((delivery, i) => {
      deliver(delivery, webhooks[i]).catch(err =>
        console.error(`[webhook] Delivery ${delivery.id} error:`, err.message)
      )
    })

  } catch (err) {
    console.error('[webhook] Dispatch error:', err.message)
    // Never throw — webhook failures must not affect the main request
  }
}

// ── Retry worker — call this on a schedule ────────────────────
// Finds pending deliveries past their nextRetryAt and retries them
async function retryFailed() {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status:      'pending',
      attempts:    { lt: MAX_ATTEMPTS },
      nextRetryAt: { lte: new Date() }
    },
    include: { Webhook: true },
    take: 50
  })

  if (due.length === 0) return

  console.log(`[webhook] Retrying ${due.length} failed deliveries`)

  for (const delivery of due) {
    if (!delivery.Webhook?.active) continue
    await deliver(delivery, delivery.Webhook).catch(err =>
      console.error(`[webhook] Retry ${delivery.id} error:`, err.message)
    )
  }
}

module.exports = { dispatch, deliver, retryFailed, sign }
