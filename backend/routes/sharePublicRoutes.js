// ─────────────────────────────────────────────────────────────
//  routes/sharePublicRoutes.js — Public share link viewing
//
//  No authentication required. Returns read-only project data
//  for valid, non-expired share tokens.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// ── GET /api/public/share/:token — view shared project ───────
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params

    // Find share link
    const links = await prisma.$queryRawUnsafe(
      `SELECT sl.id, sl.token, sl."projectId", sl."donorOrgId",
              sl."expiresAt", sl."viewCount", sl."isActive"
       FROM "ShareLink" sl
       WHERE sl.token = $1
       LIMIT 1`,
      token
    )

    if (!links.length) {
      return res.status(404).json({ error: 'Share link not found' })
    }

    const link = links[0]

    if (!link.isActive) {
      return res.status(410).json({ error: 'This share link has been revoked' })
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This share link has expired' })
    }

    // Increment view count
    await prisma.$executeRawUnsafe(
      `UPDATE "ShareLink" SET "viewCount" = "viewCount" + 1, "updatedAt" = NOW() WHERE id = $1`,
      link.id
    )

    // Fetch project details
    const projects = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.name, p.description, p.status, p.budget,
              p."startDate", p."endDate",
              t.name as "tenantName"
       FROM "Project" p
       LEFT JOIN "Tenant" t ON t.id = p."tenantId"
       WHERE p.id = $1
       LIMIT 1`,
      link.projectId
    )

    if (!projects.length) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const project = projects[0]

    // Fetch expenses (sanitized — no internal IDs exposed beyond what's needed)
    const expenses = await prisma.$queryRawUnsafe(
      `SELECT date, vendor, amount, currency, category, status
       FROM "Expense"
       WHERE "projectId" = $1
       ORDER BY date DESC`,
      link.projectId
    )

    // Fetch documents (sanitized — no download URLs)
    const documents = await prisma.$queryRawUnsafe(
      `SELECT "fileName", "fileSize", "uploadedAt"
       FROM "Document"
       WHERE "projectId" = $1
       ORDER BY "uploadedAt" DESC`,
      link.projectId
    )

    // Fetch funding sources
    const fundingSources = await prisma.$queryRawUnsafe(
      `SELECT name, amount, currency
       FROM "FundingSource"
       WHERE "projectId" = $1
       ORDER BY name ASC`,
      link.projectId
    )

    // Calculate totals
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalFunded = fundingSources.reduce((s, f) => s + Number(f.amount || 0), 0)

    // Fetch donor org name for attribution
    const orgs = await prisma.$queryRawUnsafe(
      `SELECT name FROM "DonorOrganisation" WHERE id = $1 LIMIT 1`,
      link.donorOrgId
    )

    res.json({
      project: {
        name: project.name,
        description: project.description,
        status: project.status,
        budget: Number(project.budget || 0),
        spent: totalSpent,
        funded: totalFunded,
        remaining: Number(project.budget || 0) - totalSpent,
        startDate: project.startDate,
        endDate: project.endDate,
        tenantName: project.tenantName,
      },
      expenses: expenses.map(e => ({
        date: e.date,
        vendor: e.vendor,
        amount: Number(e.amount || 0),
        currency: e.currency || 'USD',
        category: e.category,
        status: e.status,
      })),
      documents: documents.map(d => ({
        fileName: d.fileName,
        fileSize: Number(d.fileSize || 0),
        uploadedAt: d.uploadedAt,
      })),
      fundingSources: fundingSources.map(f => ({
        name: f.name,
        amount: Number(f.amount || 0),
        currency: f.currency || 'USD',
      })),
      sharedBy: orgs.length ? orgs[0].name : null,
      viewCount: Number(link.viewCount || 0) + 1,
    })
  } catch (err) {
    console.error('Public share view error:', err)
    res.status(500).json({ error: 'Failed to load shared project' })
  }
})

module.exports = router
