// ─────────────────────────────────────────────────────────────
//  controllers/budgetController.js
//  CRUD for Budget + BudgetLine + BudgetFundingSource
// ─────────────────────────────────────────────────────────────
const tenantClient = require('../lib/tenantClient')
const prisma = require('../lib/client')
const { createAuditLog } = require('../services/auditService')
const { parsePagination, paginatedResponse } = require('../lib/paginate')
const { autoIssueSeal } = require('../services/universalSealService')

// ─── List budgets ────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)
    const where = {}
    if (req.query.status) where.status = req.query.status
    if (req.query.projectId) where.projectId = req.query.projectId

    const [budgets, total] = await Promise.all([
      db.budget.findMany({
        where, skip, take,
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
          fundingSources: true,
          project: { select: { id: true, name: true } },
          _count: { select: { fundingAgreements: true, expenses: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.budget.count({ where })
    ])

    // compute spent per budget
    const ids = budgets.map(b => b.id)
    const spentRaw = ids.length > 0
      ? await prisma.expense.groupBy({
          by: ['budgetId'],
          where: { budgetId: { in: ids } },
          _sum: { amount: true }
        })
      : []
    const spentMap = {}
    for (const r of spentRaw) spentMap[r.budgetId] = Number(r._sum.amount || 0)

    const enriched = budgets.map(b => {
      const totalApproved = b.lines.reduce((s, l) => s + l.approvedAmount, 0)
      const totalFunded = b.fundingSources.reduce((s, f) => s + f.amount, 0)
      return { ...b, totalApproved, totalFunded, spent: spentMap[b.id] || 0 }
    })

    res.json(paginatedResponse(enriched, total, page, limit))
  } catch (err) {
    console.error('budget list error:', err)
    res.status(500).json({ error: 'Failed to list budgets' })
  }
}

// ─── Get single budget ───────────────────────────────────────
exports.get = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const budget = await db.budget.findUnique({
      where: { id: req.params.id },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        fundingSources: { orderBy: { createdAt: 'asc' } },
        project: { select: { id: true, name: true } },
        fundingAgreements: {
          select: {
            id: true, title: true, totalAmount: true, currency: true,
            status: true, sourceType: true, sourceSubType: true,
            donor: { select: { id: true, name: true } }
          }
        },
        expenses: {
          select: {
            id: true, description: true, amount: true, currency: true,
            expenseType: true, category: true, subCategory: true,
            budgetLineId: true, createdAt: true, approvalStatus: true,
            project: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })

    // compute spent per line
    const lineSpentRaw = budget.lines.length > 0
      ? await prisma.expense.groupBy({
          by: ['budgetLineId'],
          where: { budgetLineId: { in: budget.lines.map(l => l.id) } },
          _sum: { amount: true }
        })
      : []
    const lineSpentMap = {}
    for (const r of lineSpentRaw) lineSpentMap[r.budgetLineId] = Number(r._sum.amount || 0)

    const linesWithSpent = budget.lines.map(l => ({
      ...l,
      spent: lineSpentMap[l.id] || 0,
      remaining: l.approvedAmount - (lineSpentMap[l.id] || 0)
    }))

    const totalApproved = budget.lines.reduce((s, l) => s + l.approvedAmount, 0)
    const totalSpent = Object.values(lineSpentMap).reduce((s, v) => s + v, 0)
    const totalFunded = budget.fundingSources.reduce((s, f) => s + f.amount, 0)

    res.json({
      ...budget,
      lines: linesWithSpent,
      totalApproved,
      totalSpent,
      totalFunded,
      remaining: totalApproved - totalSpent
    })
  } catch (err) {
    console.error('budget get error:', err)
    res.status(500).json({ error: 'Failed to get budget' })
  }
}

// ─── Create budget with lines + funding sources ──────────────
exports.create = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { name, periodFrom, periodTo, status, notes, lines, projectId, fundingSources } = req.body

    if (!name || !periodFrom || !periodTo) {
      return res.status(400).json({ error: 'name, periodFrom, and periodTo are required' })
    }
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one budget line is required' })
    }

    // Compute totals for approval validation
    const totalBudget = lines.reduce((s, l) => s + Number(l.approvedAmount || 0), 0)
    const totalFunded = (fundingSources || []).reduce((s, f) => s + Number(f.amount || 0), 0)
    const requestedStatus = status || 'DRAFT'

    if (requestedStatus === 'APPROVED' && totalFunded < totalBudget) {
      return res.status(400).json({
        error: `Cannot approve: budget requires $${totalBudget.toLocaleString()} but only $${totalFunded.toLocaleString()} funded`
      })
    }

    const budget = await db.budget.create({
      data: {
        name,
        projectId,
        periodFrom: new Date(periodFrom),
        periodTo: new Date(periodTo),
        status: requestedStatus,
        notes: notes || null,
        lines: {
          create: lines.map(l => ({
            expenseType: l.expenseType,
            category: l.category,
            subCategory: l.subCategory || null,
            description: l.description || null,
            approvedAmount: Number(l.approvedAmount),
            currency: l.currency || 'USD'
          }))
        },
        ...(fundingSources && fundingSources.length > 0 && {
          fundingSources: {
            create: fundingSources.map(f => ({
              sourceType: f.sourceType,
              sourceSubType: f.sourceSubType || null,
              donorName: f.donorName,
              amount: Number(f.amount),
              currency: f.currency || 'USD',
              agreementFileKey: f.agreementFileKey || null,
              agreementHash: f.agreementHash || null,
            }))
          }
        })
      },
      include: { lines: true, fundingSources: true }
    })

    await createAuditLog({
      action: 'budget.created',
      entityType: 'Budget',
      entityId: budget.id,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      details: { name, lineCount: lines.length, fundingSourceCount: (fundingSources || []).length }
    })

    // Create ImpactInvestment records for Impact Investment funding sources
    if (fundingSources && fundingSources.length > 0) {
      // Look up donorOrgId from DonorProjectAccess
      let donorOrgId = null
      try {
        const dpaRows = await prisma.$queryRawUnsafe(
          `SELECT dpa."donorOrgId" FROM "DonorProjectAccess" dpa
           WHERE dpa."projectId" = $1::uuid AND dpa."revokedAt" IS NULL
           LIMIT 1`,
          projectId
        )
        if (dpaRows.length > 0) donorOrgId = dpaRows[0].donorOrgId
      } catch {}

      for (const f of fundingSources) {
        if (f.sourceType === 'Impact Investment') {
          try {
            const subType = (f.sourceSubType || 'LOAN').toUpperCase()
            const instrumentType = subType.includes('EQUITY') ? 'EQUITY'
              : subType.includes('OUTCOME') ? 'OUTCOME_BASED'
              : subType.includes('REVENUE') ? 'REVENUE_SHARE' : 'LOAN'

            const facility = Number(f.amount) || 0
            const rate = Number(f.interestRate) || 0
            const term = f.termMonths ? Number(f.termMonths) : null
            const grace = Number(f.gracePeriodMonths) || 0
            const startDate = periodFrom ? new Date(periodFrom) : new Date()

            const invRows = await prisma.$queryRawUnsafe(
              `INSERT INTO "ImpactInvestment" (
                "projectId", "tenantId", "donorOrgId", "investmentType",
                "totalFacility", currency, "interestRate", "interestType",
                "termMonths", "gracePeriodMonths", "startDate", notes, status
              ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE')
              RETURNING *`,
              projectId,
              req.user.tenantId,
              donorOrgId,
              instrumentType,
              facility,
              f.currency || 'USD',
              rate,
              f.interestType || 'FIXED',
              term,
              grace,
              startDate,
              `${f.donorName} — ${instrumentType} via budget "${name}"`
            )

            const investment = invRows[0]

            // Auto-generate repayment schedule if requested
            if (f.autoGenerateSchedule !== false && term && term > 0) {
              const repaymentMonths = term - grace
              if (repaymentMonths > 0) {
                const principalDue = facility / repaymentMonths
                let remainingPrincipal = facility

                for (let i = 1; i <= repaymentMonths; i++) {
                  const dueDate = new Date(startDate)
                  dueDate.setMonth(dueDate.getMonth() + grace + i)
                  const interestDue = Math.round((remainingPrincipal * (rate / 100 / 12)) * 100) / 100
                  const totalDue = Math.round((principalDue + interestDue) * 100) / 100

                  await prisma.$queryRawUnsafe(
                    `INSERT INTO "RepaymentSchedule" (
                      "investmentId", "instalmentNumber", "dueDate",
                      "principalDue", "interestDue", "totalDue", status
                    ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 'PENDING')`,
                    investment.id, i, dueDate,
                    Math.round(principalDue * 100) / 100,
                    interestDue, totalDue
                  )
                  remainingPrincipal -= principalDue
                }
              }
            }
          } catch (invErr) {
            console.error('Failed to create ImpactInvestment for budget funding source:', invErr.message)
          }
        }
      }
    }

    res.status(201).json(budget)
  } catch (err) {
    console.error('budget create error:', err)
    res.status(500).json({ error: 'Failed to create budget' })
  }
}

// ─── Update budget ───────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const existing = await db.budget.findUnique({
      where: { id: req.params.id },
      include: { lines: true, fundingSources: true }
    })
    if (!existing) return res.status(404).json({ error: 'Budget not found' })

    const { name, periodFrom, periodTo, status, notes, lines } = req.body
    const data = {}
    if (name !== undefined) data.name = name
    if (periodFrom !== undefined) data.periodFrom = new Date(periodFrom)
    if (periodTo !== undefined) data.periodTo = new Date(periodTo)
    if (notes !== undefined) data.notes = notes

    // Approval validation
    if (status !== undefined) {
      if (status === 'APPROVED') {
        const budgetLines = lines || existing.lines
        const totalBudget = budgetLines.reduce((s, l) => s + Number(l.approvedAmount || 0), 0)
        const totalFunded = existing.fundingSources.reduce((s, f) => s + f.amount, 0)
        if (totalFunded < totalBudget) {
          return res.status(400).json({
            error: `Cannot approve: budget requires $${totalBudget.toLocaleString()} but only $${totalFunded.toLocaleString()} funded`
          })
        }
      }
      data.status = status
    }

    const budget = await db.budget.update({
      where: { id: req.params.id },
      data,
      include: { lines: true, fundingSources: true }
    })

    // If lines are provided, upsert them
    if (lines && Array.isArray(lines)) {
      const existingLineIds = budget.lines.map(l => l.id)
      const incomingIds = lines.filter(l => l.id).map(l => l.id)

      const toDelete = existingLineIds.filter(id => !incomingIds.includes(id))
      if (toDelete.length > 0) {
        await prisma.budgetLine.deleteMany({ where: { id: { in: toDelete } } })
      }

      for (const l of lines) {
        if (l.id && existingLineIds.includes(l.id)) {
          await prisma.budgetLine.update({
            where: { id: l.id },
            data: {
              expenseType: l.expenseType,
              category: l.category,
              subCategory: l.subCategory || null,
              description: l.description || null,
              approvedAmount: Number(l.approvedAmount),
              currency: l.currency || 'USD'
            }
          })
        } else {
          await prisma.budgetLine.create({
            data: {
              budgetId: budget.id,
              expenseType: l.expenseType,
              category: l.category,
              subCategory: l.subCategory || null,
              description: l.description || null,
              approvedAmount: Number(l.approvedAmount),
              currency: l.currency || 'USD'
            }
          })
        }
      }
    }

    const updated = await db.budget.findUnique({
      where: { id: req.params.id },
      include: { lines: true, fundingSources: true }
    })

    await createAuditLog({
      action: 'budget.updated',
      entityType: 'Budget',
      entityId: budget.id,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      details: { changes: Object.keys(data) }
    })

    res.json(updated)
  } catch (err) {
    console.error('budget update error:', err)
    res.status(500).json({ error: 'Failed to update budget' })
  }
}

// ─── Add funding source to budget ────────────────────────────
exports.addFundingSource = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const budget = await db.budget.findUnique({ where: { id: req.params.id } })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })

    const { sourceType, sourceSubType, donorName, amount, currency, agreementFileKey, agreementHash,
            interestRate, interestType, gracePeriodMonths, termMonths, autoGenerateSchedule } = req.body
    if (!sourceType || !donorName || !amount) {
      return res.status(400).json({ error: 'sourceType, donorName, and amount are required' })
    }

    const source = await prisma.budgetFundingSource.create({
      data: {
        budgetId: req.params.id,
        sourceType,
        sourceSubType: sourceSubType || null,
        donorName,
        amount: Number(amount),
        currency: currency || 'USD',
        agreementFileKey: agreementFileKey || null,
        agreementHash: agreementHash || null,
      }
    })

    await createAuditLog({
      action: 'budget.funding_source.added',
      entityType: 'Budget',
      entityId: req.params.id,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      details: { sourceType, donorName, amount: Number(amount) }
    })

    // Create ImpactInvestment record for Impact Investment sources
    if (sourceType === 'Impact Investment') {
      try {
        const subType = (sourceSubType || 'LOAN').toUpperCase()
        const instrumentType = subType.includes('EQUITY') ? 'EQUITY'
          : subType.includes('OUTCOME') ? 'OUTCOME_BASED'
          : subType.includes('REVENUE') ? 'REVENUE_SHARE' : 'LOAN'

        // Look up donorOrgId from DonorProjectAccess for this project
        let donorOrgId = null
        const dpaRows = await prisma.$queryRawUnsafe(
          `SELECT dpa."donorOrgId" FROM "DonorProjectAccess" dpa
           WHERE dpa."projectId" = $1::uuid AND dpa."revokedAt" IS NULL
           LIMIT 1`,
          budget.projectId
        )
        if (dpaRows.length > 0) donorOrgId = dpaRows[0].donorOrgId

        const facility = Number(amount) || 0
        const rate = Number(interestRate) || 0
        const term = termMonths ? Number(termMonths) : null
        const grace = Number(gracePeriodMonths) || 0
        const startDate = budget.periodFrom || new Date()

        const invRows = await prisma.$queryRawUnsafe(
          `INSERT INTO "ImpactInvestment" (
            "projectId", "tenantId", "donorOrgId", "investmentType",
            "totalFacility", currency, "interestRate", "interestType",
            "termMonths", "gracePeriodMonths", "startDate", notes, status
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE')
          RETURNING *`,
          budget.projectId,
          req.user.tenantId,
          donorOrgId,
          instrumentType,
          facility,
          currency || 'USD',
          rate,
          interestType || 'FIXED',
          term,
          grace,
          new Date(startDate),
          `${donorName} — ${instrumentType} via budget "${budget.name}"`
        )

        const investment = invRows[0]

        // Auto-generate repayment schedule if requested and term specified
        if (autoGenerateSchedule !== false && term && term > 0) {
          const repaymentMonths = term - grace
          if (repaymentMonths > 0) {
            const principalDue = facility / repaymentMonths
            let remainingPrincipal = facility

            for (let i = 1; i <= repaymentMonths; i++) {
              const dueDate = new Date(startDate)
              dueDate.setMonth(dueDate.getMonth() + grace + i)
              const interestDue = Math.round((remainingPrincipal * (rate / 100 / 12)) * 100) / 100
              const totalDue = Math.round((principalDue + interestDue) * 100) / 100

              await prisma.$queryRawUnsafe(
                `INSERT INTO "RepaymentSchedule" (
                  "investmentId", "instalmentNumber", "dueDate",
                  "principalDue", "interestDue", "totalDue", status
                ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 'PENDING')`,
                investment.id, i, dueDate,
                Math.round(principalDue * 100) / 100,
                interestDue, totalDue
              )
              remainingPrincipal -= principalDue
            }
          }
        }
      } catch (invErr) {
        console.error('Failed to create ImpactInvestment from funding source:', invErr.message)
      }
    }

    // Auto-issue Trust Seal for agreement document (non-blocking)
    if (agreementHash) {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { name: true } })
      const orgName = tenant?.name || 'Organization'
      autoIssueSeal({
        documentTitle: `${donorName} — Funding Agreement`,
        documentType: 'budget-agreement',
        rawHash: agreementHash,
        issuedBy: orgName,
        issuedTo: orgName,
        tenantId: req.user.tenantId,
        fileKey: agreementFileKey || null,
        metadata: { source: 'budget-funding-source', budgetId: req.params.id, sourceId: source.id },
      }).catch(err => console.error('[seal] budget agreement seal failed:', err.message))
    }

    res.status(201).json(source)
  } catch (err) {
    console.error('add funding source error:', err)
    res.status(500).json({ error: 'Failed to add funding source' })
  }
}

// ─── Remove funding source from budget ───────────────────────
exports.removeFundingSource = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const budget = await db.budget.findUnique({ where: { id: req.params.id } })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })

    const source = await prisma.budgetFundingSource.findUnique({ where: { id: req.params.sourceId } })
    if (!source || source.budgetId !== req.params.id) {
      return res.status(404).json({ error: 'Funding source not found' })
    }

    await prisma.budgetFundingSource.delete({ where: { id: req.params.sourceId } })

    res.json({ ok: true })
  } catch (err) {
    console.error('remove funding source error:', err)
    res.status(500).json({ error: 'Failed to remove funding source' })
  }
}

// ─── List all funding sources across budgets (for Funding tab) ─
exports.listAllFundingSources = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { page, limit, skip, take } = parsePagination(req)

    // Get all budget IDs for this tenant
    const budgets = await db.budget.findMany({
      select: { id: true, name: true, status: true }
    })
    const budgetIds = budgets.map(b => b.id)
    const budgetMap = {}
    for (const b of budgets) budgetMap[b.id] = b

    const [sources, total] = await Promise.all([
      prisma.budgetFundingSource.findMany({
        where: { budgetId: { in: budgetIds } },
        skip, take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.budgetFundingSource.count({ where: { budgetId: { in: budgetIds } } })
    ])

    const enriched = sources.map(s => ({
      ...s,
      budget: budgetMap[s.budgetId] || null
    }))

    res.json(paginatedResponse(enriched, total, page, limit))
  } catch (err) {
    console.error('list all funding sources error:', err)
    res.status(500).json({ error: 'Failed to list funding sources' })
  }
}

// ─── Delete budget (only DRAFT) ──────────────────────────────
exports.remove = async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const budget = await db.budget.findUnique({ where: { id: req.params.id } })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })
    if (budget.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT budgets can be deleted' })
    }

    await db.budget.delete({ where: { id: req.params.id } })

    await createAuditLog({
      action: 'budget.deleted',
      entityType: 'Budget',
      entityId: req.params.id,
      userId: req.user.id,
      tenantId: req.user.tenantId
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('budget delete error:', err)
    res.status(500).json({ error: 'Failed to delete budget' })
  }
}
