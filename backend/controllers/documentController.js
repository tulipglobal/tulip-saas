const tenantClient = require('../lib/tenantClient')

// GET /api/documents
exports.getDocuments = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { projectId } = req.query
    const documents = await db.document.findMany({
      where: {
        ...(projectId && { projectId })
      },
      include: {
        project: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } }
      },
      orderBy: { uploadedAt: 'desc' }
    })
    res.json(documents)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
}

// GET /api/documents/:id
exports.getDocument = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const document = await db.document.findFirst({
      where: { id: req.params.id },
      include: {
        project: true,
        uploadedBy: { select: { id: true, name: true } }
      }
    })
    if (!document) return res.status(404).json({ error: 'Document not found' })
    res.json(document)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch document' })
  }
}

// POST /api/documents
exports.createDocument = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, fileUrl, fileType, projectId } = req.body

    if (!name || !fileUrl)
      return res.status(400).json({ error: 'name and fileUrl are required' })

    // Verify project belongs to tenant if provided
    if (projectId) {
      const project = await db.project.findFirst({ where: { id: projectId } })
      if (!project) return res.status(404).json({ error: 'Project not found' })
    }

    const document = await db.document.create({
      data: {
        name,
        fileUrl,
        fileType: fileType || null,
        projectId: projectId || null,
        uploadedById: req.user.userId
      }
    })
    res.status(201).json(document)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create document' })
  }
}

// DELETE /api/documents/:id
exports.deleteDocument = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.document.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Document not found' })

    await db.document.delete({ where: { id: req.params.id } })
    res.json({ message: 'Document deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' })
  }
}
