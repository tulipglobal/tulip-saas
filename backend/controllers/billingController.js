// ─────────────────────────────────────────────────────────────
//  controllers/billingController.js
//  Stripe subscription billing endpoints
// ─────────────────────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const prisma = require('../prisma/client')
const { createAuditLog } = require('../services/auditService')
const { notifyPaymentFailed } = require('../services/emailNotificationService')

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

    // Trial is only relevant for FREE plan — paid plans are never "on trial"
    const isPaidPlan = tenant.plan !== 'FREE' && tenant.plan !== null
    const trialActive = !isPaidPlan && tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date()
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

// ── Helper: resolve plan name from Stripe price ID ───────────
function resolvePlanFromPriceId(priceId) {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'STARTER'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO'
  return null
}

// ── Helper: find tenantId from metadata or Stripe customer ───
async function resolveTenantId(metadata, customerId) {
  // Try metadata first
  if (metadata?.tenantId) return metadata.tenantId

  // Fallback: look up by stripeCustomerId
  if (customerId) {
    const tenant = await prisma.tenant.findFirst({ where: { stripeCustomerId: customerId } })
    if (tenant) {
      console.log(`[billing/webhook] Resolved tenantId from customerId=${customerId}: ${tenant.id}`)
      return tenant.id
    }
  }
  return null
}

// ── Helper: resolve plan from metadata, price ID, or subscription items ──
function resolvePlan(metadata, subscription) {
  // 1. Try metadata
  if (metadata?.plan) return metadata.plan

  // 2. Try price ID from subscription items
  if (subscription?.items?.data?.length > 0) {
    const priceId = subscription.items.data[0].price?.id
    const mapped = resolvePlanFromPriceId(priceId)
    if (mapped) return mapped
  }

  return 'STARTER' // safe default
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

  console.log(`[billing/webhook] Received event: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        console.log('[billing/webhook] checkout.session.completed — mode:', session.mode, 'subscription:', session.subscription, 'customer:', session.customer, 'metadata:', JSON.stringify(session.metadata))

        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          const tenantId = await resolveTenantId(session.metadata, session.customer) || await resolveTenantId(sub.metadata, session.customer)
          const plan = resolvePlan(session.metadata, sub) || resolvePlan(sub.metadata, sub)

          if (tenantId) {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: {
                stripeSubscriptionId: sub.id,
                stripeCustomerId: session.customer,
                plan,
                planStatus: 'active',
                trialEndsAt: null,
              },
            })
            console.log(`[billing/webhook] ✅ Subscription activated: tenant=${tenantId} plan=${plan} subId=${sub.id}`)
          } else {
            console.error('[billing/webhook] ❌ Could not resolve tenantId for checkout session:', session.id)
          }
        }
        break
      }

      case 'customer.subscription.created': {
        const sub = event.data.object
        console.log('[billing/webhook] customer.subscription.created — id:', sub.id, 'customer:', sub.customer, 'metadata:', JSON.stringify(sub.metadata))

        const tenantId = await resolveTenantId(sub.metadata, sub.customer)
        const plan = resolvePlan(sub.metadata, sub)

        if (tenantId && sub.status === 'active') {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              stripeSubscriptionId: sub.id,
              plan,
              planStatus: 'active',
              trialEndsAt: null,
            },
          })
          console.log(`[billing/webhook] ✅ Subscription created: tenant=${tenantId} plan=${plan}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        console.log('[billing/webhook] customer.subscription.updated — id:', sub.id, 'status:', sub.status, 'metadata:', JSON.stringify(sub.metadata))

        const tenantId = await resolveTenantId(sub.metadata, sub.customer)
        if (tenantId) {
          const updateData = { planStatus: sub.status }

          if (sub.cancel_at_period_end) {
            updateData.planStatus = 'cancelling'
          } else if (sub.status === 'active') {
            updateData.planStatus = 'active'
            // Also update plan from price in case it changed
            const plan = resolvePlan(sub.metadata, sub)
            if (plan) updateData.plan = plan
          }

          await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
          })
          console.log(`[billing/webhook] ✅ Subscription updated: tenant=${tenantId} status=${sub.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const tenantId = await resolveTenantId(sub.metadata, sub.customer)
        if (tenantId) {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              plan: 'FREE',
              planStatus: 'active',
              stripeSubscriptionId: null,
            },
          })
          console.log(`[billing/webhook] ✅ Subscription cancelled: tenant=${tenantId}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        console.log('[billing/webhook] invoice.payment_succeeded — subscription:', invoice.subscription, 'customer:', invoice.customer, 'amount:', invoice.amount_paid)

        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          const tenantId = await resolveTenantId(sub.metadata, invoice.customer)
          const plan = resolvePlan(sub.metadata, sub)

          if (tenantId) {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: {
                plan,
                planStatus: 'active',
                stripeSubscriptionId: sub.id,
                trialEndsAt: null,
              },
            })
            console.log(`[billing/webhook] ✅ Payment succeeded, plan confirmed: tenant=${tenantId} plan=${plan}`)
          } else {
            console.error('[billing/webhook] ❌ Could not resolve tenantId for invoice:', invoice.id)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          const tenantId = await resolveTenantId(sub.metadata, invoice.customer)
          if (tenantId) {
            const tenant = await prisma.tenant.update({
              where: { id: tenantId },
              data: { planStatus: 'past_due' },
            })
            console.log(`[billing/webhook] ⚠️ Payment failed: tenant=${tenantId}`)
            notifyPaymentFailed({ tenantId, tenantName: tenant.name }).catch(() => {})
          }
        }
        break
      }

      default:
        console.log(`[billing/webhook] Unhandled event: ${event.type}`)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[billing/webhook] Processing error:', err.message, err.stack)
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
