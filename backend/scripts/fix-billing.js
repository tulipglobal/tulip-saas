#!/usr/bin/env node
// One-time script: fix tenant plan for benzerbright@gmail.com
// Usage: node scripts/fix-billing.js

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fix() {
  const user = await prisma.user.findFirst({
    where: { email: 'benzerbright@gmail.com' },
    include: { tenant: { select: { id: true, name: true, plan: true, planStatus: true, stripeSubscriptionId: true, trialEndsAt: true } } }
  })

  if (!user) {
    console.log('❌ User not found: benzerbright@gmail.com')
    return
  }

  console.log('Found user:', user.email)
  console.log('Current tenant state:', JSON.stringify(user.tenant, null, 2))

  const updated = await prisma.tenant.update({
    where: { id: user.tenantId },
    data: {
      plan: 'PRO',
      planStatus: 'active',
      trialEndsAt: null,
    },
  })

  console.log('✅ Tenant plan fixed to PRO (Professional)')
  console.log('Updated:', JSON.stringify({ id: updated.id, plan: updated.plan, planStatus: updated.planStatus, trialEndsAt: updated.trialEndsAt }, null, 2))
}

fix()
  .catch(err => console.error('Error:', err.message))
  .finally(() => prisma.$disconnect())
