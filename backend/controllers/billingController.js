// ─────────────────────────────────────────────────────────────
//  controllers/billingController.js
//  Stripe subscription billing endpoints
// ─────────────────────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const prisma = require('../prisma/client')
const { createAuditLog } = require('../services/auditService')

const PLANS = {
  STARTER: {
    name: 'Starter',
    priceEnvKey: 'STRIPE_STARTER_PRICE_ID',
    maxUsers: 3,
    maxDocuments: 100,
  },
  PRO: {
    name: 'Professional',
    priceEnvKey: 'STRIPE_PRO_PRICE_ID',
    maxUsers: 10,
    maxDocuments: 500,
  },
}

// ── Helper: get or create Stripe customer for tenant ─────────
async function getOrCreateCustomer(tenant, user) {
  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: tenant.name,
    metadata: { tenantId: tenant.id, tenantCode: tenant.code },
  })

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}

// ── POST /api/billing/create-checkout ────────────────────────
exports.createCheckout = async (req, res) => {
  try {
    const { tenantId, userId } = req.user
    const { plan } = req.body // 'STARTER' or 'PRO'

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Use STARTER or PRO' })
    }

    const priceId = process.env[PLANS[plan].priceEnvKey]
    if (!priceId) {
      return res.status(500).json({ error: 'Stripe price not configured for this plan' })
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!tenant || !user) return res.status(404).json({ error: 'Tenant or user not found' })

    const customerId = await getOrCreateCustomer(tenant, user)
    const appUrl = process.env.APP_URL || 'https://app.tulipds.com'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing`,
      subscription_data: {
        metadata: { tenantId, plan },
      },
      metadata: { tenantId, plan },
    })

    await createAuditLog({
      action: 'BILLING_CHECKOUT_CREATED',
      entityType: 'Tenant',
      entityId: tenantId,
      userId,
      tenantId,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing/create-checkout]', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
}

// ── GET /api/billing/subscription ────────────────────────────
exports.getSubscription = async (req, res) => {
  try {
    const { tenantId } = req.user

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, plan: true, planStatus: true,
        stripeCustomerId: true, stripeSubscriptionId: true, trialEndsAt: true,
      },
    })
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

    // Usage stats
    const [userCount, documentCount] = await Promise.all([
      prisma.user.count({ where: { tenantId, deletedAt: null } }),
      prisma.document.count({ where: { tenantId } }),
    ])

    // If there's an active Stripe subscription, get details
    let stripeSubscription = null
    if (tenant.stripeSubscriptionId) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId)
      } catch {
        // subscription may have been deleted in Stripe
      }
    }

    // Get invoices if customer exists
    let invoices = []
    if (tenant.stripeCustomerId) {
      try {
        const invoiceList = await stripe.invoices.list({
          customer: tenant.stripeCustomerId,
          limit: 10,
        })
        invoices = invoiceList.data.map(inv => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amount: inv.amount_paid,
          currency: inv.currency,
          created: inv.created,
          invoiceUrl: inv.hosted_invoice_url,
          pdfUrl: inv.invoice_pdf,
        }))
      } catch {
        // no invoices yet
      }
    }

    const trialActive = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date()
    const trialDaysLeft = trialActive
      ? Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0

    res.json({
      plan: tenant.plan,
      planStatus: tenant.planStatus,
      trialEndsAt: tenant.trialEndsAt,
      trialActive,
      trialDaysLeft,
      usage: {
        users: userCount,
        documents: documentCount,
      },
      limits: getPlanLimits(tenant.plan),
      subscription: stripeSubscription ? {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        currentPeriodEnd: stripeSubscription.current_period_end,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      } : null,
      invoices,
    })
  } catch (err) {
    console.error('[billing/subscription]', err)
    res.status(500).json({ error: 'Failed to get subscription' })
  }
}

// ── POST /api/billing/portal ─────────────────────────────────
exports.createPortalSession = async (req, res) => {
  try {
    const { tenantId } = req.user

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant?.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found. Subscribe to a plan first.' })
    }

    const appUrl = process.env.APP_URL || 'https://app.tulipds.com'
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[billing/portal]', err)
    res.status(500).json({ error: 'Failed to create portal session' })
  }
}

// ── POST /api/billing/webhook ────────────────────────────────
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[billing/webhook] Signature verification failed:', err.message)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          const tenantId = session.metadata?.tenantId || sub.metadata?.tenantId
          const plan = session.metadata?.plan || sub.metadata?.plan || 'STARTER'

          if (tenantId) {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: {
                stripeSubscriptionId: sub.id,
                stripeCustomerId: session.customer,
                plan,
                planStatus: 'active',
              },
            })
            console.log(`[billing/webhook] Subscription activated: tenant=${tenantId} plan=${plan}`)
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const tenantId = sub.metadata?.tenantId
        if (tenantId) {
          const updateData = { planStatus: sub.status }

          if (sub.cancel_at_period_end) {
            updateData.planStatus = 'cancelling'
          } else if (sub.status === 'active') {
            updateData.planStatus = 'active'
          }

          await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
          })
          console.log(`[billing/webhook] Subscription updated: tenant=${tenantId} status=${sub.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const tenantId = sub.metadata?.tenantId
        if (tenantId) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              plan: 'FREE',
              planStatus: 'active',
              stripeSubscriptionId: null,
            },
          })
          console.log(`[billing/webhook] Subscription cancelled: tenant=${tenantId}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          const tenantId = sub.metadata?.tenantId
          if (tenantId) {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: { planStatus: 'past_due' },
            })
            console.log(`[billing/webhook] Payment failed: tenant=${tenantId}`)
          }
        }
        break
      }

      default:
        console.log(`[billing/webhook] Unhandled event: ${event.type}`)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[billing/webhook] Processing error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}

// ── Helper: plan limits ──────────────────────────────────────
function getPlanLimits(plan) {
  switch (plan) {
    case 'STARTER':
      return { maxUsers: 3, maxDocuments: 100 }
    case 'PRO':
      return { maxUsers: 10, maxDocuments: 500 }
    case 'ENTERPRISE':
      return { maxUsers: -1, maxDocuments: -1 }
    default: // FREE / trial
      return { maxUsers: 3, maxDocuments: 5 }
  }
}

exports.getPlanLimits = getPlanLimits
