const tenantClient = require('../lib/tenantClient')

// GET /api/projects
exports.getProjects = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const projects = await db.project.findMany({
      include: {
        fundingSources: true,
        expenses: true,
        _count: { select: { documents: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(projects)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
}

// GET /api/projects/:id
exports.getProject = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const project = await db.project.findFirst({
      where: { id: req.params.id },
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
      data: {
        name,
        description,
        budget: budget ? parseFloat(budget) : null
      }
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
    const db = tenantClient(req.user.tenantId)
    const existing = await db.project.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    const { name, description, budget, status } = req.body
    const project = await db.project.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(budget !== undefined && { budget: parseFloat(budget) }),
        ...(status && { status })
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
    const db = tenantClient(req.user.tenantId)
    const existing = await db.project.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    await db.project.delete({ where: { id: req.params.id } })
    res.json({ message: 'Project deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' })
  }
}
