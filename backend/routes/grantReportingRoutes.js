// ─────────────────────────────────────────────────────────────
//  routes/grantReportingRoutes.js — Sprint 8 Section D
//
//  Grant Reporting Config (legal entity, indirect costs, bank).
//  Uses raw SQL for GrantReportingConfig table.
//  Mounted at /api/ngo/grant-reporting-config with auth+tenantScope.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// Auth + tenantScope applied at mount level in app.js

// ── GET /api/ngo/grant-reporting-config ──────────────────────
// Returns GrantReportingConfig for tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenantId

    const rows = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GrantReportingConfig" WHERE "tenantId" = $1
    `, tenantId)

    res.json(rows[0] || null)
  } catch (err) {
    console.error('Grant reporting config fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch grant reporting config' })
  }
})

// ── PUT /api/ngo/grant-reporting-config ──────────────────────
// Upsert config (INSERT ON CONFLICT UPDATE)
router.put('/', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const {
      legalName, registeredAddress, country, ein, vatNumber,
      charityRegNumber, legalRepName, legalRepTitle, legalRepEmail,
      legalRepPhone, federalAgencyName, organizationalElement,
      basisOfAccounting, indirectExpenseType, indirectExpenseRate,
      ueiNumber, euIndirectCostRate, designatedBankName,
      designatedAccountNumber, designatedBankAddress
    } = req.body

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "GrantReportingConfig" (
        id, "tenantId",
        "legalName", "registeredAddress", country, ein, "vatNumber",
        "charityRegNumber", "legalRepName", "legalRepTitle", "legalRepEmail",
        "legalRepPhone", "federalAgencyName", "organizationalElement",
        "basisOfAccounting", "indirectExpenseType", "indirectExpenseRate",
        "ueiNumber", "euIndirectCostRate", "designatedBankName",
        "designatedAccountNumber", "designatedBankAddress",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1,
        $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19,
        $20, $21,
        NOW(), NOW()
      )
      ON CONFLICT ("tenantId") DO UPDATE SET
        "legalName" = COALESCE($2, "GrantReportingConfig"."legalName"),
        "registeredAddress" = COALESCE($3, "GrantReportingConfig"."registeredAddress"),
        country = COALESCE($4, "GrantReportingConfig".country),
        ein = COALESCE($5, "GrantReportingConfig".ein),
        "vatNumber" = COALESCE($6, "GrantReportingConfig"."vatNumber"),
        "charityRegNumber" = COALESCE($7, "GrantReportingConfig"."charityRegNumber"),
        "legalRepName" = COALESCE($8, "GrantReportingConfig"."legalRepName"),
        "legalRepTitle" = COALESCE($9, "GrantReportingConfig"."legalRepTitle"),
        "legalRepEmail" = COALESCE($10, "GrantReportingConfig"."legalRepEmail"),
        "legalRepPhone" = COALESCE($11, "GrantReportingConfig"."legalRepPhone"),
        "federalAgencyName" = COALESCE($12, "GrantReportingConfig"."federalAgencyName"),
        "organizationalElement" = COALESCE($13, "GrantReportingConfig"."organizationalElement"),
        "basisOfAccounting" = COALESCE($14, "GrantReportingConfig"."basisOfAccounting"),
        "indirectExpenseType" = COALESCE($15, "GrantReportingConfig"."indirectExpenseType"),
        "indirectExpenseRate" = COALESCE($16, "GrantReportingConfig"."indirectExpenseRate"),
        "ueiNumber" = COALESCE($17, "GrantReportingConfig"."ueiNumber"),
        "euIndirectCostRate" = COALESCE($18, "GrantReportingConfig"."euIndirectCostRate"),
        "designatedBankName" = COALESCE($19, "GrantReportingConfig"."designatedBankName"),
        "designatedAccountNumber" = COALESCE($20, "GrantReportingConfig"."designatedAccountNumber"),
        "designatedBankAddress" = COALESCE($21, "GrantReportingConfig"."designatedBankAddress"),
        "updatedAt" = NOW()
      RETURNING *
    `,
      tenantId,
      legalName || null, registeredAddress || null, country || null, ein || null, vatNumber || null,
      charityRegNumber || null, legalRepName || null, legalRepTitle || null, legalRepEmail || null,
      legalRepPhone || null, federalAgencyName || null, organizationalElement || null,
      basisOfAccounting || null, indirectExpenseType || null, indirectExpenseRate !== undefined ? Number(indirectExpenseRate) : null,
      ueiNumber || null, euIndirectCostRate !== undefined ? Number(euIndirectCostRate) : null, designatedBankName || null,
      designatedAccountNumber || null, designatedBankAddress || null
    )

    res.json(rows[0])
  } catch (err) {
    console.error('Grant reporting config upsert error:', err)
    res.status(500).json({ error: 'Failed to save grant reporting config' })
  }
})

module.exports = router
