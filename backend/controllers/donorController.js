// ─────────────────────────────────────────────────────────────
//  controllers/donorController.js — v1
// ─────────────────────────────────────────────────────────────
const prisma = require('../lib/client')

exports.listDonors = async (req, res) => {
  try {
    const donors = await prisma.donor.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { fundingAgreements: true } } }
    })
    res.json({ data: donors })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch donors' })
  }
}

exports.getDonor = async (req, res) => {
  try {
    const donor = await prisma.donor.findUnique({
      where: { id: req.params.id },
      include: {
        fundingAgreements: { where: { tenantId: req.user.tenantId }, orderBy: { createdAt: 'desc' } },
        _count: { select: { donorUsers: true, fundingAgreements: true } }
      }
    })
    if (!donor) return res.status(404).json({ error: 'Donor not found' })
    res.json(donor)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch donor' })
  }
}

exports.createDonor = async (req, res) => {
  try {
    const { name, organisationName, type, email, country, website, registrationNumber } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const donor = await prisma.donor.create({
      data: { name, organisationName: organisationName || name, type: type || 'FOUNDATION', email, country, website, registrationNumber }
    })
    res.status(201).json(donor)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create donor' })
  }
}

exports.updateDonor = async (req, res) => {
  try {
    const { name, organisationName, type, email, country, website, registrationNumber } = req.body
    const donor = await prisma.donor.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(organisationName !== undefined && { organisationName }),
        ...(type !== undefined && { type }),
        ...(email !== undefined && { email }),
        ...(country !== undefined && { country }),
        ...(website !== undefined && { website }),
        ...(registrationNumber !== undefined && { registrationNumber }),
      }
    })
    res.json(donor)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update donor' })
  }
}
