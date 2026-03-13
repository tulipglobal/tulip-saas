// ─────────────────────────────────────────────────────────────
//  routes/workflowRoutes.js — Workflow approval engine
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const { createAuditLog } = require('../services/auditService')
const { sendEmail } = require('../services/emailService')

const APP_URL = process.env.APP_URL || 'https://app.tulipds.com'

// ── Helper: check if user is admin ───────────────────────────
async function isAdmin(userId, tenantId) {
  const adminRole = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId,
      role: { name: 'admin' },
    },
  })
  return !!adminRole
}

// ── Helper: get admin emails for a tenant ────────────────────
async function getAdminEmails(tenantId) {
  return prisma.user.findMany({
    where: {
      tenantId,
      deletedAt: null,
      roles: { some: { role: { name: 'admin' } } },
    },
    select: { id: true, email: true, name: true },
  })
}

// ── Helper: build approval email HTML ────────────────────────
function buildEmailHtml({ heading, body, ctaText, ctaUrl }) {
  return [
    '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:30px">',
    '<div style="text-align:center;margin-bottom:30px">',
    '<h1 style="color:#0c7aed;font-size:24px;margin:0">Tulip DS</h1>',
    '<p style="color:#64748b;font-size:13px;margin-top:4px">Verification Infrastructure</p>',
    '</div>',
    `<h2 style="color:#1e293b;font-size:20px;margin:0 0 16px">${heading}</h2>`,
    `<p style="color:#475569;font-size:14px;line-height:1.6">${body}</p>`,
    '<div style="text-align:center;margin:30px 0">',
    `<a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;background-color:#0c7aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">${ctaText}</a>`,
    '</div>',
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>',
    '<p style="color:#94a3b8;font-size:11px;text-align:center">Tulip DS</p>',
    '</div>',
  ].join('')
}

// ── GET /api/workflow/summary ─────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const [pending, inReview, approved, rejected] = await Promise.all([
      prisma.workflowTask.count({ where: { tenantId, status: 'pending' } }),
      prisma.workflowTask.count({ where: { tenantId, status: 'in_review' } }),
      prisma.workflowTask.count({ where: { tenantId, status: 'approved' } }),
      prisma.workflowTask.count({ where: { tenantId, status: 'rejected' } }),
    ])
    res.json({ pending, inReview, approved, rejected })
  } catch (err) {
    console.error('[workflow/summary]', err)
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

// ── GET /api/workflow/tasks ──────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const where = { tenantId }
    if (req.query.status) where.status = req.query.status
    if (req.query.type) where.type = req.query.type
    if (req.query.assignedTo) where.assignedTo = req.query.assignedTo

    const tasks = await prisma.workflowTask.findMany({
      where,
      include: { comments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    // Resolve user names
    const userIds = new Set()
    for (const t of tasks) {
      if (t.submittedBy) userIds.add(t.submittedBy)
      if (t.assignedTo) userIds.add(t.assignedTo)
      for (const c of t.comments) userIds.add(c.userId)
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true, email: true },
    })
    const userMap = {}
    for (const u of users) userMap[u.id] = u

    const enriched = tasks.map(t => ({
      ...t,
      submitter: userMap[t.submittedBy] || null,
      assignee: userMap[t.assignedTo] || null,
      comments: t.comments.map(c => ({ ...c, user: userMap[c.userId] || null })),
    }))

    res.json({ data: enriched })
  } catch (err) {
    console.error('[workflow/tasks]', err)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

// ── GET /api/workflow/tasks/:id ──────────────────────────────
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await prisma.workflowTask.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const userIds = new Set([task.submittedBy])
    if (task.assignedTo) userIds.add(task.assignedTo)
    for (const c of task.comments) userIds.add(c.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true, email: true },
    })
    const userMap = {}
    for (const u of users) userMap[u.id] = u

    res.json({
      ...task,
      submitter: userMap[task.submittedBy] || null,
      assignee: userMap[task.assignedTo] || null,
      comments: task.comments.map(c => ({ ...c, user: userMap[c.userId] || null })),
    })
  } catch (err) {
    console.error('[workflow/tasks/:id]', err)
    res.status(500).json({ error: 'Failed to fetch task' })
  }
})

// ── POST /api/workflow/tasks ─────────────────────────────────
router.post('/tasks', async (req, res) => {
  try {
    const { tenantId, userId } = req.user
    const { type, title, description, entityId, entityType, assignedTo } = req.body

    if (!type || !title || !entityId || !entityType) {
      return res.status(400).json({ error: 'type, title, entityId, entityType are required' })
    }

    // Auto-assign to first admin if not specified
    let assignee = assignedTo || null
    if (!assignee) {
      const admins = await getAdminEmails(tenantId)
      if (admins.length > 0) assignee = admins[0].id
    }

    const task = await prisma.workflowTask.create({
      data: {
        tenantId,
        type,
        title,
        description: description || null,
        entityId,
        entityType,
        submittedBy: userId,
        assignedTo: assignee,
      },
      include: { comments: true },
    })

    // Email admins about new task
    const admins = await getAdminEmails(tenantId)
    const submitter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
    for (const admin of admins) {
      sendEmail({
        to: admin.email,
        subject: `Review Required — ${title}`,
        html: buildEmailHtml({
          heading: 'Review Required',
          body: `<strong>${submitter?.name || 'A team member'}</strong> has submitted a ${entityType} for approval: <strong>${title}</strong>`,
          ctaText: 'Review Now',
          ctaUrl: `${APP_URL}/dashboard/workflow`,
        }),
      }).catch(() => {})
    }

    await createAuditLog({
      action: 'WORKFLOW_TASK_CREATED', entityType: 'WorkflowTask', entityId: task.id,
      userId, tenantId,
    }).catch(() => {})

    res.status(201).json(task)
  } catch (err) {
    console.error('[workflow/create]', err)
    res.status(500).json({ error: 'Failed to create task' })
  }
})

// ── PATCH /api/workflow/tasks/:id/status ─────────────────────
router.patch('/tasks/:id/status', async (req, res) => {
  try {
    const { tenantId, userId } = req.user
    const { status, comment } = req.body

    if (!status) return res.status(400).json({ error: 'status is required' })

    const task = await prisma.workflowTask.findFirst({
      where: { id: req.params.id, tenantId },
    })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const userIsAdmin = await isAdmin(userId, tenantId)

    // Permission check: members can only submit for review
    if (!userIsAdmin && status !== 'in_review') {
      return res.status(403).json({ error: 'Only admins can approve or reject tasks' })
    }

    const updateData = { status }
    if (status === 'approved' || status === 'rejected') {
      updateData.resolvedAt = new Date()
    }

    const updated = await prisma.workflowTask.update({
      where: { id: req.params.id },
      data: updateData,
    })

    // Add comment if provided
    if (comment) {
      await prisma.workflowComment.create({
        data: { taskId: task.id, userId, comment },
      })
    }

    // Update entity approval status
    if (status === 'approved' || status === 'rejected') {
      try {
        if (task.entityType === 'document') {
          await prisma.document.update({
            where: { id: task.entityId },
            data: { approvalStatus: status },
          })
        } else if (task.entityType === 'expense') {
          await prisma.expense.update({
            where: { id: task.entityId },
            data: {
              approvalStatus: status,
              approvedBy: userId,
              approvedAt: new Date(),
              approvalNote: comment || null,
            },
          })

          // Release held seal on approval so anchor cron can pick it up
          if (status === 'approved') {
            const expense = await prisma.expense.findUnique({
              where: { id: task.entityId },
              select: { receiptSealId: true },
            })
            if (expense?.receiptSealId) {
              await prisma.trustSeal.update({
                where: { id: expense.receiptSealId },
                data: { status: 'pending' },
              }).catch(err => console.error('[workflow] seal release failed:', err.message))
            }
          }
        }
      } catch (entityErr) {
        console.error('[workflow] Failed to update entity status:', entityErr.message)
      }
    }

    // Email notifications
    const submitter = await prisma.user.findUnique({ where: { id: task.submittedBy }, select: { email: true, name: true } })
    const reviewer = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    if (submitter && (status === 'approved' || status === 'rejected')) {
      const isApproved = status === 'approved'
      sendEmail({
        to: submitter.email,
        subject: `${isApproved ? '✅ Approved' : '❌ Rejected'} — ${task.title}`,
        html: buildEmailHtml({
          heading: isApproved ? 'Approved' : 'Rejected',
          body: isApproved
            ? `Your ${task.entityType} <strong>${task.title}</strong> has been approved by <strong>${reviewer?.name || 'an admin'}</strong>.`
            : `Your ${task.entityType} <strong>${task.title}</strong> was rejected by <strong>${reviewer?.name || 'an admin'}</strong>.${comment ? `<br/><br/>Comment: <em>${comment}</em>` : ''}`,
          ctaText: 'View Details',
          ctaUrl: `${APP_URL}/dashboard/workflow`,
        }),
      }).catch(() => {})
    }

    await createAuditLog({
      action: `WORKFLOW_TASK_${status.toUpperCase()}`, entityType: 'WorkflowTask', entityId: task.id,
      userId, tenantId,
    }).catch(() => {})

    res.json(updated)
  } catch (err) {
    console.error('[workflow/status]', err)
    res.status(500).json({ error: 'Failed to update task status' })
  }
})

// ── POST /api/workflow/tasks/:id/comment ─────────────────────
router.post('/tasks/:id/comment', async (req, res) => {
  try {
    const { tenantId, userId } = req.user
    const { comment } = req.body
    if (!comment) return res.status(400).json({ error: 'comment is required' })

    const task = await prisma.workflowTask.findFirst({
      where: { id: req.params.id, tenantId },
    })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const wc = await prisma.workflowComment.create({
      data: { taskId: task.id, userId, comment },
    })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
    res.status(201).json({ ...wc, user })
  } catch (err) {
    console.error('[workflow/comment]', err)
    res.status(500).json({ error: 'Failed to add comment' })
  }
})

module.exports = router
