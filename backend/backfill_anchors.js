/**
 * ============================================================
 *  TULIP — Phase 4 Backfill Script
 *  Fetches blockNumber + blockHash from Polygon for existing
 *  anchored AuditLog rows and updates the DB.
 *
 *  Run ONCE:  node backfill_anchors.js
 * ============================================================
 */

require('dotenv').config();
const { ethers } = require('ethers');
const { Client } = require('pg');

const RPC      = process.env.POLYGON_RPC_PRIMARY || 'https://polygon-amoy.g.alchemy.com/v2/Y8JtwW7zoygJG1ErfynJy';
const DB_URL   = process.env.DATABASE_URL        || 'postgresql://benzer@localhost:5432/tulip';

async function main() {
  console.log('Phase 4 Backfill — blockNumber + anchorStatus');
  console.log(`RPC: ${RPC.slice(0, 50)}...`);
  console.log(`DB:  ${DB_URL.split('@')[1]}\n`);

  const provider = new ethers.JsonRpcProvider(RPC);
  const db = new Client({ connectionString: DB_URL });
  await db.connect();

  // Fetch all rows with blockchainTx but missing blockNumber
  const { rows } = await db.query(`
    SELECT DISTINCT "blockchainTx"
    FROM "AuditLog"
    WHERE "blockchainTx" IS NOT NULL
      AND "blockNumber" IS NULL
  `);

  if (rows.length === 0) {
    console.log('✔ Nothing to backfill — all anchored rows already have blockNumber.');
    await db.end();
    return;
  }

  console.log(`Found ${rows.length} unique TX hash(es) to backfill:\n`);

  for (const { blockchainTx } of rows) {
    process.stdout.write(`  Fetching ${blockchainTx.slice(0, 20)}... `);

    try {
      const receipt = await provider.getTransactionReceipt(blockchainTx);

      if (!receipt) {
        console.log('✖ Not found on chain (possible reorg or wrong network)');
        // Mark as failed so retry logic can pick it up
        await db.query(`
          UPDATE "AuditLog"
          SET "anchorStatus" = 'failed'
          WHERE "blockchainTx" = $1
        `, [blockchainTx]);
        continue;
      }

      const block = await provider.getBlock(receipt.blockNumber);
      const anchoredAt = new Date(block.timestamp * 1000);

      console.log(`✔ Block ${receipt.blockNumber}, status=${receipt.status === 1 ? 'confirmed' : 'failed'}`);

      // Update all rows sharing this TX hash
      const result = await db.query(`
        UPDATE "AuditLog"
        SET
          "blockNumber"  = $1,
          "blockHash"    = $2,
          "anchorStatus" = $3,
          "ancheredAt"   = $4
        WHERE "blockchainTx" = $5
      `, [
        receipt.blockNumber,
        receipt.blockHash,
        receipt.status === 1 ? 'confirmed' : 'failed',
        anchoredAt,
        blockchainTx
      ]);

      console.log(`     Updated ${result.rowCount} row(s)`);

    } catch (err) {
      console.log(`✖ Error: ${err.message}`);
    }
  }

  // Final state check
  console.log('\n── Final AuditLog anchor state ─────────────────────');
  const { rows: final } = await db.query(`
    SELECT id, "blockNumber", "anchorStatus", "ancheredAt"
    FROM "AuditLog"
    WHERE "blockchainTx" IS NOT NULL
    ORDER BY "createdAt"
  `);
  for (const r of final) {
    console.log(`  ${r.id.slice(0, 8)}... block=${r.blockNumber} status=${r.anchorStatus} at=${r.ancheredAt}`);
  }

  await db.end();
  console.log('\n✔ Backfill complete. Re-run the diagnostic to confirm.\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
