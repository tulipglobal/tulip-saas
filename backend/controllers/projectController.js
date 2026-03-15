const { createAuditLog } = require('../services/auditService')
// ─────────────────────────────────────────────────────────────
//  controllers/projectController.js — v3
//
//  Changes from v2:
//  ✔ GET / + GET /:id — budget summary from linked budget lines
// ─────────────────────────────────────────────────────────────

const tenantClient = require('../lib/tenantClient')
const prisma = require('../lib/client')
const { parsePagination, paginatedResponse } = require('../lib/paginate')

// GET /api/projects?page=1&limit=20&status=active&search=water
exports.getProjects = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)

    const where = {}
    if (req.query.status) where.status = req.query.status
    if (req.query.search) where.name   = { contains: req.query.search, mode: 'insensitive' }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        skip,
        take,
        include: {
          fundingSources: true,
          _count: { select: { documents: true, expenses: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.project.count({ where })
    ])

    // Compute budget summary per project from expenses linked to budget lines
    const projectIds = projects.map(p => p.id)
    const budgetSummaries = {}
    if (projectIds.length > 0) {
      // Get all expenses with budget lines for these projects
      const expenses = await prisma.expense.findMany({
        where: { projectId: { in: projectIds }, budgetLineId: { not: null } },
        select: { projectId: true, budgetLineId: true, amount: true, expenseType: true }
      })
      // Get unique budget line IDs
      const lineIds = [...new Set(expenses.map(e => e.budgetLineId).filter(Boolean))]
      const lines = lineIds.length > 0
        ? await prisma.budgetLine.findMany({
            where: { id: { in: lineIds } },
            select: { id: true, expenseType: true, approvedAmount: true }
          })
        : []
      const lineMap = {}
      for (const l of lines) lineMap[l.id] = l

      // Also get all budget lines for budgets linked via expenses to these projects
      const budgetIds = [...new Set(
        (await prisma.expense.findMany({
          where: { projectId: { in: projectIds }, budgetId: { not: null } },
          select: { projectId: true, budgetId: true },
          distinct: ['projectId', 'budgetId']
        })).map(e => e.budgetId).filter(Boolean)
      )]
      const allBudgetLines = budgetIds.length > 0
        ? await prisma.budgetLine.findMany({
            where: { budgetId: { in: budgetIds } },
            select: { id: true, budgetId: true, expenseType: true, approvedAmount: true }
          })
        : []

      // Map projectId -> budgetIds
      const projBudgetMap = {}
      const expBudgetRows = await prisma.expense.findMany({
        where: { projectId: { in: projectIds }, budgetId: { not: null } },
        select: { projectId: true, budgetId: true },
        distinct: ['projectId', 'budgetId']
      })
      for (const r of expBudgetRows) {
        if (!projBudgetMap[r.projectId]) projBudgetMap[r.projectId] = new Set()
        projBudgetMap[r.projectId].add(r.budgetId)
      }

      for (const pid of projectIds) {
        // Budget approved from linked budget lines
        const linkedBudgetIds = projBudgetMap[pid] || new Set()
        const projLines = allBudgetLines.filter(l => linkedBudgetIds.has(l.budgetId))
        const budgetCapex = projLines.filter(l => l.expenseType === 'CAPEX').reduce((s, l) => s + l.approvedAmount, 0)
        const budgetOpex = projLines.filter(l => l.expenseType === 'OPEX').reduce((s, l) => s + l.approvedAmount, 0)

        // Actual spend from expenses
        const projExpenses = expenses.filter(e => e.projectId === pid)
        const actualCapex = projExpenses.filter(e => e.expenseType === 'CAPEX').reduce((s, e) => s + e.amount, 0)
        const actualOpex = projExpenses.filter(e => e.expenseType === 'OPEX').reduce((s, e) => s + e.amount, 0)

        budgetSummaries[pid] = {
          budgetCapex, budgetOpex, budgetTotal: budgetCapex + budgetOpex,
          actualCapex, actualOpex, actualTotal: actualCapex + actualOpex,
        }
      }
    }

    const enriched = projects.map(p => ({
      ...p,
      budgetSummary: budgetSummaries[p.id] || null,
    }))

    res.json(paginatedResponse(enriched, total, page, limit))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
}

// GET /api/projects/:id
exports.getProject = async (req, res) => {
  try {
    const db      = tenantClient(req.user.tenantId)
    const project = await db.project.findFirst({
      where:   { id: req.params.id },
      include: { fundingSources: true, expenses: true, documents: true, budgets: { include: { lines: true, fundingSources: true }, orderBy: { createdAt: 'desc' } } }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Compute budget summary from expenses linked to budget lines
    const expensesWithBudget = await prisma.expense.findMany({
      where: { projectId: project.id, budgetId: { not: null } },
      select: { budgetId: true, budgetLineId: true, amount: true, expenseType: true }
    })
    const budgetIds = [...new Set(expensesWithBudget.map(e => e.budgetId).filter(Boolean))]
    const allLines = budgetIds.length > 0
      ? await prisma.budgetLine.findMany({
          where: { budgetId: { in: budgetIds } },
          select: { id: true, expenseType: true, approvedAmount: true }
        })
      : []

    const budgetCapex = allLines.filter(l => l.expenseType === 'CAPEX').reduce((s, l) => s + l.approvedAmount, 0)
    const budgetOpex = allLines.filter(l => l.expenseType === 'OPEX').reduce((s, l) => s + l.approvedAmount, 0)
    const actualCapex = expensesWithBudget.filter(e => e.expenseType === 'CAPEX').reduce((s, e) => s + e.amount, 0)
    const actualOpex = expensesWithBudget.filter(e => e.expenseType === 'OPEX').reduce((s, e) => s + e.amount, 0)

    const budgetSummary = (budgetCapex + budgetOpex) > 0 ? {
      budgetCapex, budgetOpex, budgetTotal: budgetCapex + budgetOpex,
      actualCapex, actualOpex, actualTotal: actualCapex + actualOpex,
    } : null

    res.json({ ...project, budgetSummary })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' })
  }
}

// POST /api/projects
exports.createProject = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, description, budget, startDate, endDate,
            fundingSourceType, funderType, funderName, donorOrgId,
            inviteEmail, inviteOrgName } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const project = await db.project.create({
      data: {
        name, description,
        budget: budget ? parseFloat(budget) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      }
    })

    // Create a FundingSource record linked to this project
    if (fundingSourceType) {
      await db.fundingSource.create({
        data: {
          projectId: project.id,
          name: funderName || fundingSourceType,
          fundingType: fundingSourceType,
          amount: 0,
          currency: 'USD',
          donorOrgId: donorOrgId || null,
          funderName: funderName || null,
          funderType: funderType || 'EXTERNAL',
        }
      })
    }

    // Grant DonorProjectAccess if an existing donor org was selected
    if (donorOrgId && funderType === 'PORTAL') {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2::uuid LIMIT 1`,
        donorOrgId, project.id
      )
      if (existing.length === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "DonorProjectAccess" ("donorOrgId", "projectId", "tenantId", "grantedBy")
           VALUES ($1, $2::uuid, $3, $4)`,
          donorOrgId, project.id, req.user.tenantId, req.user.id
        )
      } else {
        // Restore access if previously revoked
        await prisma.$executeRawUnsafe(
          `UPDATE "DonorProjectAccess" SET "revokedAt" = NULL WHERE "donorOrgId" = $1 AND "projectId" = $2::uuid`,
          donorOrgId, project.id
        )
      }
    }

    // Send donor invite if "Invite New" was chosen
    if (inviteEmail && inviteOrgName) {
      try {
        // Create DonorOrganisation if it doesn't exist
        const existingOrg = await prisma.$queryRawUnsafe(
          `SELECT id FROM "DonorOrganisation" WHERE LOWER(name) = LOWER($1) LIMIT 1`, inviteOrgName
        )
        let newDonorOrgId = existingOrg[0]?.id
        if (!newDonorOrgId) {
          const created = await prisma.$queryRawUnsafe(
            `INSERT INTO "DonorOrganisation" (name, type) VALUES ($1, 'Foundation') RETURNING id`, inviteOrgName
          )
          newDonorOrgId = created[0].id
        }

        // Grant project access to the new org
        const existingAccess = await prisma.$queryRawUnsafe(
          `SELECT id FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2::uuid LIMIT 1`,
          newDonorOrgId, project.id
        )
        if (existingAccess.length === 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "DonorProjectAccess" ("donorOrgId", "projectId", "tenantId", "grantedBy")
             VALUES ($1, $2::uuid, $3, $4)`,
            newDonorOrgId, project.id, req.user.tenantId, req.user.id
          )
        }

        // Create a DonorInvite record
        const crypto = require('crypto')
        const inviteToken = crypto.randomBytes(32).toString('hex')
        await prisma.donorInvite.create({
          data: {
            token: inviteToken,
            email: inviteEmail,
            inviteType: 'NGO_INVITES_DONOR',
            tenantId: req.user.tenantId,
            projectId: project.id,
            invitedByUserId: req.user.id,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          }
        }).catch(() => {})
      } catch (invErr) {
        console.error('Donor invite during project creation:', invErr.message)
      }
    }

    await createAuditLog({ action: 'PROJECT_CREATED', entityType: 'Project', entityId: project.id, userId: req.user.id, tenantId: req.user.tenantId }).catch(() => {})
    res.status(201).json(project)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create project' })
  }
}

// PUT /api/projects/:id
exports.updateProject = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.project.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    const { name, description, budget, status, startDate, endDate } = req.body
    const project = await db.project.update({
      where: { id: req.params.id },
      data: {
        ...(name        !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(budget      !== undefined && { budget: parseFloat(budget) }),
        ...(status      !== undefined && { status }),
        ...(startDate   !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate     !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      }
    })
    res.json(project)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' })
  }
}

// DELETE /api/projects/:id
exports.deleteProject = async (req, res) => {
  try {
    const db       = tenantClient(req.user.tenantId)
    const existing = await db.project.findFirst({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Project not found' })

    await db.project.delete({ where: { id: req.params.id } })
    res.json({ deleted: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' })
  }
}
