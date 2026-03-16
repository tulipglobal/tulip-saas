// ─────────────────────────────────────────────────────────────
//  routes/reportRoutes.js — Custom Report Builder for donors
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const prisma = require('../lib/client')
const PDFDocument = require('pdfkit')
const { uploadToS3, getPresignedUrl } = require('../lib/s3Upload')

const JWT_SECRET = process.env.JWT_SECRET

function donorAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    if (!payload.donorOrgId) return res.status(401).json({ error: 'Not a donor token' })
    req.donor = payload
    next()
  } catch { return res.status(401).json({ error: 'Invalid token' }) }
}

// POST /api/donor/reports/generate
router.post('/generate', donorAuth, async (req, res) => {
  try {
    const { name, dateRange, dateFrom, dateTo, projectIds, sections } = req.body
    const { donorOrgId, donorMemberId } = req.donor

    if (!name || !projectIds?.length || !sections?.length) {
      return res.status(400).json({ error: 'name, projectIds, and sections are required' })
    }

    // Map frontend section keys to backend keys
    const sectionKeyMap = {
      expense_summary: 'expenses',
      budget_vs_actual: 'budget',
      impact_milestones: 'milestones',
      deliverable_requests: 'deliverables',
      blockchain_seals: 'seals',
      fraud_risk_summary: 'fraud',
      funding_breakdown: 'funding',
    }
    const mappedSections = sections.map(s => sectionKeyMap[s] || s)

    // Accept both { dateRange: { from, to } } and { dateFrom, dateTo }
    const from = dateRange?.from ? new Date(dateRange.from) : dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const to = dateRange?.to ? new Date(dateRange.to) : dateTo ? new Date(dateTo) : new Date()

    // Verify donor has access to these projects
    const accessRows = await prisma.$queryRawUnsafe(`
      SELECT "projectId" FROM "DonorProjectAccess"
      WHERE "donorOrgId" = $1 AND "revokedAt" IS NULL
    `, donorOrgId)
    const allowedIds = accessRows.map(r => r.projectId)
    const validIds = projectIds.filter(id => allowedIds.includes(id))
    if (!validIds.length) return res.status(403).json({ error: 'No access to selected projects' })

    // Fetch projects
    const projects = await prisma.project.findMany({
      where: { id: { in: validIds } },
      select: { id: true, name: true, budget: true, status: true }
    })

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const buffers = []
    doc.on('data', b => buffers.push(b))

    // Cover page
    doc.fontSize(24).fillColor('#3C3489').text('Sealayer Report', { align: 'center' })
    doc.moveDown()
    doc.fontSize(16).fillColor('#26215C').text(name, { align: 'center' })
    doc.moveDown()
    doc.fontSize(11).fillColor('#666')
    doc.text(`Date range: ${from.toLocaleDateString()} — ${to.toLocaleDateString()}`, { align: 'center' })
    doc.text(`Projects: ${projects.map(p => p.name).join(', ')}`, { align: 'center' })
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
    doc.moveDown(2)

    const placeholders = validIds.map((_, i) => `$${i + 1}`).join(',')

    // Sections
    for (const section of mappedSections) {
      doc.addPage()
      doc.fontSize(16).fillColor('#3C3489').text(sectionTitle(section))
      doc.moveDown()
      doc.fontSize(10).fillColor('#333')

      if (section === 'expenses') {
        const expenses = await prisma.expense.findMany({
          where: { projectId: { in: validIds }, createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: { title: true, vendor: true, amount: true, currency: true, createdAt: true, category: true, fraudRiskLevel: true }
        })
        doc.text(`Total expenses: ${expenses.length}`)
        const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
        doc.text(`Total amount: $${totalAmount.toLocaleString()}`)
        doc.moveDown()
        for (const e of expenses.slice(0, 100)) {
          doc.text(`${e.createdAt?.toLocaleDateString() || '—'}  |  ${e.vendor || '—'}  |  ${e.currency || 'USD'} ${Number(e.amount).toLocaleString()}  |  ${e.category || '—'}  |  Risk: ${e.fraudRiskLevel || 'N/A'}`)
        }
        if (expenses.length > 100) doc.text(`... and ${expenses.length - 100} more`)
      }

      if (section === 'budget') {
        for (const p of projects) {
          doc.fontSize(12).fillColor('#26215C').text(p.name)
          doc.fontSize(10).fillColor('#333')
          const totalBudget = Number(p.budget) || 0
          const spent = await prisma.expense.aggregate({
            where: { projectId: p.id, createdAt: { gte: from, lte: to } },
            _sum: { amount: true }
          })
          const totalSpent = Number(spent._sum.amount) || 0
          doc.text(`Budget: $${totalBudget.toLocaleString()}  |  Spent: $${totalSpent.toLocaleString()}  |  Remaining: $${(totalBudget - totalSpent).toLocaleString()}`)
          doc.moveDown()
        }
      }

      if (section === 'milestones') {
        const milestones = await prisma.$queryRawUnsafe(`
          SELECT im.*, p.name as "projectName" FROM "ImpactMilestone" im
          LEFT JOIN "Project" p ON p.id = im."projectId"
          WHERE im."projectId" IN (${validIds.map((_, i) => `$${i + 1}`).join(',')})
          ORDER BY im."createdAt" ASC
        `, ...validIds)
        doc.text(`Total milestones: ${milestones.length}`)
        doc.moveDown()
        for (const m of milestones) {
          const pct = m.targetValue > 0 ? Math.round((Number(m.currentValue || 0) / Number(m.targetValue)) * 100) : 0
          doc.text(`${m.projectName || '—'}  |  ${m.title}  |  ${pct}% (${m.currentValue || 0}/${m.targetValue || 0} ${m.unit || ''})  |  ${m.status || 'IN_PROGRESS'}`)
        }
      }

      if (section === 'deliverables') {
        const deliverables = await prisma.$queryRawUnsafe(`
          SELECT dr.*, p.name as "projectName" FROM "DeliverableRequest" dr
          LEFT JOIN "Project" p ON p.id = dr."projectId"
          WHERE dr."projectId" IN (${validIds.map((_, i) => `$${i + 1}`).join(',')})
          ORDER BY dr."createdAt" DESC
        `, ...validIds)
        doc.text(`Total deliverable requests: ${deliverables.length}`)
        doc.moveDown()
        for (const d of deliverables) {
          doc.text(`${d.projectName || '—'}  |  ${d.title}  |  Status: ${d.status || '—'}`)
        }
      }

      if (section === 'seals') {
        const sealCount = await prisma.trustSeal.count({
          where: { tenantId: { in: projects.map(p => p.tenantId || '') }, createdAt: { gte: from, lte: to } }
        })
        doc.text(`Total sealed documents: ${sealCount}`)
        const byStatus = await prisma.trustSeal.groupBy({
          by: ['status'],
          where: { createdAt: { gte: from, lte: to } },
          _count: true
        })
        for (const s of byStatus) {
          doc.text(`  ${s.status}: ${s._count}`)
        }
      }

      if (section === 'fraud') {
        const fraudStats = await prisma.expense.groupBy({
          by: ['fraudRiskLevel'],
          where: { projectId: { in: validIds }, createdAt: { gte: from, lte: to }, fraudRiskLevel: { not: null } },
          _count: true
        })
        doc.text('Fraud Risk Distribution:')
        for (const f of fraudStats) {
          doc.text(`  ${f.fraudRiskLevel}: ${f._count} expenses`)
        }
      }

      if (section === 'funding') {
        const agreements = await prisma.fundingAgreement.findMany({
          where: { donorOrgId, budgetId: { not: null } },
          select: { title: true, totalAmount: true, currency: true, type: true, status: true }
        })
        doc.text(`Total funding agreements: ${agreements.length}`)
        doc.moveDown()
        for (const a of agreements) {
          doc.text(`${a.title}  |  ${a.currency || 'USD'} ${Number(a.totalAmount || 0).toLocaleString()}  |  ${a.type || '—'}  |  ${a.status || '—'}`)
        }
      }
    }

    // Footer on last page
    doc.moveDown(2)
    doc.fontSize(9).fillColor('#999')
    doc.text('Generated by Sealayer.io — Blockchain-verified transparency', { align: 'center' })

    // Finalize
    const pdfPromise = new Promise(resolve => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
    })
    doc.end()
    const pdfBuffer = await pdfPromise

    // Upload to S3
    const { fileUrl, key } = await uploadToS3(pdfBuffer, `${name.replace(/[^a-z0-9]/gi, '_')}.pdf`, `reports/${donorOrgId}`)

    // Save report config
    const saved = await prisma.$queryRawUnsafe(`
      INSERT INTO "SavedReport" ("donorOrgId", "donorMemberId", name, "reportConfig", "lastGeneratedAt")
      VALUES ($1, $2, $3, $4::jsonb, NOW())
      RETURNING *
    `, donorOrgId, donorMemberId, name, JSON.stringify({ dateRange: { from, to }, projectIds: validIds, sections: mappedSections }))

    // Generate presigned URL for download
    const reportUrl = await getPresignedUrl(key)

    res.json({ reportUrl, downloadUrl: reportUrl, savedReportId: saved[0]?.id, fileUrl })
  } catch (err) {
    console.error('Generate report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// GET /api/donor/reports/saved
router.get('/saved', donorAuth, async (req, res) => {
  try {
    const reports = await prisma.$queryRawUnsafe(`
      SELECT * FROM "SavedReport"
      WHERE "donorOrgId" = $1
      ORDER BY "createdAt" DESC
    `, req.donor.donorOrgId)

    // Map reportConfig fields to top-level for frontend compatibility
    const mapped = reports.map(r => {
      const config = typeof r.reportConfig === 'string' ? JSON.parse(r.reportConfig) : (r.reportConfig || {})
      return {
        ...r,
        projects: config.projectIds || [],
        sections: config.sections || [],
      }
    })

    res.json({ reports: mapped })
  } catch (err) {
    console.error('Get saved reports error:', err)
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

function sectionTitle(section) {
  const titles = {
    expenses: 'Expense Summary',
    budget: 'Budget vs Actual',
    milestones: 'Impact Milestones',
    deliverables: 'Deliverable Requests',
    seals: 'Blockchain Seals',
    fraud: 'Fraud Risk Summary',
    funding: 'Funding Breakdown'
  }
  return titles[section] || section
}

module.exports = router
