// ─────────────────────────────────────────────────────────────
//  services/anchorScheduler.js — v5
//
//  Changes from v4:
//  ✔ RFC 3161 timestamp job (runs every 10 minutes)
// ─────────────────────────────────────────────────────────────

const cron    = require('node-cron')
const { anchorBatch }             = require('./batchAnchorService')
const { retryFailed: retryFailedDeliveries } = require('./webhookService')
const { cleanupExpiredTokens }    = require('./refreshTokenService')
const { stampPendingLogs }        = require('./timestampService')
const { checkTrialExpirations }  = require('./emailNotificationService')
const { checkDocumentExpiry }   = require('../jobs/expiryAlerts')
const { runEngagementEmails }  = require('./engagementEmailService')
const { retryFailedAnchors }   = require('./anchorRetryService')
const { sendMonthlyReports }  = require('../jobs/monthlyReport')
const prisma  = require('../lib/client')
const { notifyDonorOrgsForProject } = require('./donorNotificationService')
const { sendEmail } = require('./emailService')
const logger  = require('../lib/logger')

function startAnchorScheduler() {
  // Anchor job — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running batch anchor job...')
    try { await anchorBatch() } catch (err) { logger.error('Anchor job failed', { error: err.message }) }
  })

  // Webhook retry worker — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try { await retryFailedDeliveries() } catch (err) { logger.error('Webhook retry failed', { error: err.message }) }
  })

  // RFC 3161 timestamp job — every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    logger.info('Running RFC 3161 timestamp job...')
    try {
      const result = await stampPendingLogs(10)
      if (result.stamped > 0 || result.failed > 0) {
        logger.info('[timestamp] Batch complete', result)
      }
    } catch (err) {
      logger.error('Timestamp job failed', { error: err.message })
    }
  })

  // Refresh token cleanup — daily at 3am
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running refresh token cleanup...')
    try { await cleanupExpiredTokens() } catch (err) { logger.error('Token cleanup failed', { error: err.message }) }
  })

  // Trial expiration check — daily at 9am
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running trial expiration check...')
    try {
      const result = await checkTrialExpirations()
      if (result.expiringSoon > 0 || result.justExpired > 0) {
        logger.info('[trial-check] Complete', result)
      }
    } catch (err) { logger.error('Trial check failed', { error: err.message }) }
  })

  // Document expiry alert — daily at 8am UAE (4am UTC)
  cron.schedule('0 4 * * *', async () => {
    logger.info('Running document expiry alert check...')
    try {
      const result = await checkDocumentExpiry()
      if (result.alertsSent > 0) {
        logger.info('[expiry-alerts] Complete', result)
      }
    } catch (err) { logger.error('Expiry alert job failed', { error: err.message }) }
  })

  // Engagement email sequences — daily at 5am UTC (9am UAE)
  cron.schedule('0 5 * * *', async () => {
    logger.info('Running engagement email sequences...')
    try {
      const result = await runEngagementEmails()
      if (result.nudge > 0 || result.upgrade > 0 || result.reEngagement > 0) {
        logger.info('[engagement-emails] Complete', result)
      }
    } catch (err) { logger.error('Engagement email job failed', { error: err.message }) }
  })

  // Anchor retry worker — every 5 minutes (retries failed seal anchors)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await retryFailedAnchors()
      if (result.retried > 0 || result.alerted > 0) {
        logger.info('[anchor-retry] Complete', result)
      }
    } catch (err) { logger.error('Anchor retry failed', { error: err.message }) }
  })

  // Monthly donor report — 1st of every month at 02:00 UTC (07:30 IST)
  cron.schedule('0 2 1 * *', async () => {
    logger.info('[monthly-report] Generating monthly donor reports...')
    try {
      const count = await sendMonthlyReports()
      logger.info(`[monthly-report] Sent ${count} report emails`)
    } catch (err) {
      logger.error('[monthly-report] Failed', { error: err.message })
    }
  })

  // Donor document expiry notifications — daily at 02:00 UTC
  cron.schedule('0 2 * * *', async () => {
    logger.info('[donor-doc-expiry] Checking for expiring documents...')
    try {
      // Find documents expiring within 30 days on projects that have donor access
      const expiringDocs = await prisma.$queryRawUnsafe(`
        SELECT d.id, d.name, d."expiryDate", d."projectId", p.name as "projectName"
        FROM "Document" d
        JOIN "Project" p ON p.id = d."projectId"
        WHERE d."expiryDate" IS NOT NULL
          AND d."expiryDate" > NOW()
          AND d."expiryDate" <= NOW() + INTERVAL '30 days'
          AND d."projectId" IN (
            SELECT DISTINCT "projectId" FROM "DonorProjectAccess" WHERE "revokedAt" IS NULL
          )
      `)

      let notified = 0
      for (const doc of expiringDocs) {
        // Dedup: don't send if a notification with the same entityId and alertType was created in the last 7 days
        const recent = await prisma.$queryRawUnsafe(
          `SELECT id FROM "DonorNotification"
           WHERE "alertType" = 'document.expiring' AND "entityId" = $1 AND "createdAt" > NOW() - INTERVAL '7 days'
           LIMIT 1`,
          doc.id
        )
        if (recent.length > 0) continue

        const daysUntil = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        await notifyDonorOrgsForProject(
          doc.projectId,
          'document.expiring',
          `Document expiring — ${doc.name}`,
          `"${doc.name}" on ${doc.projectName} expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${new Date(doc.expiryDate).toISOString().split('T')[0]}). Please ensure it is renewed or replaced.`,
          'document',
          doc.id
        )
        notified++
      }

      if (notified > 0) {
        logger.info(`[donor-doc-expiry] Sent ${notified} expiry notifications`)
      }
    } catch (err) {
      logger.error('[donor-doc-expiry] Failed', { error: err.message })
    }
  })

  // Deliverable request reminders — daily at 08:00 UTC
  cron.schedule('0 8 * * *', async () => {
    logger.info('[deliverable-reminders] Checking for upcoming deadlines...')
    try {
      // Find OPEN or REWORK requests with upcoming or past deadlines
      const requests = await prisma.$queryRawUnsafe(`
        SELECT dr.id, dr.title, dr.deadline, dr.status, dr."projectId", dr."tenantId", dr."donorOrgId",
               p.name as "projectName"
        FROM "DeliverableRequest" dr
        JOIN "Project" p ON p.id = dr."projectId"
        WHERE dr.status IN ('OPEN', 'REWORK')
          AND dr.deadline IS NOT NULL
      `)

      let reminded = 0
      let overdueSet = 0

      for (const req of requests) {
        const now = new Date()
        const deadline = new Date(req.deadline)
        const diffMs = deadline.getTime() - now.getTime()
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        // Set OVERDUE if past deadline
        if (daysUntil < 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE "DeliverableRequest" SET status = 'OVERDUE', "updatedAt" = NOW() WHERE id = $1 AND status IN ('OPEN', 'REWORK')`,
            req.id
          )
          overdueSet++

          // Notify donor that request is overdue
          ;(async () => {
            try {
              await notifyDonorOrgsForProject(
                req.projectId,
                'deliverable.overdue',
                `Deliverable overdue — ${req.title}`,
                `The deliverable "${req.title}" on ${req.projectName} is now past its deadline. The NGO has not yet submitted.`,
                'deliverable',
                req.id
              )
            } catch (err) { logger.error('[deliverable-reminders] Overdue notification error', { error: err.message }) }
          })()

          continue
        }

        // Send reminders at 14, 7, 3 days before deadline
        if ([14, 7, 3].includes(daysUntil)) {
          try {
            const admins = await prisma.user.findMany({
              where: { tenantId: req.tenantId },
              select: { email: true }
            })
            const deadlineFormatted = deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            const urgency = daysUntil <= 3 ? 'Urgent: ' : ''

            for (const admin of admins.slice(0, 5)) {
              await sendEmail({
                to: admin.email,
                subject: `${urgency}Deliverable Due in ${daysUntil} Days — ${req.projectName}`,
                text: `Reminder: The deliverable "${req.title}" on ${req.projectName} is due on ${deadlineFormatted} (${daysUntil} days from now).\n\nPlease log in to submit: https://app.sealayer.io`,
                html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#183a1d;font-size:20px">${urgency}Deliverable Reminder</h1><p style="color:#183a1d">The deliverable <strong>"${req.title}"</strong> on <strong>${req.projectName}</strong> is due on <strong>${deadlineFormatted}</strong> (${daysUntil} day${daysUntil === 1 ? '' : 's'} from now).</p><div style="background:${daysUntil <= 3 ? '#fef2f2;border:1px solid #fca5a5' : '#fefbe9;border:1px solid #c8d6c0'};border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0;color:${daysUntil <= 3 ? '#991b1b' : '#92400E'}">Status: ${req.status}</p></div><div style="text-align:center;margin:24px 0"><a href="https://app.sealayer.io" style="display:inline-block;padding:12px 28px;background:#183a1d;color:#fefbe9;text-decoration:none;border-radius:8px;font-weight:600">Submit Deliverable</a></div></div>`
              }).catch(() => {})
            }
            reminded++
          } catch (err) { logger.error('[deliverable-reminders] Email error', { error: err.message }) }
        }
      }

      if (reminded > 0 || overdueSet > 0) {
        logger.info(`[deliverable-reminders] Complete — ${reminded} reminders sent, ${overdueSet} set to overdue`)
      }
    } catch (err) {
      logger.error('[deliverable-reminders] Failed', { error: err.message })
    }
  })

  // Repayment schedule reminders — daily at 09:00 UTC
  cron.schedule('0 9 * * *', async () => {
    logger.info('[repayment-reminders] Checking repayment schedule...')
    try {
      const instalments = await prisma.$queryRawUnsafe(`
        SELECT rs.*, ii."projectId", ii."donorOrgId", ii.currency,
               p.name as "projectName"
        FROM "RepaymentSchedule" rs
        JOIN "ImpactInvestment" ii ON ii.id = rs."investmentId"
        JOIN "Project" p ON p.id::text = ii."projectId"::text
        WHERE rs.status NOT IN ('PAID')
      `)

      let reminders = 0, dueSets = 0, overdueSets = 0

      for (const inst of instalments) {
        const now = new Date()
        const dueDate = new Date(inst.dueDate)
        const diffMs = dueDate.getTime() - now.getTime()
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        const amount = `${inst.currency || 'USD'} ${Number(inst.totalDue || 0).toLocaleString()}`

        // 7-day reminder
        if (daysUntil === 7) {
          try {
            const { createNotification } = require('./donorNotificationService')
            await createNotification({
              donorOrgId: inst.donorOrgId,
              alertType: 'repayment.due_soon',
              title: `Repayment due in 7 days — ${inst.projectName}`,
              body: `Instalment #${inst.instalmentNumber} of ${amount} on ${inst.projectName} is due on ${dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
              entityType: 'repayment',
              entityId: inst.id,
              projectId: inst.projectId,
            })
            // Email donor members
            const members = await prisma.$queryRawUnsafe(`SELECT email, name FROM "DonorMember" WHERE "donorOrgId" = $1`, inst.donorOrgId)
            for (const m of members.slice(0, 10)) {
              await sendEmail({
                to: m.email,
                subject: `Repayment Due in 7 Days — ${inst.projectName}`,
                text: `Instalment #${inst.instalmentNumber} of ${amount} on ${inst.projectName} is due on ${dueDate.toLocaleDateString('en-GB')}.`,
                html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#3C3489;font-size:20px">Repayment Reminder</h1><p style="color:#26215C">Instalment <strong>#${inst.instalmentNumber}</strong> of <strong>${amount}</strong> on <strong>${inst.projectName}</strong> is due in 7 days.</p><div style="text-align:center;margin:24px 0"><a href="https://donor.sealayer.io" style="display:inline-block;padding:12px 28px;background:#3C3489;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View Schedule</a></div></div>`
              }).catch(() => {})
            }
            reminders++
          } catch (err) { logger.error('[repayment-reminders] 7-day reminder error', { error: err.message }) }
        }

        // Due today — set status DUE
        if (daysUntil === 0 && inst.status === 'UPCOMING') {
          await prisma.$executeRawUnsafe(
            `UPDATE "RepaymentSchedule" SET status = 'DUE', "updatedAt" = NOW() WHERE id = $1`, inst.id
          )
          dueSets++
        }

        // Overdue — past due date
        if (daysUntil < 0 && !['PAID', 'PARTIAL'].includes(inst.status)) {
          if (inst.status !== 'OVERDUE') {
            await prisma.$executeRawUnsafe(
              `UPDATE "RepaymentSchedule" SET status = 'OVERDUE', "updatedAt" = NOW() WHERE id = $1`, inst.id
            )
            overdueSets++
          }

          // Send missed repayment alert (dedup: only if status was not already OVERDUE)
          if (inst.status !== 'OVERDUE') {
            try {
              const { createNotification } = require('./donorNotificationService')
              await createNotification({
                donorOrgId: inst.donorOrgId,
                alertType: 'repayment.missed',
                title: `Missed repayment — ${inst.projectName}`,
                body: `Instalment #${inst.instalmentNumber} of ${amount} was due on ${dueDate.toLocaleDateString('en-GB')}. Days overdue: ${Math.abs(daysUntil)}.`,
                entityType: 'repayment',
                entityId: inst.id,
                projectId: inst.projectId,
              })
              const members = await prisma.$queryRawUnsafe(`SELECT email FROM "DonorMember" WHERE "donorOrgId" = $1`, inst.donorOrgId)
              for (const m of members.slice(0, 10)) {
                await sendEmail({
                  to: m.email,
                  subject: `Missed Repayment — ${inst.projectName}`,
                  text: `Instalment #${inst.instalmentNumber} of ${amount} was due on ${dueDate.toLocaleDateString('en-GB')}. Days overdue: ${Math.abs(daysUntil)}.`,
                  html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#991B1B;font-size:20px">Missed Repayment</h1><p style="color:#26215C">Instalment <strong>#${inst.instalmentNumber}</strong> of <strong>${amount}</strong> on <strong>${inst.projectName}</strong> was due on ${dueDate.toLocaleDateString('en-GB')}.</p><p style="color:#991B1B;font-weight:600">Days overdue: ${Math.abs(daysUntil)}</p><div style="text-align:center;margin:24px 0"><a href="https://donor.sealayer.io" style="display:inline-block;padding:12px 28px;background:#991B1B;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View Schedule</a></div></div>`
                }).catch(() => {})
              }
            } catch (err) { logger.error('[repayment-reminders] Missed alert error', { error: err.message }) }
          }
        }
      }

      if (reminders > 0 || dueSets > 0 || overdueSets > 0) {
        logger.info(`[repayment-reminders] Complete — ${reminders} reminders, ${dueSets} set DUE, ${overdueSets} set OVERDUE`)
      }
    } catch (err) {
      logger.error('[repayment-reminders] Failed', { error: err.message })
    }
  })

  // Auto-generate monthly reports — 1st of every month at 06:00 UTC
  cron.schedule('0 6 1 * *', async () => {
    logger.info('[auto-reports] Generating monthly reports...')
    try {
      const { generateAutoReports } = require('./reportAutoService')
      const count = await generateAutoReports('MONTHLY')
      logger.info(`[auto-reports] Generated ${count} monthly reports`)
    } catch (err) { logger.error('[auto-reports] Monthly failed', { error: err.message }) }
  })

  // Quarterly — 1st of Jan/Apr/Jul/Oct at 07:00 UTC
  cron.schedule('0 7 1 1,4,7,10 *', async () => {
    logger.info('[auto-reports] Generating quarterly reports...')
    try {
      const { generateAutoReports } = require('./reportAutoService')
      const count = await generateAutoReports('QUARTERLY')
      logger.info(`[auto-reports] Generated ${count} quarterly reports`)
    } catch (err) { logger.error('[auto-reports] Quarterly failed', { error: err.message }) }
  })

  // Annual — 1st January at 08:00 UTC
  cron.schedule('0 8 1 1 *', async () => {
    logger.info('[auto-reports] Generating annual reports...')
    try {
      const { generateAutoReports } = require('./reportAutoService')
      const count = await generateAutoReports('ANNUAL')
      logger.info(`[auto-reports] Generated ${count} annual reports`)
    } catch (err) { logger.error('[auto-reports] Annual failed', { error: err.message }) }
  })

  logger.info('Blockchain anchor scheduler started (every 5 minutes)')
  logger.info('Anchor retry worker started (every 5 minutes)')
  logger.info('Webhook retry worker started (every 5 minutes)')
  logger.info('RFC 3161 timestamp job started (every 10 minutes)')
  logger.info('Refresh token cleanup scheduled (daily 3am)')
  logger.info('Trial expiration check scheduled (daily 9am)')
  logger.info('Document expiry alert check scheduled (daily 4am UTC / 8am UAE)')
  logger.info('Engagement email sequences scheduled (daily 5am UTC / 9am UAE)')
  logger.info('Monthly donor report scheduled (1st of month, 2am UTC)')
  logger.info('Donor document expiry notifications scheduled (daily 2am UTC)')
  logger.info('Deliverable request reminders scheduled (daily 8am UTC)')
  logger.info('Repayment schedule reminders scheduled (daily 9am UTC)')
  logger.info('Auto monthly reports scheduled (1st of month, 6am UTC)')
  logger.info('Auto quarterly reports scheduled (1st of quarter, 7am UTC)')
  logger.info('Auto annual reports scheduled (1st January, 8am UTC)')
}

module.exports = { startAnchorScheduler }
