// ─────────────────────────────────────────────────────────────
//  controllers/teamController.js — v1
//  Team management: list, invite, change role, remove
// ─────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const prisma = require('../prisma/client')
const { createAuditLog } = require('../services/auditService')
const { sendEmail } = require('../services/emailService')

// GET /api/team — list all team members for this tenant
exports.list = async (req, res) => {
  try {
    const { tenantId } = req.user
    const users = await prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true, name: true, email: true, createdAt: true,
        roles: { include: { role: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    })

    const members = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      roles: u.roles.map(r => ({ id: r.role.id, name: r.role.name })),
    }))

    res.json({ data: members })
  } catch (err) {
    console.error('[team/list]', err)
    res.status(500).json({ error: 'Failed to fetch team members' })
  }
}

// GET /api/team/roles — list available roles for this tenant
exports.listRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
    res.json({ data: roles })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles' })
  }
}

// POST /api/team/invite — invite a new team member by email
exports.invite = async (req, res) => {
  try {
    const { tenantId, userId } = req.user
    const { email, roleName } = req.body
    if (!email) return res.status(400).json({ error: 'email is required' })

    const cleanEmail = email.trim().toLowerCase()

    // Check if user already exists in this tenant
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } })
    if (existing && existing.tenantId === tenantId && !existing.deletedAt) {
      return res.status(400).json({ error: 'User is already a team member' })
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex')
    const hashed = await bcrypt.hash(tempPassword, 10)

    // Find or create the role
    const targetRole = roleName || 'editor'
    let role = await prisma.role.findFirst({ where: { tenantId, name: targetRole } })
    if (!role) {
      role = await prisma.role.create({ data: { name: targetRole, tenantId } })
    }

    let user
    if (existing && existing.tenantId === tenantId && existing.deletedAt) {
      // Re-activate soft-deleted user
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { deletedAt: null, password: hashed, name: cleanEmail.split('@')[0] }
      })
    } else if (existing) {
      return res.status(400).json({ error: 'Email is registered with another organisation' })
    } else {
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          password: hashed,
          tenantId,
          roles: { create: { roleId: role.id, tenantId } }
        }
      })
    }

    // If re-activated, ensure role assignment
    if (existing && existing.deletedAt) {
      const hasRole = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } })
      if (!hasRole) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
      }
    }

    // Send invite email
    const loginUrl = `${process.env.APP_URL || 'https://app.tulipds.com'}/login`
    sendEmail({
      to: cleanEmail,
      subject: `You've been invited to ${tenant?.name || 'an organisation'} on Tulip DS`,
      html: [
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:30px">',
        '<div style="text-align:center;margin-bottom:30px">',
        '<h1 style="color:#0c7aed;font-size:24px;margin:0">Tulip DS</h1>',
        '<p style="color:#64748b;font-size:13px;margin-top:4px">Verification Infrastructure</p>',
        '</div>',
        '<h2 style="color:#1e293b;font-size:20px">You\'ve been invited</h2>',
        '<p style="color:#475569;line-height:1.6">',
        `<strong>${inviter?.name || 'A team member'}</strong> has invited you to join <strong>${tenant?.name || 'their organisation'}</strong> on Tulip DS.`,
        '</p>',
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">',
        `<p style="color:#1e293b;font-size:14px;margin:0 0 8px"><strong>Your temporary credentials:</strong></p>`,
        `<p style="color:#475569;font-size:13px;margin:0">Email: <code>${cleanEmail}</code></p>`,
        `<p style="color:#475569;font-size:13px;margin:4px 0 0">Password: <code>${tempPassword}</code></p>`,
        '</div>',
        '<p style="color:#475569;font-size:13px">Please change your password after logging in.</p>',
        '<div style="text-align:center;margin:30px 0">',
        `<a href="${loginUrl}" style="display:inline-block;padding:14px 28px;background-color:#0c7aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Log In</a>`,
        '</div>',
        '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>',
        '<p style="color:#94a3b8;font-size:11px;text-align:center">Tulip DS</p>',
        '</div>'
      ].join('')
    }).catch(err => console.error('[team/invite] email failed:', err.message))

    await createAuditLog({
      action: 'TEAM_MEMBER_INVITED', entityType: 'User', entityId: user.id,
      userId, tenantId
    }).catch(() => {})

    res.status(201).json({
      id: user.id, email: cleanEmail, name: user.name,
      roles: [{ id: role.id, name: role.name }]
    })
  } catch (err) {
    console.error('[team/invite]', err)
    res.status(500).json({ error: 'Failed to invite team member' })
  }
}

// PATCH /api/team/:userId/role — change a member's role
exports.changeRole = async (req, res) => {
  try {
    const { tenantId, userId: currentUserId } = req.user
    const { userId } = req.params
    const { roleName } = req.body

    if (!roleName) return res.status(400).json({ error: 'roleName is required' })
    if (userId === currentUserId) return res.status(400).json({ error: 'Cannot change your own role' })

    // Verify user belongs to this tenant
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Find or create the role
    let role = await prisma.role.findFirst({ where: { tenantId, name: roleName } })
    if (!role) {
      role = await prisma.role.create({ data: { name: roleName, tenantId } })
    }

    // Remove existing roles and assign new one
    await prisma.userRole.deleteMany({ where: { userId, tenantId } })
    await prisma.userRole.create({ data: { userId, roleId: role.id, tenantId } })

    await createAuditLog({
      action: 'TEAM_ROLE_CHANGED', entityType: 'User', entityId: userId,
      userId: currentUserId, tenantId
    }).catch(() => {})

    res.json({ id: userId, roleName: role.name })
  } catch (err) {
    console.error('[team/changeRole]', err)
    res.status(500).json({ error: 'Failed to change role' })
  }
}

// DELETE /api/team/:userId — remove a team member (soft delete)
exports.remove = async (req, res) => {
  try {
    const { tenantId, userId: currentUserId } = req.user
    const { userId } = req.params

    if (userId === currentUserId) return res.status(400).json({ error: 'Cannot remove yourself' })

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() }
    })

    await createAuditLog({
      action: 'TEAM_MEMBER_REMOVED', entityType: 'User', entityId: userId,
      userId: currentUserId, tenantId
    }).catch(() => {})

    res.json({ deleted: true })
  } catch (err) {
    console.error('[team/remove]', err)
    res.status(500).json({ error: 'Failed to remove team member' })
  }
}
