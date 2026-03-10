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
  verifyCheckout,
  verifySubscription,
} = require('../controllers/billingController')

router.get('/subscription', authenticate, getSubscription)
router.post('/create-checkout', authenticate, createCheckout)
router.post('/portal', authenticate, createPortalSession)

// verify.tulipds.com billing
router.post('/verify-checkout', authenticate, verifyCheckout)
router.get('/verify-subscription', authenticate, verifySubscription)

module.exports = router
