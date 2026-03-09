// ─────────────────────────────────────────────────────────────
//  controllers/donorInviteController.js — v1
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/client')
const tenantClient = require('../lib/tenantClient')
const { sendEmail } = require('../services/emailService')
const { createAuditLog } = require('../services/auditService')
const { notifyMemberJoined } = require('../services/emailNotificationService')

exports.createInvite = async (req, res) => {
  try {
    const { email, inviteType, projectId, donorName } = req.body
    if (!email) return res.status(400).json({ error: 'email is required' })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invite = await prisma.donorInvite.create({
      data: {
        token,
        email,
        invitedByUserId: req.user.userId || req.user.id,
        inviteType: inviteType || 'NGO_INVITES_DONOR',
        tenantId: req.user.tenantId,
        projectId: projectId || null,
        expiresAt,
      }
    })

    // Get tenant name for email
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { name: true } })
    const inviteUrl = `https://donor.tulipds.com/accept-invite?token=${token}`

    // Send invite email
    try {
      await sendEmail({
        to: email,
        subject: `${tenant?.name || 'An organisation'} has invited you to Tulip DS`,
        text: `${tenant?.name || "An organisation"} has invited you${donorName ? " (" + donorName + ")" : ""} to view their verified financial records on Tulip DS.

Accept your invitation here:
${inviteUrl}

This invite expires in 7 days.`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:30px">
            <div style="text-align:center;margin-bottom:30px">
              <h1 style="color:#0c7aed;font-size:24px;margin:0">Tulip DS</h1>
              <p style="color:#64748b;font-size:13px;margin-top:4px">Verification Infrastructure</p>
            </div>
            <h2 style="color:#1e293b;font-size:20px">You've been invited</h2>
            <p style="color:#475569;line-height:1.6">
              <strong>${tenant?.name || 'An organisation'}</strong> has invited you${donorName ? ` (${donorName})` : ''} to view their verified financial records on Tulip DS.
            </p>
            <div style="text-align:center;margin:30px 0">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;background-color:#0c7aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
                Accept Invitation
              </a>
            </div>
            <p style="color:#475569;font-size:12px;text-align:center;margin-top:8px">Or copy this link: <a href="" style="color:#0c7aed;word-break:break-all"></a></p>
            <p style="color:#94a3b8;font-size:13px">This invite expires in 7 days. If you did not expect this invitation, you can safely ignore it.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
            <p style="color:#94a3b8;font-size:11px;text-align:center">Tulip DS · Bright Bytes Technology · Dubai, UAE</p>
          </div>
        `
      })
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message)
    }

    await createAuditLog({ action: 'DONOR_INVITED', entityType: 'DonorInvite', entityId: invite.id, userId: req.user.userId || req.user.id, tenantId: req.user.tenantId }).catch(() => {})

    res.status(201).json({ id: invite.id, email, status: invite.status, expiresAt: invite.expiresAt })
  } catch (err) {
    console.error('createInvite error:', err)
    res.status(500).json({ error: 'Failed to create invite' })
  }
}

exports.listInvites = async (req, res) => {
  try {
    const invites = await prisma.donorInvite.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, inviteType: true, status: true, expiresAt: true, createdAt: true }
    })
    res.json({ data: invites })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invites' })
  }
}

exports.acceptInvite = async (req, res) => {
  try {
    const { token, firstName, lastName, password, donorName, donorType, country } = req.body
    if (!token || !firstName || !lastName || !password) {
      return res.status(400).json({ error: 'token, firstName, lastName, and password are required' })
    }

    const invite = await prisma.donorInvite.findUnique({ where: { token } })
    if (!invite) return res.status(404).json({ error: 'Invite not found' })
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite already used' })
    if (new Date() > invite.expiresAt) {
      await prisma.donorInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } })
      return res.status(400).json({ error: 'Invite has expired' })
    }

    // Create donor
    const donor = await prisma.donor.create({
      data: {
        name: donorName || `${firstName} ${lastName}`,
        organisationName: donorName || null,
        type: donorType || 'INDIVIDUAL',
        email: invite.email,
        country: country || null,
      }
    })

    // Create donor user
    const passwordHash = await bcrypt.hash(password, 10)
    const donorUser = await prisma.donorUser.create({
      data: { email: invite.email, passwordHash, donorId: donor.id, firstName, lastName }
    })

    // Mark invite as accepted
    await prisma.donorInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } })

    // Notify tenant admin (non-blocking)
    notifyMemberJoined({
      tenantId: invite.tenantId,
      memberName: `${firstName} ${lastName}`,
      memberEmail: invite.email,
    }).catch(() => {})

    res.status(201).json({ donor, donorUser: { id: donorUser.id, email: donorUser.email, firstName, lastName } })
  } catch (err) {
    console.error('acceptInvite error:', err)
    res.status(500).json({ error: 'Failed to accept invite' })
  }
}
