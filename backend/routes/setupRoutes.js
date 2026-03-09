// ─────────────────────────────────────────────────────────────
//  routes/setupRoutes.js — Org setup wizard endpoints
// ─────────────────────────────────────────────────────────────

const express      = require('express')
const router       = express.Router()
const multer       = require('multer')
const authenticate = require('../middleware/authenticate')
const {
  updateOrganisation,
  uploadLogo,
  createFirstProject,
  inviteTeam,
  completeSetup,
  getSetupStatus
} = require('../controllers/setupController')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.use(authenticate)

router.get('/status',        getSetupStatus)
router.patch('/organisation', updateOrganisation)
router.post('/logo',         upload.single('logo'), uploadLogo)
router.post('/project',      createFirstProject)
router.post('/invite-team',  inviteTeam)
router.post('/complete',     completeSetup)

module.exports = router
