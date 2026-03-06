// ─────────────────────────────────────────────────────────────
//  routes/projectRoutes.js — v2
//
//  Changes from v1:
//  ✔ Removed duplicate authenticate calls (handled in app.js)
//  ✔ Replaced authorize('admin') with granular can() permissions
//  ✔ Controllers stay clean — no auth logic inside them
// ─────────────────────────────────────────────────────────────

const express     = require('express')
const router      = express.Router()
const { can }     = require('../middleware/permission')

const {
  getProjects, getProject,
  createProject, updateProject, deleteProject
} = require('../controllers/projectController')

router.get('/',        can('projects:read'),   getProjects)
router.get('/:id',     can('projects:read'),   getProject)
router.post('/',       can('projects:write'),  createProject)
router.put('/:id',     can('projects:write'),  updateProject)
router.delete('/:id',  can('projects:delete'), deleteProject)

module.exports = router
