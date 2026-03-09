const express = require('express')
const router = express.Router()
const donorAuth = require('../middleware/donorAuthenticate')
const ctrl = require('../controllers/donorAuthController')

// Public
router.post('/login', ctrl.login)

// Authenticated (donor JWT)
router.get('/me', donorAuth, ctrl.me)
router.get('/dashboard', donorAuth, ctrl.dashboard)

module.exports = router
