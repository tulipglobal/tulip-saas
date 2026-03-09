const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const { can } = require('../middleware/permission')
const tenantScope = require('../middleware/tenantScope')
const { createInvite, listInvites, acceptInvite } = require('../controllers/donorInviteController')

// Authenticated routes
router.get('/',  authenticate, tenantScope, can('projects:read'),  listInvites)
router.post('/create', authenticate, tenantScope, can('projects:write'), createInvite)

// Public — no auth required
router.post('/accept', acceptInvite)

module.exports = router
