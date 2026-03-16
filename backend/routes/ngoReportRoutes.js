// ─────────────────────────────────────────────────────────────
//  routes/ngoReportRoutes.js — NGO Report Generation (Sprint 8)
//
//  Mounted at /api/ngo/reports with authenticate + tenantScope.
//  Generates branded PDFs: monthly, quarterly, interim, closing,
//  annual, USAID SF-425, World Bank IFR/FMR.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const reportEngine = require('../services/reportEngine')

// ── GET / — list reports ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { type, projectId, limit } = req.query
    const max = Math.min(parseInt(limit) || 50, 200)

    let sql = `SELECT gr.*, p.name as "projectName"
      FROM "GeneratedReport" gr
      LEFT JOIN "Project" p ON p.id = gr."projectId"
      WHERE gr."tenantId" = $1`
    const params = [tenantId]
    let idx = 2

    if (type) {
      sql += ` AND gr."reportType" = $${idx++}`
      params.push(type)
    }
    if (projectId) {
      sql += ` AND gr."projectId" = $${idx++}`
      params.push(projectId)
    }

    sql += ` ORDER BY gr."createdAt" DESC LIMIT $${idx}`
    params.push(max)

    const rows = await prisma.$queryRawUnsafe(sql, ...params)
    // Map DB columns to frontend Report interface
    const reports = rows.map(r => ({
      id: r.id,
      type: r.reportType,
      projectName: r.projectName || r.name,
      projectId: r.projectId,
      periodStart: r.dateRangeFrom,
      periodEnd: r.dateRangeTo,
      generatedAt: r.createdAt,
      size: r.fileSizeBytes || 0,
      sealStatus: r.hash ? 'anchored' : r.status === 'READY' ? 'sealing' : 'pending',
      downloadUrl: r.fileUrl,
      sha256: r.hash,
    }))
    res.json({ reports })
  } catch (err) {
    console.error('List reports error:', err)
    res.status(500).json({ error: 'Failed to list reports' })
  }
})

// ── Helpers ──────────────────────────────────────────────────

function monthRange(month, year) {
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 1)
  return { from, to }
}

function quarterRange(quarter, year) {
  const startMonth = (quarter - 1) * 3
  const from = new Date(year, startMonth, 1)
  const to = new Date(year, startMonth + 3, 1)
  return { from, to }
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

async function fetchProjectData(projectId, tenantId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM "Project" WHERE id = $1 AND "tenantId" = $2`, projectId, tenantId
  )
  return rows[0] || null
}

async function fetchExpenses(projectId, tenantId, from, to) {
  return prisma.$queryRawUnsafe(`
    SELECT * FROM "Expense"
    WHERE "projectId" = $1 AND "tenantId" = $2
      AND date >= $3 AND date < $4
      AND status = 'APPROVED'
    ORDER BY date ASC
  `, projectId, tenantId, from, to)
}

async function fetchExpenseTotals(projectId, tenantId, from, to) {
  return prisma.$queryRawUnsafe(`
    SELECT category, COUNT(*)::int as count, SUM(amount)::float as total
    FROM "Expense"
    WHERE "projectId" = $1 AND "tenantId" = $2
      AND date >= $3 AND date < $4
      AND status = 'APPROVED'
    GROUP BY category
    ORDER BY total DESC
  `, projectId, tenantId, from, to)
}

async function fetchTopVendors(projectId, tenantId, from, to) {
  return prisma.$queryRawUnsafe(`
    SELECT vendor, COUNT(*)::int as count, SUM(amount)::float as total
    FROM "Expense"
    WHERE "projectId" = $1 AND "tenantId" = $2
      AND date >= $3 AND date < $4
      AND status = 'APPROVED' AND vendor IS NOT NULL
    GROUP BY vendor
    ORDER BY total DESC
    LIMIT 5
  `, projectId, tenantId, from, to)
}

async function fetchMilestones(projectId, tenantId) {
  return prisma.$queryRawUnsafe(`
    SELECT * FROM "ImpactMilestone"
    WHERE "projectId" = $1 AND "tenantId" = $2
    ORDER BY "createdAt" ASC
  `, projectId, tenantId)
}

async function fetchDeliverables(projectId, tenantId) {
  return prisma.$queryRawUnsafe(`
    SELECT * FROM "DeliverableRequest"
    WHERE "projectId" = $1 AND "tenantId" = $2
    ORDER BY "createdAt" ASC
  `, projectId, tenantId)
}

async function fetchSeals(projectId, tenantId, from, to) {
  return prisma.$queryRawUnsafe(`
    SELECT * FROM "TrustSeal"
    WHERE "projectId" = $1 AND "tenantId" = $2
      AND "createdAt" >= $3 AND "createdAt" < $4
    ORDER BY "createdAt" ASC
  `, projectId, tenantId, from, to)
}

async function fetchFraudFlags(projectId, tenantId, from, to) {
  return prisma.$queryRawUnsafe(`
    SELECT * FROM "Expense"
    WHERE "projectId" = $1 AND "tenantId" = $2
      AND date >= $3 AND date < $4
      AND ("fraudRiskLevel" IS NOT NULL AND "fraudRiskLevel" != 'NONE')
    ORDER BY date ASC
  `, projectId, tenantId, from, to)
}

async function fetchTenant(tenantId) {
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "Tenant" WHERE id = $1`, tenantId)
  return rows[0] || null
}

async function createReportRecord(tenantId, projectId, reportType, name, dateFrom, dateTo, config, userId) {
  const rows = await prisma.$queryRawUnsafe(`
    INSERT INTO "GeneratedReport" ("tenantId", "projectId", "reportType", name, "dateRangeFrom", "dateRangeTo", "reportConfig", "generatedBy", "generatedByType", status)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'NGO', 'GENERATING')
    RETURNING *
  `, tenantId, projectId, reportType, name, dateFrom, dateTo, JSON.stringify(config || {}), userId)
  return rows[0]
}

// ── Build standard report sections ───────────────────────────

function addExecutiveSummary(doc, re, project, expenses, categoryTotals, from, to) {
  re.addSectionHeader(doc, 'Executive Summary')
  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const budget = Number(project.budget || 0)

  let y = doc.y
  y = re.addKeyValue(doc, 'Project', project.name, 50, y)
  y = re.addKeyValue(doc, 'Status', project.status || 'ACTIVE', 50, y)
  y = re.addKeyValue(doc, 'Budget', re.formatCurrency(budget, project.currency), 50, y)
  y = re.addKeyValue(doc, 'Spent (period)', re.formatCurrency(totalSpent, project.currency), 50, y)
  y = re.addKeyValue(doc, 'Remaining', re.formatCurrency(budget - totalSpent, project.currency), 50, y)
  y = re.addKeyValue(doc, 'Transactions', String(expenses.length), 50, y)
  doc.y = y + 10

  if (budget > 0) {
    re.addProgressBar(doc, 'Budget utilization', totalSpent, budget, 50, doc.y, 300)
  }
}

function addFinancialSummary(doc, re, categoryTotals, currency) {
  re.addSectionHeader(doc, 'Financial Summary', 'Breakdown by category')
  if (categoryTotals.length === 0) {
    doc.text('No approved expenses in this period.')
    return
  }
  const headers = ['Category', 'Transactions', 'Total Amount']
  const rows = categoryTotals.map(c => [c.category || 'Uncategorized', String(c.count), re.formatCurrency(c.total, currency)])
  re.addTable(doc, headers, rows, { colWidths: [200, 100, 195] })
}

function addExpenseDetail(doc, re, expenses, currency) {
  re.addSectionHeader(doc, 'Expense Detail', `${expenses.length} approved transactions`)
  if (expenses.length === 0) {
    doc.text('No approved expenses in this period.')
    return
  }
  const headers = ['Date', 'Vendor', 'Category', 'Amount', 'Status']
  const rows = expenses.slice(0, 200).map(e => [
    re.formatDate(e.date),
    e.vendor || '—',
    e.category || '—',
    re.formatCurrency(e.amount, currency),
    e.status || '—',
  ])
  re.addTable(doc, headers, rows, { colWidths: [80, 120, 100, 100, 95] })
  if (expenses.length > 200) {
    doc.fontSize(8).fillColor('#6B7280').text(`... and ${expenses.length - 200} more transactions (see full data export)`)
  }
}

function addTopVendors(doc, re, vendors, currency) {
  re.addSectionHeader(doc, 'Top Vendors', 'Top 5 vendors by spend')
  if (vendors.length === 0) {
    doc.text('No vendor data available.')
    return
  }
  const headers = ['Vendor', 'Transactions', 'Total']
  const rows = vendors.map(v => [v.vendor, String(v.count), re.formatCurrency(v.total, currency)])
  re.addTable(doc, headers, rows, { colWidths: [220, 100, 175] })
}

function addDeliverables(doc, re, deliverables) {
  re.addSectionHeader(doc, 'Deliverables')
  if (deliverables.length === 0) {
    doc.text('No deliverable requests recorded.')
    return
  }
  const headers = ['Title', 'Status', 'Deadline', 'Submitted']
  const rows = deliverables.map(d => [
    d.title || '—',
    d.status || '—',
    re.formatDate(d.deadline),
    re.formatDate(d.submittedAt),
  ])
  re.addTable(doc, headers, rows, { colWidths: [200, 80, 110, 105] })
}

function addMilestones(doc, re, milestones) {
  re.addSectionHeader(doc, 'Impact Milestones')
  if (milestones.length === 0) {
    doc.text('No impact milestones recorded.')
    return
  }
  const headers = ['Title', 'Target', 'Actual', 'Status']
  const rows = milestones.map(m => [
    m.title || '—',
    String(m.targetValue ?? '—'),
    String(m.actualValue ?? '—'),
    m.status || '—',
  ])
  re.addTable(doc, headers, rows, { colWidths: [200, 90, 90, 115] })
}

function addBlockchainVerification(doc, re, seals) {
  re.addSectionHeader(doc, 'Blockchain Verification', 'Trust seals issued this period')
  if (seals.length === 0) {
    doc.text('No trust seals issued in this period.')
    return
  }
  const headers = ['Seal ID', 'Status', 'Issued', 'Score']
  const rows = seals.map(s => [
    (s.id || '').substring(0, 12) + '...',
    s.status || '—',
    re.formatDate(s.createdAt),
    String(s.trustScore ?? '—'),
  ])
  re.addTable(doc, headers, rows, { colWidths: [160, 100, 120, 115] })
}

function addFraudSummary(doc, re, flaggedExpenses, currency) {
  re.addSectionHeader(doc, 'Fraud Risk Summary')
  if (flaggedExpenses.length === 0) {
    doc.fontSize(10).fillColor('#166534').text('No fraud flags detected in this period.')
    return
  }
  doc.fontSize(10).fillColor('#991B1B').text(`${flaggedExpenses.length} expense(s) flagged for review`)
  doc.moveDown(0.5)
  const headers = ['Date', 'Vendor', 'Amount', 'Risk Level']
  const rows = flaggedExpenses.map(e => [
    re.formatDate(e.date),
    e.vendor || '—',
    re.formatCurrency(e.amount, currency),
    e.fraudRiskLevel || '—',
  ])
  re.addTable(doc, headers, rows, { colWidths: [100, 150, 120, 125] })
}

// ── POST /generate/monthly ──────────────────────────────────
router.post('/generate/monthly', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId, month, year } = req.body
    if (!projectId || !month || !year) return res.status(400).json({ error: 'projectId, month, year required' })

    const project = await fetchProjectData(projectId, tenantId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const tenant = await fetchTenant(tenantId)
    const { from, to } = monthRange(month, year)
    const reportName = `${project.name} — ${MONTH_NAMES[month - 1]} ${year} Monthly Report`

    const report = await createReportRecord(tenantId, projectId, 'MONTHLY', reportName, from, to, { month, year }, req.user.id)

    // Fetch data
    const [expenses, categoryTotals, vendors, milestones, deliverables, seals, flagged] = await Promise.all([
      fetchExpenses(projectId, tenantId, from, to),
      fetchExpenseTotals(projectId, tenantId, from, to),
      fetchTopVendors(projectId, tenantId, from, to),
      fetchMilestones(projectId, tenantId),
      fetchDeliverables(projectId, tenantId),
      fetchSeals(projectId, tenantId, from, to),
      fetchFraudFlags(projectId, tenantId, from, to),
    ])

    const currency = project.currency || 'USD'
    const re = reportEngine

    // Build PDF
    const doc = re.createDoc({ title: reportName })
    re.addCoverPage(doc, {
      reportType: 'Monthly Report',
      projectName: project.name,
      orgName: tenant?.name || '',
      dateRange: `${MONTH_NAMES[month - 1]} ${year}`,
    })

    doc.addPage()
    addExecutiveSummary(doc, re, project, expenses, categoryTotals, from, to)
    addFinancialSummary(doc, re, categoryTotals, currency)
    addTopVendors(doc, re, vendors, currency)

    doc.addPage()
    addExpenseDetail(doc, re, expenses, currency)

    doc.addPage()
    addDeliverables(doc, re, deliverables)
    addMilestones(doc, re, milestones)

    doc.addPage()
    addBlockchainVerification(doc, re, seals)
    addFraudSummary(doc, re, flagged, currency)

    re.addFooters(doc, null)
    const buffer = await re.generateBuffer(doc)
    const result = await re.uploadAndSave(buffer, report.id, tenantId)
    const presignedUrl = await re.getPresignedUrl(result.fileKey)

    // Update footers with hash
    // (hash already saved in uploadAndSave)

    res.json({ reportId: report.id, downloadUrl: presignedUrl })
  } catch (err) {
    console.error('Generate monthly report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// ── POST /generate/quarterly ─────────────────────────────────
router.post('/generate/quarterly', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId, quarter, year } = req.body
    if (!projectId || !quarter || !year) return res.status(400).json({ error: 'projectId, quarter, year required' })
    if (quarter < 1 || quarter > 4) return res.status(400).json({ error: 'quarter must be 1-4' })

    const project = await fetchProjectData(projectId, tenantId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const tenant = await fetchTenant(tenantId)
    const { from, to } = quarterRange(quarter, year)
    const reportName = `${project.name} — Q${quarter} ${year} Quarterly Report`

    const report = await createReportRecord(tenantId, projectId, 'QUARTERLY', reportName, from, to, { quarter, year }, req.user.id)

    // Current quarter data
    const [expenses, categoryTotals, vendors, milestones, deliverables, seals, flagged] = await Promise.all([
      fetchExpenses(projectId, tenantId, from, to),
      fetchExpenseTotals(projectId, tenantId, from, to),
      fetchTopVendors(projectId, tenantId, from, to),
      fetchMilestones(projectId, tenantId),
      fetchDeliverables(projectId, tenantId),
      fetchSeals(projectId, tenantId, from, to),
      fetchFraudFlags(projectId, tenantId, from, to),
    ])

    // Previous quarter for comparison
    const prevQ = quarter === 1 ? 4 : quarter - 1
    const prevYear = quarter === 1 ? year - 1 : year
    const prev = quarterRange(prevQ, prevYear)
    const [prevExpenses, prevCategoryTotals] = await Promise.all([
      fetchExpenses(projectId, tenantId, prev.from, prev.to),
      fetchExpenseTotals(projectId, tenantId, prev.from, prev.to),
    ])

    const currency = project.currency || 'USD'
    const re = reportEngine

    const doc = re.createDoc({ title: reportName })
    re.addCoverPage(doc, {
      reportType: 'Quarterly Report',
      projectName: project.name,
      orgName: tenant?.name || '',
      dateRange: `Q${quarter} ${year}`,
    })

    doc.addPage()
    addExecutiveSummary(doc, re, project, expenses, categoryTotals, from, to)

    // Quarter-over-quarter comparison
    re.addSectionHeader(doc, 'Quarter-over-Quarter Comparison', `Q${quarter} ${year} vs Q${prevQ} ${prevYear}`)
    const curTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const prevTotal = prevExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const change = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal * 100).toFixed(1) : 'N/A'
    const headers = ['Metric', `Q${prevQ} ${prevYear}`, `Q${quarter} ${year}`, 'Change']
    const compRows = [
      ['Total Spend', re.formatCurrency(prevTotal, currency), re.formatCurrency(curTotal, currency), typeof change === 'string' ? change : `${change}%`],
      ['Transactions', String(prevExpenses.length), String(expenses.length), prevExpenses.length > 0 ? `${((expenses.length - prevExpenses.length) / prevExpenses.length * 100).toFixed(1)}%` : 'N/A'],
    ]
    re.addTable(doc, headers, compRows, { colWidths: [130, 120, 120, 125] })

    addFinancialSummary(doc, re, categoryTotals, currency)
    addTopVendors(doc, re, vendors, currency)

    doc.addPage()
    addExpenseDetail(doc, re, expenses, currency)

    doc.addPage()
    addDeliverables(doc, re, deliverables)
    addMilestones(doc, re, milestones)

    doc.addPage()
    addBlockchainVerification(doc, re, seals)
    addFraudSummary(doc, re, flagged, currency)

    re.addFooters(doc, null)
    const buffer = await re.generateBuffer(doc)
    const result = await re.uploadAndSave(buffer, report.id, tenantId)
    const presignedUrl = await re.getPresignedUrl(result.fileKey)

    res.json({ reportId: report.id, downloadUrl: presignedUrl })
  } catch (err) {
    console.error('Generate quarterly report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// ── POST /generate/interim ───────────────────────────────────
router.post('/generate/interim', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId, dateFrom, dateTo, notes } = req.body
    if (!projectId || !dateFrom || !dateTo) return res.status(400).json({ error: 'projectId, dateFrom, dateTo required' })

    const project = await fetchProjectData(projectId, tenantId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const tenant = await fetchTenant(tenantId)
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    const reportName = `${project.name} — Interim Report (${reportEngine.formatDate(from)} to ${reportEngine.formatDate(to)})`

    const report = await createReportRecord(tenantId, projectId, 'INTERIM', reportName, from, to, { notes }, req.user.id)

    const [expenses, categoryTotals, vendors, milestones, deliverables, seals, flagged] = await Promise.all([
      fetchExpenses(projectId, tenantId, from, to),
      fetchExpenseTotals(projectId, tenantId, from, to),
      fetchTopVendors(projectId, tenantId, from, to),
      fetchMilestones(projectId, tenantId),
      fetchDeliverables(projectId, tenantId),
      fetchSeals(projectId, tenantId, from, to),
      fetchFraudFlags(projectId, tenantId, from, to),
    ])

    const currency = project.currency || 'USD'
    const re = reportEngine

    const doc = re.createDoc({ title: reportName })
    re.addCoverPage(doc, {
      reportType: 'Interim Report',
      projectName: project.name,
      orgName: tenant?.name || '',
      dateRange: `${re.formatDate(from)} — ${re.formatDate(to)}`,
    })

    doc.addPage()
    addExecutiveSummary(doc, re, project, expenses, categoryTotals, from, to)

    // Notes section
    if (notes) {
      re.addSectionHeader(doc, 'Notes')
      doc.fontSize(10).fillColor('#26215C').text(notes, 50, doc.y, { width: doc.page.width - 100 })
    }

    addFinancialSummary(doc, re, categoryTotals, currency)
    addTopVendors(doc, re, vendors, currency)

    doc.addPage()
    addExpenseDetail(doc, re, expenses, currency)

    doc.addPage()
    addDeliverables(doc, re, deliverables)
    addMilestones(doc, re, milestones)

    doc.addPage()
    addBlockchainVerification(doc, re, seals)
    addFraudSummary(doc, re, flagged, currency)

    re.addFooters(doc, null)
    const buffer = await re.generateBuffer(doc)
    const result = await re.uploadAndSave(buffer, report.id, tenantId)
    const presignedUrl = await re.getPresignedUrl(result.fileKey)

    res.json({ reportId: report.id, downloadUrl: presignedUrl })
  } catch (err) {
    console.error('Generate interim report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// ── POST /generate/closing ───────────────────────────────────
router.post('/generate/closing', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId } = req.body
    if (!projectId) return res.status(400).json({ error: 'projectId required' })

    const project = await fetchProjectData(projectId, tenantId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const tenant = await fetchTenant(tenantId)
    const from = project.startDate ? new Date(project.startDate) : new Date('2020-01-01')
    const to = new Date()
    const reportName = `${project.name} — Project Closeout Report`

    const report = await createReportRecord(tenantId, projectId, 'CLOSING', reportName, from, to, {}, req.user.id)

    const [expenses, categoryTotals, vendors, milestones, deliverables, seals, flagged] = await Promise.all([
      fetchExpenses(projectId, tenantId, from, to),
      fetchExpenseTotals(projectId, tenantId, from, to),
      fetchTopVendors(projectId, tenantId, from, to),
      fetchMilestones(projectId, tenantId),
      fetchDeliverables(projectId, tenantId),
      fetchSeals(projectId, tenantId, from, to),
      fetchFraudFlags(projectId, tenantId, from, to),
    ])

    // All-time funding
    const fundingRows = await prisma.$queryRawUnsafe(`
      SELECT SUM(amount)::float as total FROM "FundingSource" WHERE "projectId" = $1 AND "tenantId" = $2
    `, projectId, tenantId)
    const totalFunded = fundingRows[0]?.total || 0

    const currency = project.currency || 'USD'
    const re = reportEngine

    const doc = re.createDoc({ title: reportName })
    re.addCoverPage(doc, {
      reportType: 'Project Closeout Report',
      projectName: project.name,
      orgName: tenant?.name || '',
      dateRange: `${re.formatDate(from)} — ${re.formatDate(to)}`,
    })

    doc.addPage()
    re.addSectionHeader(doc, 'Project Overview')
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    let y = doc.y
    y = re.addKeyValue(doc, 'Project Name', project.name, 50, y)
    y = re.addKeyValue(doc, 'Status', project.status || '—', 50, y)
    y = re.addKeyValue(doc, 'Start Date', re.formatDate(project.startDate), 50, y)
    y = re.addKeyValue(doc, 'End Date', re.formatDate(project.endDate), 50, y)
    y = re.addKeyValue(doc, 'Total Budget', re.formatCurrency(project.budget, currency), 50, y)
    y = re.addKeyValue(doc, 'Total Funded', re.formatCurrency(totalFunded, currency), 50, y)
    y = re.addKeyValue(doc, 'Total Spent', re.formatCurrency(totalSpent, currency), 50, y)
    y = re.addKeyValue(doc, 'Remaining', re.formatCurrency(Number(project.budget || 0) - totalSpent, currency), 50, y)
    y = re.addKeyValue(doc, 'Total Transactions', String(expenses.length), 50, y)
    doc.y = y + 10

    addFinancialSummary(doc, re, categoryTotals, currency)
    addTopVendors(doc, re, vendors, currency)

    doc.addPage()
    addExpenseDetail(doc, re, expenses, currency)

    doc.addPage()
    addDeliverables(doc, re, deliverables)
    addMilestones(doc, re, milestones)

    doc.addPage()
    addBlockchainVerification(doc, re, seals)
    addFraudSummary(doc, re, flagged, currency)

    re.addFooters(doc, null)
    const buffer = await re.generateBuffer(doc)
    const result = await re.uploadAndSave(buffer, report.id, tenantId)
    const presignedUrl = await re.getPresignedUrl(result.fileKey)

    res.json({ reportId: report.id, downloadUrl: presignedUrl })
  } catch (err) {
    console.error('Generate closing report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// ── POST /generate/annual ────────────────────────────────────
router.post('/generate/annual', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { year } = req.body
    if (!year) return res.status(400).json({ error: 'year required' })

    const tenant = await fetchTenant(tenantId)
    const from = new Date(year, 0, 1)
    const to = new Date(year + 1, 0, 1)
    const reportName = `${tenant?.name || 'Organisation'} — ${year} Annual Report`

    const report = await createReportRecord(tenantId, null, 'ANNUAL', reportName, from, to, { year }, req.user.id)

    // All projects for tenant
    const projects = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Project" WHERE "tenantId" = $1 ORDER BY name ASC`, tenantId
    )

    const re = reportEngine
    const doc = re.createDoc({ title: reportName })
    re.addCoverPage(doc, {
      reportType: 'Annual Report',
      orgName: tenant?.name || '',
      dateRange: `January — December ${year}`,
    })

    // Organisation-wide summary
    doc.addPage()
    re.addSectionHeader(doc, 'Organisation Summary', `${year} Annual Overview`)

    let orgTotalSpent = 0
    let orgTotalBudget = 0
    let orgTotalTransactions = 0
    const projectSummaries = []

    for (const project of projects) {
      const expenses = await fetchExpenses(project.id, tenantId, from, to)
      const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
      orgTotalSpent += totalSpent
      orgTotalBudget += Number(project.budget || 0)
      orgTotalTransactions += expenses.length
      projectSummaries.push({
        name: project.name,
        budget: Number(project.budget || 0),
        spent: totalSpent,
        transactions: expenses.length,
        status: project.status || 'ACTIVE',
        currency: project.currency || 'USD',
      })
    }

    let y = doc.y
    y = re.addKeyValue(doc, 'Total Projects', String(projects.length), 50, y)
    y = re.addKeyValue(doc, 'Total Budget', re.formatCurrency(orgTotalBudget), 50, y)
    y = re.addKeyValue(doc, 'Total Spent', re.formatCurrency(orgTotalSpent), 50, y)
    y = re.addKeyValue(doc, 'Total Transactions', String(orgTotalTransactions), 50, y)
    doc.y = y + 10

    // Per-project summary table
    re.addSectionHeader(doc, 'Project Summaries')
    const headers = ['Project', 'Status', 'Budget', 'Spent', 'Txns']
    const rows = projectSummaries.map(p => [
      p.name, p.status, re.formatCurrency(p.budget, p.currency), re.formatCurrency(p.spent, p.currency), String(p.transactions),
    ])
    re.addTable(doc, headers, rows, { colWidths: [150, 70, 100, 100, 75] })

    // Per-project detail pages
    for (const project of projects) {
      const [expenses, categoryTotals, flagged] = await Promise.all([
        fetchExpenses(project.id, tenantId, from, to),
        fetchExpenseTotals(project.id, tenantId, from, to),
        fetchFraudFlags(project.id, tenantId, from, to),
      ])

      if (expenses.length === 0 && flagged.length === 0) continue

      const currency = project.currency || 'USD'
      doc.addPage()
      re.addSectionHeader(doc, project.name, `${year} detail`)
      addFinancialSummary(doc, re, categoryTotals, currency)
      if (flagged.length > 0) addFraudSummary(doc, re, flagged, currency)
    }

    re.addFooters(doc, null)
    const buffer = await re.generateBuffer(doc)
    const result = await re.uploadAndSave(buffer, report.id, tenantId)
    const presignedUrl = await re.getPresignedUrl(result.fileKey)

    res.json({ reportId: report.id, downloadUrl: presignedUrl })
  } catch (err) {
    console.error('Generate annual report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// ── POST /generate/usaid-sf425 ───────────────────────────────
router.post('/generate/usaid-sf425', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const {
      projectId, dateFrom, dateTo, federalGrantNumber, reportType,
      recipientAccountNumber, unliquidatedObligations, programIncomeReceived,
      programIncomeExpended, indirectExpenseAmount, remarks,
      certifyingName, certifyingTitle, certifyingPhone, certifyingEmail, certifyingDate,
    } = req.body
    if (!projectId || !dateFrom || !dateTo) return res.status(400).json({ error: 'projectId, dateFrom, dateTo required' })

    const project = await fetchProjectData(projectId, tenantId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const tenant = await fetchTenant(tenantId)
    const from = new Date(dateFrom)
    const to = new Date(dateTo)

    // Fetch GrantReportingConfig
    const configRows = await prisma.$queryRawUnsafe(`SELECT * FROM "GrantReportingConfig" WHERE "tenantId" = $1`, tenantId)
    const grc = configRows[0] || {}

    const reportName = `SF-425 — ${project.name} (${reportEngine.formatDate(from)} to ${reportEngine.formatDate(to)})`
    const report = await createReportRecord(tenantId, projectId, 'USAID_SF425', reportName, from, to, { federalGrantNumber, reportType }, req.user.id)

    // Fetch expense data
    const expenses = await fetchExpenses(projectId, tenantId, from, to)
    const totalSpentPeriod = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)

    // All-time expenses for cumulative
    const allExpenses = await prisma.$queryRawUnsafe(`
      SELECT SUM(amount)::float as total FROM "Expense"
      WHERE "projectId" = $1 AND "tenantId" = $2 AND status = 'APPROVED'
    `, projectId, tenantId)
    const cumulativeSpent = allExpenses[0]?.total || 0

    // Funding
    const fundingRows = await prisma.$queryRawUnsafe(`
      SELECT SUM(amount)::float as total FROM "FundingSource" WHERE "projectId" = $1 AND "tenantId" = $2
    `, projectId, tenantId)
    const totalFederalFunds = fundingRows[0]?.total || 0

    const re = reportEngine
    const doc = re.createDoc({ title: reportName })
    const fmt = re.formatCurrency.bind(re)
    const currency = project.currency || 'USD'

    // SF-425 form layout
    // Header
    doc.rect(0, 0, doc.page.width, 60).fill('#3C3489')
    doc.fontSize(8).fillColor('#FFFFFF').text('OMB Approval No. 4040-0014', 50, 15)
    doc.fontSize(16).fillColor('#FFFFFF').text('Federal Financial Report', 50, 28, { align: 'center' })
    doc.fontSize(8).fillColor('#FFFFFFAA').text('(Follow form instructions)', 50, 48, { align: 'center' })

    doc.fillColor('#26215C')
    let sy = 75

    // Section 1-3: Federal Agency, Grant Number, Recipient
    const boxH = 35
    function drawBox(label, value, x, yy, w) {
      doc.rect(x, yy, w, boxH).stroke('#CCCCCC')
      doc.fontSize(7).fillColor('#6B7280').text(label, x + 4, yy + 3, { width: w - 8 })
      doc.fontSize(9).fillColor('#26215C').text(String(value || '—'), x + 4, yy + 15, { width: w - 8 })
    }

    const pw = doc.page.width - 100
    drawBox('1. Federal Agency and Organizational Element', grc.federalAgencyName || '—', 50, sy, pw / 2)
    drawBox('2. Federal Grant or Other Identifying Number', federalGrantNumber || project.name, 50 + pw / 2, sy, pw / 2)
    sy += boxH + 5

    drawBox('3. Recipient Organization (Name and address)', `${grc.legalName || tenant?.name || '—'}\n${grc.registeredAddress || ''}`, 50, sy, pw)
    sy += boxH + 5

    drawBox('4a. UEI Number', grc.ueiNumber || '—', 50, sy, pw / 3)
    drawBox('4b. EIN', grc.ein || '—', 50 + pw / 3, sy, pw / 3)
    drawBox('5. Recipient Account Number', recipientAccountNumber || '—', 50 + 2 * pw / 3, sy, pw / 3)
    sy += boxH + 5

    drawBox('6. Report Type', reportType || 'Quarterly', 50, sy, pw / 3)
    drawBox('7. Basis of Accounting', grc.basisOfAccounting || 'Accrual', 50 + pw / 3, sy, pw / 3)
    drawBox('8. Project/Grant Period', `${re.formatDate(project.startDate)} to ${re.formatDate(project.endDate)}`, 50 + 2 * pw / 3, sy, pw / 3)
    sy += boxH + 5

    drawBox('9. Reporting Period', `${re.formatDate(from)} to ${re.formatDate(to)}`, 50, sy, pw)
    sy += boxH + 10

    // Section 10: Financial transactions
    doc.fontSize(11).fillColor('#3C3489').text('10. Transactions', 50, sy)
    sy += 18

    const indirectAmt = Number(indirectExpenseAmount || 0)
    const unliqObl = Number(unliquidatedObligations || 0)
    const piReceived = Number(programIncomeReceived || 0)
    const piExpended = Number(programIncomeExpended || 0)
    const totalFederalShare = cumulativeSpent
    const unobligatedBalance = totalFederalFunds - cumulativeSpent - unliqObl

    const lines = [
      ['a', 'Cash Receipts (federal funds)', fmt(totalFederalFunds, currency)],
      ['b', 'Cash Disbursements (federal funds)', fmt(cumulativeSpent, currency)],
      ['c', 'Cash on Hand (line a minus b)', fmt(totalFederalFunds - cumulativeSpent, currency)],
      ['d', 'Total Federal Funds Authorized', fmt(totalFederalFunds, currency)],
      ['e', 'Federal Share of Expenditures', fmt(totalFederalShare, currency)],
      ['f', 'Federal Share of Unliquidated Obligations', fmt(unliqObl, currency)],
      ['g', 'Total Federal Share (e + f)', fmt(totalFederalShare + unliqObl, currency)],
      ['h', 'Unobligated Balance of Federal Funds (d - g)', fmt(unobligatedBalance, currency)],
      ['i', 'Total Recipient Share Required', '—'],
      ['j', 'Recipient Share of Expenditures', '—'],
      ['k', 'Remaining Recipient Share to be Provided', '—'],
      ['l', 'Total Federal Program Income Earned', fmt(piReceived, currency)],
      ['m', 'Program Income Expended per Deduction Alternative', fmt(piExpended, currency)],
      ['n', 'Program Income Expended per Addition Alternative', '—'],
      ['o', 'Unexpended Program Income (l - m - n)', fmt(piReceived - piExpended, currency)],
    ]

    for (const [letter, desc, val] of lines) {
      doc.fontSize(8).fillColor('#6B7280').text(`${letter}.`, 50, sy, { width: 15 })
      doc.fontSize(8).fillColor('#26215C').text(desc, 65, sy, { width: 300 })
      doc.fontSize(9).fillColor('#26215C').text(val, 380, sy, { width: 150, align: 'right' })
      sy += 16
      if (sy > doc.page.height - 120) { doc.addPage(); sy = 50 }
    }

    sy += 10

    // Section 11: Indirect Expense
    doc.fontSize(11).fillColor('#3C3489').text('11. Indirect Expense', 50, sy)
    sy += 18
    doc.fontSize(8).fillColor('#26215C')
    doc.text(`Type: ${grc.indirectExpenseType || '—'}`, 50, sy)
    doc.text(`Rate: ${grc.indirectExpenseRate || '—'}%`, 200, sy)
    doc.text(`Amount: ${fmt(indirectAmt, currency)}`, 350, sy)
    sy += 20

    // Section 12: Remarks
    doc.fontSize(11).fillColor('#3C3489').text('12. Remarks', 50, sy)
    sy += 18
    doc.fontSize(8).fillColor('#26215C').text(remarks || 'No remarks.', 50, sy, { width: pw })
    sy += 30

    // Section 13: Certification
    if (sy > doc.page.height - 150) { doc.addPage(); sy = 50 }
    doc.fontSize(11).fillColor('#3C3489').text('13. Certification', 50, sy)
    sy += 18
    doc.fontSize(7).fillColor('#6B7280').text(
      'By signing this report, I certify to the best of my knowledge and belief that the report is true, complete, and accurate, and the expenditures, disbursements and cash receipts are for the purposes and objectives set forth in the terms and conditions of the Federal award.',
      50, sy, { width: pw }
    )
    sy += 40

    drawBox('a. Typed or Printed Name and Title', `${certifyingName || grc.legalRepName || '—'}, ${certifyingTitle || grc.legalRepTitle || '—'}`, 50, sy, pw / 2)
    drawBox('b. Signature', '(electronically signed)', 50 + pw / 2, sy, pw / 2)
    sy += boxH + 5
    drawBox('c. Telephone', certifyingPhone || grc.legalRepPhone || '—', 50, sy, pw / 3)
    drawBox('d. Email', certifyingEmail || grc.legalRepEmail || '—', 50 + pw / 3, sy, pw / 3)
    drawBox('e. Date', certifyingDate || new Date().toLocaleDateString('en-GB'), 50 + 2 * pw / 3, sy, pw / 3)
    sy += boxH + 15

    // Footer
    doc.fontSize(7).fillColor('#6B7280').text('Standard Form 425 (Rev. 7/22)', 50, sy)
    doc.text('Blockchain-verified by Sealayer.io', 50, sy + 10)

    re.addFooters(doc, null)
    const buffer = await re.generateBuffer(doc)
    const result = await re.uploadAndSave(buffer, report.id, tenantId)
    const presignedUrl = await re.getPresignedUrl(result.fileKey)

    res.json({ reportId: report.id, downloadUrl: presignedUrl })
  } catch (err) {
    console.error('Generate USAID SF-425 error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// ── POST /generate/wb-procurement ────────────────────────────
router.post('/generate/wb-procurement', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const {
      projectId, dateFrom, dateTo, reportingPeriod,
      openingBalance, govCounterpartFunds, closingBalance,
      certifyingName, certifyingTitle, certifyingDate,
    } = req.body
    if (!projectId || !dateFrom || !dateTo) return res.status(400).json({ error: 'projectId, dateFrom, dateTo required' })

    const project = await fetchProjectData(projectId, tenantId)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const tenant = await fetchTenant(tenantId)
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    const reportName = `World Bank IFR — ${project.name} (${reportEngine.formatDate(from)} to ${reportEngine.formatDate(to)})`

    const report = await createReportRecord(tenantId, projectId, 'WB_PROCUREMENT', reportName, from, to, { reportingPeriod }, req.user.id)

    // Fetch data
    const expenses = await fetchExpenses(projectId, tenantId, from, to)
    const totalDisbursed = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const categoryTotals = await fetchExpenseTotals(projectId, tenantId, from, to)

    // WB Components
    const components = await prisma.$queryRawUnsafe(
      `SELECT * FROM "WBProjectComponent" WHERE "projectId" = $1 AND "tenantId" = $2 ORDER BY "createdAt"`,
      projectId, tenantId
    )

    // WB Procurement Contracts
    const contracts = await prisma.$queryRawUnsafe(
      `SELECT * FROM "WBProcurementContract" WHERE "projectId" = $1 AND "tenantId" = $2 ORDER BY "createdAt"`,
      projectId, tenantId
    )

    // Funding
    const fundingRows = await prisma.$queryRawUnsafe(`
      SELECT SUM(amount)::float as total FROM "FundingSource" WHERE "projectId" = $1 AND "tenantId" = $2
    `, projectId, tenantId)
    const totalFunds = fundingRows[0]?.total || 0

    // GrantReportingConfig
    const configRows = await prisma.$queryRawUnsafe(`SELECT * FROM "GrantReportingConfig" WHERE "tenantId" = $1`, tenantId)
    const grc = configRows[0] || {}

    const re = reportEngine
    const currency = project.currency || 'USD'
    const fmt = re.formatCurrency.bind(re)
    const doc = re.createDoc({ title: reportName })

    // Cover
    re.addCoverPage(doc, {
      reportType: 'World Bank IFR/FMR',
      projectName: project.name,
      orgName: tenant?.name || '',
      dateRange: `${re.formatDate(from)} — ${re.formatDate(to)}`,
    })

    // Part 1: Sources and Uses of Funds
    doc.addPage()
    re.addSectionHeader(doc, 'Part 1: Sources and Uses of Funds', reportingPeriod || `${re.formatDate(from)} to ${re.formatDate(to)}`)

    const opening = Number(openingBalance || 0)
    const govFunds = Number(govCounterpartFunds || 0)
    const closing = Number(closingBalance || 0)

    const srcHeaders = ['Item', 'Amount']
    const srcRows = [
      ['Opening Balance', fmt(opening, currency)],
      ['World Bank Disbursements', fmt(totalFunds, currency)],
      ['Government Counterpart Funds', fmt(govFunds, currency)],
      ['Total Sources', fmt(opening + totalFunds + govFunds, currency)],
      ['', ''],
      ['Expenditures This Period', fmt(totalDisbursed, currency)],
      ['Closing Balance', fmt(closing, currency)],
    ]
    re.addTable(doc, srcHeaders, srcRows, { colWidths: [300, 195] })

    // Part 2: Uses by Project Activity
    doc.addPage()
    re.addSectionHeader(doc, 'Part 2: Uses by Project Activity', 'By World Bank component')

    if (components.length > 0) {
      const compHeaders = ['Component', 'WB Budget', 'Gov Budget', 'Actual This Period', 'Cumulative']
      const compRows = components.map(c => [
        c.name || '—',
        fmt(c.wbBudget, currency),
        fmt(c.govBudget, currency),
        fmt(c.actualThisPeriod, currency),
        fmt(c.cumulativeActual, currency),
      ])
      re.addTable(doc, compHeaders, compRows, { colWidths: [130, 90, 90, 100, 85] })
    } else {
      // Fall back to category breakdown
      re.addSectionHeader(doc, 'Expenditure by Category')
      if (categoryTotals.length > 0) {
        const catHeaders = ['Category', 'Transactions', 'Amount']
        const catRows = categoryTotals.map(c => [c.category || 'Uncategorized', String(c.count), fmt(c.total, currency)])
        re.addTable(doc, catHeaders, catRows, { colWidths: [220, 100, 175] })
      } else {
        doc.text('No expenses recorded in this period.')
      }
    }

    // Part 3: Designated Account Reconciliation
    doc.addPage()
    re.addSectionHeader(doc, 'Part 3: Designated Account Reconciliation')

    const daHeaders = ['Item', 'Amount']
    const daRows = [
      ['Opening Balance', fmt(opening, currency)],
      ['Add: Advances from World Bank', fmt(totalFunds, currency)],
      ['Less: Expenditures', fmt(totalDisbursed, currency)],
      ['Closing Balance', fmt(closing, currency)],
    ]
    if (grc.designatedBankName) {
      let y = doc.y
      y = re.addKeyValue(doc, 'Bank Name', grc.designatedBankName, 50, y)
      y = re.addKeyValue(doc, 'Account Number', grc.designatedAccountNumber || '—', 50, y)
      y = re.addKeyValue(doc, 'Bank Address', grc.designatedBankAddress || '—', 50, y)
      doc.y = y + 10
    }
    re.addTable(doc, daHeaders, daRows, { colWidths: [300, 195] })

    // Part 4: Procurement Status
    doc.addPage()
    re.addSectionHeader(doc, 'Part 4: Procurement Status')

    if (contracts.length > 0) {
      const procHeaders = ['Contract Ref', 'Description', 'Method', 'Amount', 'Status']
      const procRows = contracts.map(c => [
        c.contractRef || '—',
        (c.description || '—').substring(0, 40),
        c.procurementMethod || '—',
        fmt(c.contractAmount, currency),
        c.status || '—',
      ])
      re.addTable(doc, procHeaders, procRows, { colWidths: [90, 130, 80, 100, 95] })
    } else {
      doc.text('No procurement contracts recorded.')
    }

    // Certification block
    if (doc.y > doc.page.height - 150) doc.addPage()
    re.addSectionHeader(doc, 'Certification')
    doc.fontSize(8).fillColor('#6B7280').text(
      'I certify that the information provided in this report is correct and that the expenditures were made in accordance with the Financing Agreement and applicable World Bank guidelines.',
      50, doc.y, { width: doc.page.width - 100 }
    )
    doc.moveDown(1)
    let cy = doc.y
    cy = re.addKeyValue(doc, 'Name', certifyingName || grc.legalRepName || '—', 50, cy)
    cy = re.addKeyValue(doc, 'Title', certifyingTitle || grc.legalRepTitle || '—', 50, cy)
    cy = re.addKeyValue(doc, 'Date', certifyingDate || new Date().toLocaleDateString('en-GB'), 50, cy)
    doc.y = cy

    re.addFooters(doc, null)
    const buffer = await re.generateBuffer(doc)
    const result = await re.uploadAndSave(buffer, report.id, tenantId)
    const presignedUrl = await re.getPresignedUrl(result.fileKey)

    res.json({ reportId: report.id, downloadUrl: presignedUrl })
  } catch (err) {
    console.error('Generate WB procurement report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

module.exports = router
