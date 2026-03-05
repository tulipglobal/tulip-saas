const tenantClient = require('../lib/tenantClient')

const VALID_TYPES = ['grant', 'impact_loan', 'impact_investment']

// GET /api/funding-sources
exports.getFundingSources = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const sources = await db.fundingSource.findMany({
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(sources)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch funding sources' })
  }
}

// GET /api/funding-sources/:id
exports.getFundingSource = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const source = await db.fundingSource.findFirst({
      where: { id: req.params.id },
      include: { project: true, expenses: true }
    })
    if (!source) return res.status(404).json({ error: 'Funding source not found' })
    res.json(source)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch funding source' })
  }
}

// POST /api/funding-sources
exports.createFundingSource = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, fundingType, amount, currency, projectId } = req.body

    if (!name || !fundingType || !amount || !currency || !projectId)
      return res.status(400).json({ error: 'name, fundingType, amount, currency, projectId are required' })

    if (!VALID_TYPES.includes(fundingType))
      return res.status(400).json({ error: `fundingType must be one of: ${VALID_TYPES.join(', ')}` })

    // Verify project belongs to tenant
    const project = await db.project.findFirst({ where: { id: projectId } })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const source = await db.fundingSource.create({
      data: { name, fundingType, amount: parseFloat(amount), currency, projectId }
    })
    res.status(201).json(source)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create funding source' })
  }
}

// PUT /api/funding-sources/:id
exports.updateFundingSource = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.fundingSource.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Funding source not found' })

    const { name, fundingType, amount, currency } = req.body
    if (fundingType && !VALID_TYPES.includes(fundingType))
      return res.status(400).json({ error: `fundingType must be one of: ${VALID_TYPES.join(', ')}` })

    const source = await db.fundingSource.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(fundingType && { fundingType }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(currency && { currency })
      }
    })
    res.json(source)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update funding source' })
  }
}

// DELETE /api/funding-sources/:id
exports.deleteFundingSource = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.fundingSource.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Funding source not found' })

    await db.fundingSource.delete({ where: { id: req.params.id } })
    res.json({ message: 'Funding source deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete funding source' })
  }
}
