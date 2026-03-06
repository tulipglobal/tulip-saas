// ─────────────────────────────────────────────────────────────
//  controllers/projectController.js — v2
//
//  Changes from v1:
//  ✔ GET / — paginated (page, limit query params)
//  ✔ GET / — supports ?status=active|completed filter
//  ✔ GET / — supports ?search= name filter
// ─────────────────────────────────────────────────────────────

const tenantClient = require('../lib/tenantClient')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

// GET /api/projects?page=1&limit=20&status=active&search=water
exports.getProjects = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)

    const where = {}
    if (req.query.status) where.status = req.query.status
    if (req.query.search) where.name   = { contains: req.query.search, mode: 'insensitive' }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        skip,
        take,
        include: {
          fundingSources: true,
          expenses:       true,
          _count: { select: { documents: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.project.count({ where })
    ])

    res.json(paginatedResponse(projects, total, page, limit))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
}

// GET /api/projects/:id
exports.getProject = async (req, res) => {
  try {
    const db      = tenantClient(req.user.tenantId)
    const project = await db.project.findFirst({
      where:   { id: req.params.id },
      include: { fundingSources: true, expenses: true, documents: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })
    res.json(project)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' })
  }
}

// POST /api/projects
exports.createProject = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, description, budget } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const project = await db.project.create({
      data: { name, description, budget: budget ? parseFloat(budget) : null }
    })
    res.status(201).json(project)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create project' })
  }
}

// PUT /api/projects/:id
exports.updateProject = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.project.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    const { name, description, budget, status } = req.body
    const project = await db.project.update({
      where: { id: req.params.id },
      data: {
        ...(name        !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(budget      !== undefined && { budget: parseFloat(budget) }),
        ...(status      !== undefined && { status }),
      }
    })
    res.json(project)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' })
  }
}

// DELETE /api/projects/:id
exports.deleteProject = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.project.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    await db.project.delete({ where: { id: req.params.id } })
    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' })
  }
}
