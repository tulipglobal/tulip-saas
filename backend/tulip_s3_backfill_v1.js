// ─────────────────────────────────────────────────────────────
//  tulip_s3_backfill_v1.js
//
//  Backfills ALL existing confirmed batches to S3.
//  Safe to run multiple times — skips already-archived batches.
//
//  Run from backend/:
//    node tulip_s3_backfill_v1.js
// ─────────────────────────────────────────────────────────────

require('dotenv').config()
const prisma = require('./lib/client')
const { archiveBatch, isArchived } = require('./services/archiveService')

async function main() {
  console.log('Starting S3 backfill for all confirmed batches...\n')

  // Get all distinct confirmed batchIds
  const batches = await prisma.auditLog.findMany({
    where:    { anchorStatus: 'confirmed', batchId: { not: null } },
    distinct: ['batchId'],
    orderBy:  { ancheredAt: 'asc' },
    select:   { batchId: true, tenantId: true, ancheredAt: true, blockchainTx: true }
  })

  if (batches.length === 0) {
    console.log('No confirmed batches found.')
    return
  }

  console.log(`Found ${batches.length} confirmed batch(es) to check.\n`)

  let archived = 0, skipped = 0, failed = 0

  for (const batch of batches) {
    const { batchId, tenantId, ancheredAt } = batch

    try {
      // Check if already archived — skip if so
      const already = await isArchived(tenantId, batchId, ancheredAt)
      if (already) {
        console.log(`  ⏭  ${batchId.slice(0, 16)}... already in S3 — skipped`)
        skipped++
        continue
      }

      // Archive to S3
      const result = await archiveBatch(batchId)
      console.log(`  ✔  ${batchId.slice(0, 16)}... → ${result.s3Key} (${result.recordCount} records)`)
      archived++

    } catch (err) {
      console.log(`  ✖  ${batchId.slice(0, 16)}... → Error: ${err.message}`)
      failed++
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Backfill complete`)
  console.log(`   Archived: ${archived}`)
  console.log(`   Skipped:  ${skipped} (already in S3)`)
  console.log(`   Failed:   ${failed}`)
  console.log(`   Bucket:   ${process.env.AWS_S3_BUCKET || 'tulipglobal.org'}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main()
  .catch(e => console.error('Fatal:', e))
  .finally(() => prisma.$disconnect())
