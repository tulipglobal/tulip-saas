const prisma = require('../lib/client')
const { sendEmail } = require('./emailService')

// Alert type definitions with defaults and labels
const ALERT_TYPES = {
  'expense.approved': { label: 'Expense Approved', icon: '💰', emailDefault: false, inAppDefault: true },
  'expense.high_risk': { label: 'High Risk Expense', icon: '🚩', emailDefault: true, inAppDefault: true },
  'expense.mismatch': { label: 'OCR Mismatch', icon: '⚠️', emailDefault: true, inAppDefault: true },
  'expense.duplicate': { label: 'Duplicate Document', icon: '📋', emailDefault: true, inAppDefault: true },
  'expense.challenge_response': { label: 'Challenge Response', icon: '💬', emailDefault: true, inAppDefault: true },
  'budget.threshold_70': { label: 'Budget 70%', icon: '📊', emailDefault: false, inAppDefault: true },
  'budget.threshold_80': { label: 'Budget 80%', icon: '📊', emailDefault: true, inAppDefault: true },
  'budget.threshold_90': { label: 'Budget 90%', icon: '📊', emailDefault: false, inAppDefault: true },
  'budget.threshold_100': { label: 'Budget 100%', icon: '📊', emailDefault: true, inAppDefault: true },
  'seal.anchored': { label: 'Seal Anchored', icon: '🔗', emailDefault: true, inAppDefault: true },
  'seal.batch': { label: 'Weekly Seal Digest', icon: '🔗', emailDefault: false, inAppDefault: true },
  'document.uploaded': { label: 'Document Uploaded', icon: '📄', emailDefault: false, inAppDefault: true },
  'document.expiring': { label: 'Document Expiring', icon: '📄', emailDefault: false, inAppDefault: true },
  'project.milestone': { label: 'Project Milestone', icon: '🎯', emailDefault: false, inAppDefault: true },
  'project.overdue': { label: 'Project Overdue', icon: '⏰', emailDefault: false, inAppDefault: true },
  'report.monthly_ready': { label: 'Monthly Report Ready', icon: '📈', emailDefault: true, inAppDefault: true },
  'report.quarterly_ready': { label: 'Quarterly Report Ready', icon: '📈', emailDefault: false, inAppDefault: true },
}

async function ensureDefaultPrefs(donorMemberId) {
  // Check if prefs exist
  const existing = await prisma.$queryRawUnsafe(
    `SELECT "alertType" FROM "DonorNotificationPref" WHERE "donorMemberId" = $1`, donorMemberId
  )
  const existingTypes = new Set(existing.map(r => r.alertType))

  // Insert missing defaults
  for (const [alertType, config] of Object.entries(ALERT_TYPES)) {
    if (!existingTypes.has(alertType)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DonorNotificationPref" ("donorMemberId", "alertType", "emailEnabled", "inAppEnabled")
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        donorMemberId, alertType, config.emailDefault, config.inAppDefault
      )
    }
  }
}

async function getPrefs(donorMemberId, alertType) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "emailEnabled", "inAppEnabled" FROM "DonorNotificationPref" WHERE "donorMemberId" = $1 AND "alertType" = $2`,
    donorMemberId, alertType
  )
  if (rows.length) return rows[0]
  // Return defaults
  const config = ALERT_TYPES[alertType] || { emailDefault: false, inAppDefault: true }
  return { emailEnabled: config.emailDefault, inAppEnabled: config.inAppDefault }
}

async function createNotification({ donorOrgId, alertType, title, body, entityType, entityId, projectId }) {
  // Find all donor members for this org
  const members = await prisma.$queryRawUnsafe(
    `SELECT id, email, name FROM "DonorMember" WHERE "donorOrgId" = $1`, donorOrgId
  )

  // Get donor org name
  const orgs = await prisma.$queryRawUnsafe(`SELECT name FROM "DonorOrganisation" WHERE id = $1`, donorOrgId)
  const orgName = orgs[0]?.name || 'your organisation'

  const alertConfig = ALERT_TYPES[alertType] || { label: alertType }
  let created = 0

  for (const member of members) {
    const prefs = await getPrefs(member.id, alertType)

    // In-app notification
    if (prefs.inAppEnabled) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DonorNotification" ("donorMemberId", "donorOrgId", "alertType", title, body, "entityType", "entityId", "projectId", "emailSent")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
        member.id, donorOrgId, alertType, title, body, entityType || null, entityId || null, projectId || null
      )
      created++
    }

    // Email notification
    if (prefs.emailEnabled) {
      const firstName = (member.name || 'there').split(' ')[0]
      // Build link based on entity type
      let viewLink = 'https://donor.sealayer.io/dashboard'
      if (projectId && entityType === 'expense' && entityId) {
        viewLink = `https://donor.sealayer.io/projects/${projectId}?expense=${entityId}`
      } else if (projectId) {
        viewLink = `https://donor.sealayer.io/projects/${projectId}`
      }

      ;(async () => {
        try {
          await sendEmail({
            to: member.email,
            subject: `${alertConfig.label} — ${title}`,
            text: `Hi ${firstName},\n\n${body}\n\nView in Sealayer: ${viewLink}\n\nTo manage your notification preferences:\nhttps://donor.sealayer.io/settings/notifications\n\n— The Sealayer Team\n\nYou are receiving this because you are a member of ${orgName} on Sealayer.io`,
            html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px">
              <h1 style="color:#3C3489;font-size:20px">${alertConfig.label}</h1>
              <p style="color:#26215C">Hi ${firstName},</p>
              <p style="color:#26215C">${body}</p>
              <div style="text-align:center;margin:24px 0">
                <a href="${viewLink}" style="display:inline-block;padding:12px 28px;background:#3C3489;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View in Sealayer</a>
              </div>
              <p style="color:#7F77DD;font-size:12px;margin-top:24px">
                <a href="https://donor.sealayer.io/settings/notifications" style="color:#534AB7">Manage notification preferences</a>
              </p>
              <p style="color:#999;font-size:11px;margin-top:16px">You are receiving this because you are a member of ${orgName} on Sealayer.io</p>
            </div>`
          })
          // Mark email sent on the notification we just created
          await prisma.$executeRawUnsafe(
            `UPDATE "DonorNotification" SET "emailSent" = true, "emailSentAt" = NOW()
             WHERE "donorMemberId" = $1 AND "alertType" = $2 AND "createdAt" = (
               SELECT "createdAt" FROM "DonorNotification" WHERE "donorMemberId" = $1 AND "alertType" = $2 ORDER BY "createdAt" DESC LIMIT 1
             )`, member.id, alertType
          )
        } catch (err) { console.error('Notification email error:', err.message) }
      })()
    }
  }

  return created
}

async function notifyDonorOrgsForProject(projectId, alertType, title, body, entityType, entityId) {
  const orgs = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "donorOrgId" FROM "DonorProjectAccess" WHERE "projectId" = $1 AND "revokedAt" IS NULL`, projectId
  )
  for (const org of orgs) {
    await createNotification({ donorOrgId: org.donorOrgId, alertType, title, body, entityType, entityId, projectId })
  }
}

module.exports = { createNotification, ensureDefaultPrefs, getPrefs, ALERT_TYPES, notifyDonorOrgsForProject }
