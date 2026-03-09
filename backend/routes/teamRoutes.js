// ─────────────────────────────────────────────────────────────
//  routes/teamRoutes.js — v1
// ─────────────────────────────────────────────────────────────
const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const { list, listRoles, invite, changeRole, remove } = require('../controllers/teamController')

router.get('/',               authenticate, list)
router.get('/roles',          authenticate, listRoles)
router.post('/invite',        authenticate, invite)
router.patch('/:userId/role', authenticate, changeRole)
router.delete('/:userId',     authenticate, remove)

module.exports = router
