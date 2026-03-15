// ─────────────────────────────────────────────────────────────
//  services/reportAutoService.js — Auto-generate reports (Sprint 8)
//
//  Called by cron jobs in anchorScheduler.js. Generates monthly,
//  quarterly, or annual reports for all active tenants+projects.
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')
const reportEngine = require('./reportEngine')
const logger = require('../lib/logger')

async function generateAutoReports(type) {
  let count = 0

  // Find all active tenants with at least one project
  const tenants = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT t.id, t.name
    FROM "Tenant" t
    JOIN "Project" p ON p."tenantId" = t.id
    WHERE t.status IS NULL OR t.status != 'SUSPENDED'
  `)

  const now = new Date()

  for (const tenant of tenants) {
    try {
      const projects = await prisma.$queryRawUnsafe(
        `SELECT * FROM "Project" WHERE "tenantId" = $1 AND (status IS NULL OR status NOT IN ('CLOSED', 'COMPLETED', 'CANCELLED'))`,
        tenant.id
      )

      for (const project of projects) {
        try {
          let from, to, reportName, reportType

          if (type === 'MONTHLY') {
            // Previous month
            const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
            const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
            from = new Date(prevYear, prevMonth, 1)
            to = new Date(prevYear, prevMonth + 1, 1)
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
            reportName = `${project.name} — ${monthNames[prevMonth]} ${prevYear} Monthly Report (Auto)`
            reportType = 'MONTHLY'
          } else if (type === 'QUARTERLY') {
            // Previous quarter
            const curQuarter = Math.ceil((now.getMonth() + 1) / 3)
            const prevQ = curQuarter === 1 ? 4 : curQuarter - 1
            const prevYear = curQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear()
            const startMonth = (prevQ - 1) * 3
            from = new Date(prevYear, startMonth, 1)
            to = new Date(prevYear, startMonth + 3, 1)
            reportName = `${project.name} — Q${prevQ} ${prevYear} Quarterly Report (Auto)`
            reportType = 'QUARTERLY'
          } else if (type === 'ANNUAL') {
            // Previous year
            const prevYear = now.getFullYear() - 1
            from = new Date(prevYear, 0, 1)
            to = new Date(prevYear + 1, 0, 1)
            reportName = `${project.name} — ${prevYear} Annual Report (Auto)`
            reportType = 'ANNUAL'
          } else {
            continue
          }

          // Check if already generated
          const existing = await prisma.$queryRawUnsafe(`
            SELECT id FROM "GeneratedReport"
            WHERE "tenantId" = $1 AND "projectId" = $2 AND "reportType" = $3
              AND "dateRangeFrom" = $4 AND "dateRangeTo" = $5
            LIMIT 1
          `, tenant.id, project.id, reportType, from, to)

          if (existing.length > 0) continue

          // Create report record
          const rows = await prisma.$queryRawUnsafe(`
            INSERT INTO "GeneratedReport" ("tenantId", "projectId", "reportType", name, "dateRangeFrom", "dateRangeTo", "reportConfig", "generatedBy", "generatedByType", status)
            VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, NULL, 'SYSTEM', 'GENERATING')
            RETURNING *
          `, tenant.id, project.id, reportType, reportName, from, to)
          const report = rows[0]

          // Fetch expenses
          const expenses = await prisma.$queryRawUnsafe(`
            SELECT * FROM "Expense"
            WHERE "projectId" = $1 AND "tenantId" = $2
              AND date >= $3 AND date < $4 AND status = 'APPROVED'
            ORDER BY date ASC
          `, project.id, tenant.id, from, to)

          const categoryTotals = await prisma.$queryRawUnsafe(`
            SELECT category, COUNT(*)::int as count, SUM(amount)::float as total
            FROM "Expense"
            WHERE "projectId" = $1 AND "tenantId" = $2
              AND date >= $3 AND date < $4 AND status = 'APPROVED'
            GROUP BY category ORDER BY total DESC
          `, project.id, tenant.id, from, to)

          const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
          const currency = project.currency || 'USD'
          const re = reportEngine

          // Build simple auto report
          const doc = re.createDoc({ title: reportName })
          re.addCoverPage(doc, {
            reportType: `${type.charAt(0) + type.slice(1).toLowerCase()} Report`,
            projectName: project.name,
            orgName: tenant.name || '',
            dateRange: `${re.formatDate(from)} — ${re.formatDate(to)}`,
            generatedDate: now.toLocaleDateString('en-GB'),
          })

          doc.addPage()
          re.addSectionHeader(doc, 'Summary')
          let y = doc.y
          y = re.addKeyValue(doc, 'Project', project.name, 50, y)
          y = re.addKeyValue(doc, 'Budget', re.formatCurrency(project.budget, currency), 50, y)
          y = re.addKeyValue(doc, 'Spent (period)', re.formatCurrency(totalSpent, currency), 50, y)
          y = re.addKeyValue(doc, 'Transactions', String(expenses.length), 50, y)
          doc.y = y + 10

          if (categoryTotals.length > 0) {
            re.addSectionHeader(doc, 'Breakdown by Category')
            const headers = ['Category', 'Count', 'Total']
            const catRows = categoryTotals.map(c => [c.category || 'Uncategorized', String(c.count), re.formatCurrency(c.total, currency)])
            re.addTable(doc, headers, catRows, { colWidths: [200, 100, 195] })
          }

          re.addFooters(doc, null)
          const buffer = await re.generateBuffer(doc)
          await re.uploadAndSave(buffer, report.id, tenant.id)

          count++
          logger.info(`[auto-reports] Generated ${reportType} for ${project.name} (tenant: ${tenant.id})`)
        } catch (projErr) {
          logger.error(`[auto-reports] Failed for project ${project.id}`, { error: projErr.message })
        }
      }
    } catch (tenantErr) {
      logger.error(`[auto-reports] Failed for tenant ${tenant.id}`, { error: tenantErr.message })
    }
  }

  return count
}

module.exports = { generateAutoReports }
