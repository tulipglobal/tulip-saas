const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const {
  getProjects, getProject,
  createProject, updateProject, deleteProject
} = require('../controllers/projectController')

router.get('/',       authenticate, getProjects)
router.get('/:id',    authenticate, getProject)
router.post('/',      authenticate, authorize('admin'), createProject)
router.put('/:id',    authenticate, authorize('admin'), updateProject)
router.delete('/:id', authenticate, authorize('admin'), deleteProject)

module.exports = router
