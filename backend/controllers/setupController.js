// ─────────────────────────────────────────────────────────────
//  controllers/setupController.js
//  Org setup wizard endpoints (post-registration)
// ─────────────────────────────────────────────────────────────

const prisma = require('../prisma/client')
const { createAuditLog } = require('../services/auditService')
const { sendEmail } = require('../services/emailService')
const { uploadToS3 } = require('../lib/s3Upload')

// PATCH /api/setup/organisation — update tenant details
exports.updateOrganisation = async (req, res) => {
  try {
    const { tenantId } = req.user
    const { name, description, website, registrationNumber, country, baseCurrency } = req.body

    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (description !== undefined) data.description = description
    if (website !== undefined) data.website = website
    if (registrationNumber !== undefined) data.registrationNumber = registrationNumber
    if (country !== undefined) data.country = country
    if (baseCurrency !== undefined) data.baseCurrency = baseCurrency

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { id: true, name: true, description: true, website: true, registrationNumber: true, country: true, baseCurrency: true, logoUrl: true, completedSetup: true }
    })

    await createAuditLog({
      action: 'TENANT_UPDATED', entityType: 'Tenant', entityId: tenantId,
      userId: req.user.userId, tenantId
    })

    res.json(tenant)
  } catch (err) {
    console.error('[setup/organisation]', err)
    res.status(500).json({ error: 'Failed to update organisation' })
  }
}

// POST /api/setup/logo — upload organisation logo
exports.uploadLogo = async (req, res) => {
  try {
    const { tenantId } = req.user
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const { fileUrl } = await uploadToS3(req.file.buffer, req.file.originalname, tenantId, 'logos')

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: fileUrl }
    })

    res.json({ logoUrl: fileUrl })
  } catch (err) {
    console.error('[setup/logo]', err)
    res.status(500).json({ error: 'Failed to upload logo' })
  }
}

// POST /api/setup/project — create first project
exports.createFirstProject = async (req, res) => {
  try {
    const { tenantId, userId } = req.user
    const { name, description, budget } = req.body

    if (!name) return res.status(400).json({ error: 'Project name is required' })

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        budget: budget ? parseFloat(budget) : null,
        tenantId,
        status: 'active'
      }
    })

    await createAuditLog({
      action: 'PROJECT_CREATED', entityType: 'Project', entityId: project.id,
      userId, tenantId
    })

    res.status(201).json(project)
  } catch (err) {
    console.error('[setup/project]', err)
    res.status(500).json({ error: 'Failed to create project' })
  }
}

// POST /api/setup/invite-team — send up to 3 team invites
exports.inviteTeam = async (req, res) => {
  try {
    const { tenantId, userId } = req.user
    const { emails } = req.body

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array is required' })
    }

    const validEmails = emails
      .map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
      .filter(e => e && e.includes('@'))
      .slice(0, 3)

    if (validEmails.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses provided' })
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })

    const results = []
    for (const email of validEmails) {
      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        results.push({ email, status: 'already_registered' })
        continue
      }

      try {
        await sendEmail({
          to: email,
          subject: `You're invited to join ${tenant.name} on sealayer`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #0c7aed;">You've been invited!</h2>
              <p>${inviter.name} has invited you to join <strong>${tenant.name}</strong> on sealayer — the transparency platform for NGOs.</p>
              <p>sealayer provides blockchain-anchored audit trails, verified document management, and donor reporting tools.</p>
              <p style="margin-top: 24px;">
                <a href="${process.env.APP_URL || 'https://app.sealayer.io'}/register"
                   style="background: #0c7aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Accept Invitation
                </a>
              </p>
              <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
                Once you register, ask ${inviter.name} to add you to the ${tenant.name} workspace.
              </p>
            </div>
          `
        })
        results.push({ email, status: 'sent' })
      } catch (emailErr) {
        console.error(`[setup/invite] Failed to send to ${email}:`, emailErr.message)
        results.push({ email, status: 'failed' })
      }
    }

    await createAuditLog({
      action: 'TEAM_INVITED', entityType: 'Tenant', entityId: tenantId,
      userId, tenantId
    })

    res.json({ results })
  } catch (err) {
    console.error('[setup/invite-team]', err)
    res.status(500).json({ error: 'Failed to send invitations' })
  }
}

// POST /api/setup/complete — mark setup as done
exports.completeSetup = async (req, res) => {
  try {
    const { tenantId } = req.user

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { completedSetup: true }
    })

    await createAuditLog({
      action: 'SETUP_COMPLETED', entityType: 'Tenant', entityId: tenantId,
      userId: req.user.userId, tenantId
    })

    res.json({ success: true })
  } catch (err) {
    console.error('[setup/complete]', err)
    res.status(500).json({ error: 'Failed to complete setup' })
  }
}

// GET /api/setup/notifications — get notification preferences
exports.getNotificationPrefs = async (req, res) => {
  try {
    const { tenantId } = req.user
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notificationPrefs: true }
    })

    const defaults = { fraud: true, duplicate: true, mismatch: true, void: true, seal: false }
    res.json({ ...(defaults), ...(tenant?.notificationPrefs || {}) })
  } catch (err) {
    console.error('[setup/notifications GET]', err)
    res.status(500).json({ error: 'Failed to get notification preferences' })
  }
}

// PATCH /api/setup/notifications — update notification preferences
exports.updateNotificationPrefs = async (req, res) => {
  try {
    const { tenantId } = req.user
    const { fraud, duplicate, mismatch, void: voidPref, seal } = req.body

    const current = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notificationPrefs: true }
    })

    const defaults = { fraud: true, duplicate: true, mismatch: true, void: true, seal: false }
    const merged = { ...defaults, ...(current?.notificationPrefs || {}) }

    if (fraud !== undefined) merged.fraud = !!fraud
    if (duplicate !== undefined) merged.duplicate = !!duplicate
    if (mismatch !== undefined) merged.mismatch = !!mismatch
    if (voidPref !== undefined) merged.void = !!voidPref
    if (seal !== undefined) merged.seal = !!seal

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { notificationPrefs: merged }
    })

    res.json(merged)
  } catch (err) {
    console.error('[setup/notifications PATCH]', err)
    res.status(500).json({ error: 'Failed to update notification preferences' })
  }
}

// GET /api/setup/status — check if setup is completed
exports.getSetupStatus = async (req, res) => {
  try {
    const { tenantId } = req.user
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, description: true, website: true,
        registrationNumber: true, country: true, baseCurrency: true, logoUrl: true, completedSetup: true
      }
    })

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

    const projectCount = await prisma.project.count({ where: { tenantId } })
    const userCount = await prisma.user.count({ where: { tenantId } })

    res.json({ ...tenant, projectCount, userCount })
  } catch (err) {
    console.error('[setup/status]', err)
    res.status(500).json({ error: 'Failed to get setup status' })
  }
}
