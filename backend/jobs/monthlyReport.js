// -----------------------------------------------------------------
//  jobs/monthlyReport.js -- Monthly PDF report for donors
// -----------------------------------------------------------------
const PDFDocument = require('pdfkit')
const prisma = require('../lib/client')
const { sendEmail } = require('../services/emailService')

const BRAND = { primary: '#3C3489', accent: '#534AB7', dark: '#26215C', muted: '#7F77DD', light: '#F4F3FE' }

async function generateMonthlyReport(donorOrgId, targetMonth) {
  // targetMonth: 'YYYY-MM' string, defaults to last month
  const now = new Date()
  if (!targetMonth) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    targetMonth = lastMonth.toISOString().slice(0, 7)
  }
  const [year, month] = targetMonth.split('-').map(Number)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)
  const monthLabel = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Get donor org info
  const orgs = await prisma.$queryRawUnsafe(
    `SELECT name FROM "DonorOrganisation" WHERE id = $1`, donorOrgId
  )
  const orgName = orgs[0]?.name || 'Donor Organisation'

  // Get accessible projects
  const accessRows = await prisma.$queryRawUnsafe(
    `SELECT "projectId", "tenantId" FROM "DonorProjectAccess"
     WHERE "donorOrgId" = $1 AND "revokedAt" IS NULL`, donorOrgId
  )
  if (!accessRows.length) return null

  const projectIds = accessRows.map(r => r.projectId)
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true, status: true, startDate: true, endDate: true }
  })

  // Get expenses
  const expenses = await prisma.expense.findMany({
    where: {
      projectId: { in: projectIds },
      approvalStatus: { in: ['APPROVED', 'AUTO_APPROVED'] }
    },
    select: {
      id: true, projectId: true, amount: true, currency: true,
      category: true, fraudRiskLevel: true, receiptSealId: true,
      createdAt: true
    }
  })

  // Budget data
  let budgetLines = []
  try {
    budgetLines = await prisma.$queryRawUnsafe(
      `SELECT bl.category, bl."approvedAmount"::float as budget, b."projectId"
       FROM "BudgetLine" bl JOIN "Budget" b ON bl."budgetId" = b.id
       WHERE b."projectId" = ANY($1::text[])`, projectIds
    )
  } catch { /* may fail */ }

  // Generate PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const buffers = []
  doc.on('data', b => buffers.push(b))

  // Cover
  doc.fontSize(28).fillColor(BRAND.primary).text('Sealayer', { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(12).fillColor(BRAND.muted).text('Monthly Donor Report', { align: 'center' })
  doc.moveDown(2)
  doc.fontSize(16).fillColor(BRAND.dark).text(orgName, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(14).fillColor(BRAND.accent).text(monthLabel, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(10).fillColor(BRAND.muted).text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' })
  doc.moveDown(3)

  // Per-project summaries
  for (const project of projects) {
    const projExpenses = expenses.filter(e => e.projectId === project.id)
    const totalSpent = projExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const sealedCount = projExpenses.filter(e => e.receiptSealId).length
    const lowCount = projExpenses.filter(e => !e.fraudRiskLevel || e.fraudRiskLevel === 'LOW').length
    const medCount = projExpenses.filter(e => e.fraudRiskLevel === 'MEDIUM').length
    const highCount = projExpenses.filter(e => e.fraudRiskLevel === 'HIGH' || e.fraudRiskLevel === 'CRITICAL').length
    const projBudget = budgetLines.filter(b => b.projectId === project.id).reduce((s, b) => s + b.budget, 0)

    // Check if we need a new page
    if (doc.y > 650) doc.addPage()

    doc.fontSize(14).fillColor(BRAND.primary).text(project.name, { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(10).fillColor(BRAND.dark)
    doc.text(`Status: ${project.status || 'Active'}`)
    doc.text(`Total Budget: $${projBudget.toLocaleString()}`)
    doc.text(`Total Spent: $${totalSpent.toLocaleString()}`)
    doc.text(`Remaining: $${(projBudget - totalSpent).toLocaleString()}`)
    doc.text(`Expenses: ${projExpenses.length} (LOW: ${lowCount}, MEDIUM: ${medCount}, HIGH: ${highCount})`)
    doc.text(`Seal Coverage: ${sealedCount} of ${projExpenses.length} sealed`)
    doc.moveDown(1)

    // Budget vs actual by category
    const cats = {}
    for (const bl of budgetLines.filter(b => b.projectId === project.id)) {
      cats[bl.category] = { budget: bl.budget, spent: 0 }
    }
    for (const e of projExpenses) {
      const cat = e.category || 'Other'
      if (!cats[cat]) cats[cat] = { budget: 0, spent: 0 }
      cats[cat].spent += e.amount || 0
    }

    if (Object.keys(cats).length > 0) {
      doc.fontSize(10).fillColor(BRAND.accent).text('Budget vs Actual:')
      doc.fontSize(9).fillColor(BRAND.dark)
      for (const [cat, data] of Object.entries(cats)) {
        const pct = data.budget > 0 ? Math.round((data.spent / data.budget) * 100) : 0
        doc.text(`  ${cat}: Budget $${data.budget.toLocaleString()} | Spent $${data.spent.toLocaleString()} | ${pct}%`)
      }
      doc.moveDown(0.5)
    }
  }

  // Footer
  doc.moveDown(2)
  doc.fontSize(9).fillColor(BRAND.muted)
  doc.text('Generated by Sealayer.io — All data blockchain-verified', { align: 'center' })

  doc.end()

  return new Promise((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers)
      resolve({ pdfBuffer, monthLabel, orgName })
    })
  })
}

async function sendMonthlyReports(targetMonth) {
  // Get all donor orgs that have active access
  const orgs = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT o.id, o.name
     FROM "DonorOrganisation" o
     JOIN "DonorProjectAccess" a ON a."donorOrgId" = o.id
     WHERE a."revokedAt" IS NULL`
  )

  let emailsSent = 0
  for (const org of orgs) {
    try {
      const result = await generateMonthlyReport(org.id, targetMonth)
      if (!result) continue

      // Get all member emails for this org
      const members = await prisma.$queryRawUnsafe(
        `SELECT email FROM "DonorMember" WHERE "donorOrgId" = $1`, org.id
      )

      for (const member of members) {
        try {
          await sendEmail({
            to: member.email,
            subject: `Your Sealayer Monthly Report — ${result.monthLabel}`,
            text: `Please find your monthly project report attached.\n\nGenerated by Sealayer.io`,
            html: `
              <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:560px;margin:0 auto;padding:30px">
                <h1 style="color:#3C3489;text-align:center">Sealayer</h1>
                <h2 style="color:#26215C">Monthly Report — ${result.monthLabel}</h2>
                <p style="color:#26215C">Please find your monthly project report attached.</p>
                <p style="color:#7F77DD;font-size:12px">Powered by Sealayer.io</p>
              </div>
            `,
            attachments: [{
              filename: `sealayer-report-${targetMonth || 'latest'}.pdf`,
              content: result.pdfBuffer,
              contentType: 'application/pdf'
            }]
          })
          emailsSent++
        } catch (emailErr) {
          console.error(`Failed to send monthly report to ${member.email}:`, emailErr.message)
        }
      }
    } catch (err) {
      console.error(`Failed to generate report for org ${org.id}:`, err.message)
    }
  }

  return emailsSent
}

module.exports = { generateMonthlyReport, sendMonthlyReports }
