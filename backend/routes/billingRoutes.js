// ─────────────────────────────────────────────────────────────
//  routes/billingRoutes.js — Stripe billing endpoints
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const {
  createCheckout,
  getSubscription,
  createPortalSession,
} = require('../controllers/billingController')

router.get('/subscription', authenticate, getSubscription)
router.post('/create-checkout', authenticate, createCheckout)
router.post('/portal', authenticate, createPortalSession)

module.exports = router
