/**
 * ============================================================
 *  TULIP PHASE 1–4 DIAGNOSTIC v2
 *  Stack: Polygon Amoy · PostgreSQL · Prisma (PascalCase tables)
 *
 *  CONFIG is pre-filled for your system.
 *  Make sure npm run dev is running before executing.
 *  Run: node tulip_diagnostic_v2.js
 * ============================================================
 */

const CONFIG = {
  BASE_URL:    "http://localhost:5050",
  API_KEY:     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwYmMwMTg3Yy1mZjliLTQ1Y2YtYjA1YS03YzZlZGQ1MTE3NjYiLCJ0ZW5hbnRJZCI6IjlkYjk5NmJmLTY3ODMtNDA2My1hOTdkLTY0YjdiMzMyMGY4NyIsImlhdCI6MTc3Mjc4MzA1OCwiZXhwIjoxNzczMzg3ODU4fQ.PbTrfio-2TSnXcJopnGgo--B9mxrq-mc0y8T5KwrJGM",
  DB_HOST:     "localhost",
  DB_PORT:     5432,
  DB_NAME:     "tulip",
  DB_USER:     "benzer",
  DB_PASS:     "",
  POLYGON_RPC: "https://polygon-amoy.g.alchemy.com/v2/Y8JtwW7zoygJG1ErfynJy",
};

const https  = require('https');
const http   = require('http');
const crypto = require('crypto');

// ── DB helper ─────────────────────────────────────────────
let pgClient = null;
async function dbQuery(sql, params = []) {
  if (!pgClient) {
    try {
      const { Client } = require('pg');
      pgClient = new Client({
        host: CONFIG.DB_HOST, port: CONFIG.DB_PORT,
        database: CONFIG.DB_NAME, user: CONFIG.DB_USER, password: CONFIG.DB_PASS
      });
      await pgClient.connect();
    } catch (e) {
      return { error: e.message };
    }
  }
  try {
    const res = await pgClient.query(sql, params);
    return { rows: res.rows };
  } catch (e) {
    return { error: e.message };
  }
}

// ── HTTP helper ───────────────────────────────────────────
function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve) => {
    const url = new URL(CONFIG.BASE_URL + path);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.API_KEY}`,
      ...extraHeaders
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = lib.request({
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search, method, headers
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── RPC helper ────────────────────────────────────────────
function rpcCall(method, params = []) {
  return new Promise((resolve) => {
    const url = new URL(CONFIG.POLYGON_RPC);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
    const req = lib.request({
      hostname: url.hostname, port: url.port || 443,
      path: url.pathname, method: 'POST', headers
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); } });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(payload);
    req.end();
  });
}

// ── Result tracker ────────────────────────────────────────
const results = [];
function record(phase, name, status, detail) {
  results.push({ phase, name, status, detail });
  const icon = status === 'PASS' ? '✔' : status === 'FAIL' ? '✖' : status === 'WARN' ? '⚠' : '?';
  console.log(`  ${icon} [${phase}] ${name}`);
  if (status !== 'PASS') console.log(`      → ${detail}`);
}

// ══════════════════════════════════════════════════════════
//  POLYGON
// ══════════════════════════════════════════════════════════
async function testPolygon() {
  console.log('\n━━━ POLYGON RPC ━━━');
  const chainRes = await rpcCall('eth_chainId');
  if (chainRes.error) { record('Polygon', 'RPC reachable', 'FAIL', chainRes.error); return; }
  const chainId = parseInt(chainRes.result, 16);
  const net = chainId === 137 ? 'Mainnet' : chainId === 80002 ? 'Amoy Testnet' : chainId === 80001 ? 'Mumbai' : `Unknown (${chainId})`;
  record('Polygon', 'RPC reachable', 'PASS', `Chain ID ${chainId} — ${net}`);

  const blockRes = await rpcCall('eth_blockNumber');
  if (!blockRes.error) record('Polygon', 'Latest block', 'PASS', `Block ${parseInt(blockRes.result, 16)}`);

  const gasRes = await rpcCall('eth_gasPrice');
  if (!gasRes.error) {
    const gwei = parseInt(gasRes.result, 16) / 1e9;
    record('Polygon', 'Gas price', gwei < 500 ? 'PASS' : 'WARN', `${gwei.toFixed(1)} gwei`);
  }
}

// ══════════════════════════════════════════════════════════
//  PHASE 1 — AUDIT LOG (table: "AuditLog")
// ══════════════════════════════════════════════════════════
async function testPhase1() {
  console.log('\n━━━ PHASE 1: Audit Logging ━━━');

  // Schema check
  const schema = await dbQuery(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog'
    ORDER BY ordinal_position
  `);

  if (schema.error || schema.rows.length === 0) {
    record('P1', 'AuditLog table accessible', 'FAIL', schema.error || 'Table not found');
    return;
  }

  const cols = schema.rows.map(r => r.column_name);
  record('P1', 'AuditLog table accessible', 'PASS', `${cols.length} columns: ${cols.join(', ')}`);

  // Required columns
  const required = ['id', 'createdAt', 'action', 'entityType', 'entityId', 'tenantId'];
  for (const c of required) {
    record('P1', `Required column: ${c}`, cols.includes(c) ? 'PASS' : 'FAIL',
      cols.includes(c) ? 'Present' : `MISSING — required for compliance`);
  }

  // Gap closure columns (added by our migration)
  const gapCols = ['dataHash', 'prevHash', 'blockchainTx', 'blockNumber', 'blockHash', 'anchorStatus', 'ancheredAt', 'batchId'];
  for (const c of gapCols) {
    record('P1', `Gap closure column: ${c}`, cols.includes(c) ? 'PASS' : 'FAIL',
      cols.includes(c) ? 'Present' : `MISSING — run migration from gap closure files`);
  }

  // Indexes
  const indexes = await dbQuery(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'AuditLog' AND schemaname = 'public'
  `);
  if (!indexes.error) {
    const idxNames = indexes.rows.map(r => r.indexname);
    record('P1', 'Indexes on AuditLog', idxNames.length >= 4 ? 'PASS' : 'WARN',
      `Found ${idxNames.length} indexes: ${idxNames.join(', ')}`);
  }

  // prevHash chain populated
  const chainCheck = await dbQuery(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN "prevHash" IS NOT NULL THEN 1 ELSE 0 END) as chained
    FROM "AuditLog"
  `);
  if (!chainCheck.error && chainCheck.rows.length > 0) {
    const { total, chained } = chainCheck.rows[0];
    const hasChain = parseInt(chained) > 0;
    record('P1', `prevHash chain populated (${chained}/${total} entries)`,
      hasChain ? 'PASS' : parseInt(total) === 0 ? 'WARN' : 'WARN',
      hasChain ? `${chained} entries have prevHash set` :
      parseInt(total) === 0 ? 'No AuditLog entries yet — create some activity first' :
      'No entries have prevHash — anchor service has not run yet');
  }

  // Recent activity
  const recent = await dbQuery(`SELECT COUNT(*) as cnt FROM "AuditLog" WHERE "createdAt" > NOW() - INTERVAL '24 hours'`);
  if (!recent.error) {
    const cnt = parseInt(recent.rows[0]?.cnt || 0);
    record('P1', 'Recent audit entries (last 24h)', cnt > 0 ? 'PASS' : 'WARN',
      cnt > 0 ? `${cnt} entries` : 'No recent entries — is the system receiving traffic?');
  }
}

// ══════════════════════════════════════════════════════════
//  PHASE 2 — HASH GENERATION
// ══════════════════════════════════════════════════════════
async function testPhase2() {
  console.log('\n━━━ PHASE 2: Hash Generation ━━━');

  // dataHash column exists (hashing stored in AuditLog)
  const hashCol = await dbQuery(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'AuditLog' AND column_name = 'dataHash'
  `);
  record('P2', 'dataHash column in AuditLog', !hashCol.error && hashCol.rows.length > 0 ? 'PASS' : 'FAIL',
    !hashCol.error && hashCol.rows.length > 0 ? 'Present' : 'Missing — migration not applied');

  // Check hashes are SHA-256 format (64 hex chars)
  const sampleHash = await dbQuery(`SELECT "dataHash" FROM "AuditLog" WHERE "dataHash" IS NOT NULL LIMIT 1`);
  if (!sampleHash.error && sampleHash.rows.length > 0) {
    const h = sampleHash.rows[0].dataHash;
    const isSHA256 = /^[a-f0-9]{64}$/i.test(h);
    record('P2', 'Hash algorithm is SHA-256', isSHA256 ? 'PASS' : 'FAIL',
      isSHA256 ? `Confirmed: ${h.slice(0, 16)}...` : `Unexpected format: ${h.slice(0, 32)}...`);
  } else {
    record('P2', 'Hash algorithm check', 'WARN', 'No hashed entries yet — run some mutations first');
  }

  // Audit endpoint exists
  const auditRes = await request('GET', '/api/audit-logs');
  record('P2', 'Audit logs API endpoint', auditRes.status > 0 && auditRes.status < 500 ? 'PASS' : 'WARN',
    auditRes.status === 0 ? auditRes.error : `HTTP ${auditRes.status}`);
}

// ══════════════════════════════════════════════════════════
//  PHASE 3 — MERKLE BATCHING (via batchId in AuditLog)
// ══════════════════════════════════════════════════════════
async function testPhase3() {
  console.log('\n━━━ PHASE 3: Merkle Batching ━━━');

  // batchId column
  const batchCol = await dbQuery(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'AuditLog' AND column_name = 'batchId'
  `);
  record('P3', 'batchId column in AuditLog', !batchCol.error && batchCol.rows.length > 0 ? 'PASS' : 'FAIL',
    !batchCol.error && batchCol.rows.length > 0 ? 'Present' : 'Missing — migration not applied');

  // Any batches exist?
  const batches = await dbQuery(`
    SELECT "batchId", COUNT(*) as cnt, MAX("createdAt") as latest
    FROM "AuditLog"
    WHERE "batchId" IS NOT NULL
    GROUP BY "batchId"
    ORDER BY latest DESC
    LIMIT 5
  `);

  if (batches.error) {
    record('P3', 'Batch data query', 'FAIL', batches.error);
  } else if (batches.rows.length === 0) {
    record('P3', 'Batches exist in AuditLog', 'WARN', 'No batches yet — scheduler has not run or no logs to anchor');
  } else {
    record('P3', 'Batches exist in AuditLog', 'PASS', `${batches.rows.length} batches found`);
    const latest = batches.rows[0];
    const cnt = parseInt(latest.cnt);
    record('P3', `Latest batch size (${cnt} entries)`, 'PASS',
      `batchId=${latest.batchId?.slice(0, 20)}..., entries=${cnt}, ` +
      (cnt % 2 !== 0 ? `ODD — verify Merkle duplication` : `EVEN — ok`));
  }

  // Batch verify endpoint
  if (batches.rows && batches.rows.length > 0) {
    const batchId = batches.rows[0].batchId;
    const verifyRes = await request('GET', `/api/verify/batch/${batchId}`);
    record('P3', 'Batch verify endpoint', verifyRes.status > 0 && verifyRes.status < 500 ? 'PASS' : 'WARN',
      verifyRes.status === 0 ? verifyRes.error : `HTTP ${verifyRes.status}`);
  }
}

// ══════════════════════════════════════════════════════════
//  PHASE 4 — ANCHORING
// ══════════════════════════════════════════════════════════
async function testPhase4Anchoring() {
  console.log('\n━━━ PHASE 4: Blockchain Anchoring ━━━');

  // All anchor columns present
  const anchorCols = await dbQuery(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'AuditLog'
    AND column_name IN ('blockchainTx','blockNumber','blockHash','anchorStatus','ancheredAt')
  `);
  if (anchorCols.error) {
    record('P4-Anchor', 'Anchor columns query', 'FAIL', anchorCols.error);
  } else {
    const cols = anchorCols.rows.map(r => r.column_name);
    const needed = ['blockchainTx', 'blockNumber', 'blockHash', 'anchorStatus', 'ancheredAt'];
    for (const c of needed) {
      record('P4-Anchor', `Column: ${c}`, cols.includes(c) ? 'PASS' : 'FAIL',
        cols.includes(c) ? 'Present' : 'MISSING — migration not applied');
    }
  }

  // Recent anchored entries
  const anchored = await dbQuery(`
    SELECT id, "blockchainTx", "blockNumber", "anchorStatus", "createdAt"
    FROM "AuditLog"
    WHERE "blockchainTx" IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 3
  `);

  if (anchored.error || anchored.rows.length === 0) {
    record('P4-Anchor', 'Anchored entries exist', 'WARN',
      anchored.error || 'No anchored entries yet — scheduler may not have run');
    return;
  }

  const latest = anchored.rows[0];
  record('P4-Anchor', 'Anchored entries exist', 'PASS',
    `${anchored.rows.length} anchored entries. Latest status: ${latest.anchorStatus}`);

  // Block number stored
  record('P4-Anchor', 'blockNumber stored', latest.blockNumber ? 'PASS' : 'FAIL',
    latest.blockNumber ? `Block ${latest.blockNumber}` : 'NULL — gap not closed yet');

  // Confirm TX on chain
  if (latest.blockchainTx) {
    const txRes = await rpcCall('eth_getTransactionByHash', [latest.blockchainTx]);
    if (txRes.error) {
      record('P4-Anchor', 'TX on Polygon chain', 'FAIL', `RPC error: ${txRes.error}`);
    } else if (!txRes.result) {
      record('P4-Anchor', 'TX on Polygon chain', 'FAIL', 'TX not found — possible reorg or wrong network');
    } else {
      const chainBlock = parseInt(txRes.result.blockNumber, 16);
      record('P4-Anchor', 'TX on Polygon chain', 'PASS', `Confirmed at block ${chainBlock}`);

      // Block number match
      if (latest.blockNumber) {
        record('P4-Anchor', 'Block number DB vs chain match',
          parseInt(latest.blockNumber) === chainBlock ? 'PASS' : 'FAIL',
          `DB: ${latest.blockNumber}, Chain: ${chainBlock}`);
      }

      // Finality depth
      const latestBlock = await rpcCall('eth_blockNumber');
      if (!latestBlock.error) {
        const depth = parseInt(latestBlock.result, 16) - chainBlock;
        record('P4-Anchor', `Finality depth (${depth} blocks)`, depth >= 128 ? 'PASS' : 'WARN',
          depth >= 128 ? `Safe — ${depth} blocks deep` : `Below 128-block threshold`);
      }
    }
  }

  // Stuck entries
  const stuck = await dbQuery(`
    SELECT COUNT(*) as cnt FROM "AuditLog"
    WHERE "anchorStatus" IN ('pending','failed')
    AND "createdAt" < NOW() - INTERVAL '1 hour'
  `);
  if (!stuck.error) {
    const cnt = parseInt(stuck.rows[0]?.cnt || 0);
    record('P4-Anchor', 'No stuck/failed anchors (>1h old)', cnt === 0 ? 'PASS' : 'FAIL',
      cnt === 0 ? 'Clean' : `${cnt} entries stuck in pending/failed — retry logic may not be working`);
  }
}

// ══════════════════════════════════════════════════════════
//  PHASE 4 — VERIFICATION API
// ══════════════════════════════════════════════════════════
async function testPhase4Verification() {
  console.log('\n━━━ PHASE 4: Verification API ━━━');

  // Get newest confirmed entry with prevHash (post-migration only)
  const hashRow = await dbQuery(`
    SELECT "dataHash" FROM "AuditLog"
    WHERE "anchorStatus" = 'confirmed'
      AND "dataHash" IS NOT NULL
      AND "dataHash" != ''
      AND "prevHash" IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  if (hashRow.error || hashRow.rows.length === 0) {
    record('P4-Verify', 'Confirmed hash available for test', 'WARN',
      'No confirmed anchored entries yet — test this after scheduler runs');
    return;
  }

  const testHash = hashRow.rows[0].dataHash;

  // Public access (no auth)
  const publicRes = await request('GET', `/api/verify/${testHash}`, null, { Authorization: '' });
  record('P4-Verify', 'Verify endpoint is public (no auth needed)',
    publicRes.status > 0 && publicRes.status !== 401 ? 'PASS' : 'WARN',
    publicRes.status === 401 ? 'Returns 401 without auth — third parties cannot verify' :
    publicRes.status === 0 ? publicRes.error : `HTTP ${publicRes.status}`);

  // Authenticated verify
  const verifyRes = await request('GET', `/api/verify/${testHash}`);
  if (verifyRes.status === 0 || verifyRes.status >= 500) {
    record('P4-Verify', 'Verify endpoint responds', 'FAIL',
      verifyRes.error || `HTTP ${verifyRes.status}`);
    return;
  }
  record('P4-Verify', 'Verify endpoint responds', 'PASS', `HTTP ${verifyRes.status}`);

  const body = verifyRes.body || {};
  const checks = {
    'verified field present':     body.verified !== undefined,
    'Merkle/integrity info':      !!(body.integrity || body.proof || body.merkle_proof),
    'blockchain.txHash present':  !!(body.blockchain?.txHash || body.txHash || body.tx_hash),
    'blockchain.blockNumber':     !!(body.blockchain?.blockNumber || body.blockNumber),
    'integrity.hashIntact':       body.integrity?.hashIntact === true,
    'integrity.chainIntact':      body.integrity?.chainIntact === true,
  };
  for (const [label, passed] of Object.entries(checks)) {
    record('P4-Verify', label, passed ? 'PASS' : 'FAIL',
      passed ? 'Present' : `Not found. Keys: ${Object.keys(body).join(', ')}`);
  }

  // Invalid hash returns false not error
  const fakeHash = crypto.randomBytes(32).toString('hex');
  const fakeRes = await request('GET', `/api/verify/${fakeHash}`);
  record('P4-Verify', 'Invalid hash → verified:false (not crash)',
    fakeRes.status < 500 ? 'PASS' : 'FAIL',
    `HTTP ${fakeRes.status}, verified=${fakeRes.body?.verified}`);
}

// ══════════════════════════════════════════════════════════
//  PHASE 4 — SCHEDULER
// ══════════════════════════════════════════════════════════
async function testPhase4Scheduler() {
  console.log('\n━━━ PHASE 4: Scheduler ━━━');

  // Scheduler file exists (check via anchorScheduler import indirectly)
  const schedRes = await request('GET', '/api/health');
  record('P4-Sched', 'API health endpoint', schedRes.status > 0 && schedRes.status < 500 ? 'PASS' : 'WARN',
    schedRes.status === 0 ? schedRes.error : `HTTP ${schedRes.status}`);

  // Any pending entries older than scheduler interval (5 mins from screenshot)
  const pending = await dbQuery(`
    SELECT COUNT(*) as cnt FROM "AuditLog"
    WHERE "anchorStatus" IS NULL
    AND "dataHash" IS NOT NULL
    AND "createdAt" < NOW() - INTERVAL '10 minutes'
  `);
  if (!pending.error) {
    const cnt = parseInt(pending.rows[0]?.cnt || 0);
    record('P4-Sched', 'No unprocessed hashes older than 10 min', cnt === 0 ? 'PASS' : 'WARN',
      cnt === 0 ? 'Scheduler keeping up' : `${cnt} hashed entries not yet batched/anchored`);
  }

  // Unanchored batches
  const unanchored = await dbQuery(`
    SELECT COUNT(DISTINCT "batchId") as cnt FROM "AuditLog"
    WHERE "batchId" IS NOT NULL
    AND "anchorStatus" IS NULL
    AND "createdAt" < NOW() - INTERVAL '10 minutes'
  `);
  if (!unanchored.error) {
    const cnt = parseInt(unanchored.rows[0]?.cnt || 0);
    record('P4-Sched', 'No unanchored batches older than 10 min', cnt === 0 ? 'PASS' : 'WARN',
      cnt === 0 ? 'All batches anchored' : `${cnt} batches not yet anchored`);
  }

  // Summary of anchorStatus distribution
  const statusDist = await dbQuery(`
    SELECT "anchorStatus", COUNT(*) as cnt
    FROM "AuditLog"
    GROUP BY "anchorStatus"
    ORDER BY cnt DESC
  `);
  if (!statusDist.error && statusDist.rows.length > 0) {
    const summary = statusDist.rows.map(r => `${r.anchorStatus || 'null'}:${r.cnt}`).join(', ');
    record('P4-Sched', 'AnchorStatus distribution', 'PASS', summary);
  }
}

// ══════════════════════════════════════════════════════════
//  REPORT
// ══════════════════════════════════════════════════════════
function printReport() {
  console.log('\n\n' + '═'.repeat(60));
  console.log(' TULIP DIAGNOSTIC REPORT — PHASE 1–4');
  console.log('═'.repeat(60));
  const pass  = results.filter(r => r.status === 'PASS').length;
  const fail  = results.filter(r => r.status === 'FAIL').length;
  const warn  = results.filter(r => r.status === 'WARN').length;
  console.log(`\n  ✔ PASS:  ${pass}`);
  console.log(`  ✖ FAIL:  ${fail}`);
  console.log(`  ⚠ WARN:  ${warn}`);
  console.log(`  Total:   ${results.length} checks\n`);

  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('─── FAILURES ───────────────────────────────────────────');
    failures.forEach(r => console.log(`  ✖ [${r.phase}] ${r.name}\n    → ${r.detail}`));
  }
  const warnings = results.filter(r => r.status === 'WARN');
  if (warnings.length > 0) {
    console.log('\n─── WARNINGS ────────────────────────────────────────────');
    warnings.forEach(r => console.log(`  ⚠ [${r.phase}] ${r.name}\n    → ${r.detail}`));
  }
  console.log('\n' + '═'.repeat(60));
  console.log(' PASTE THIS ENTIRE OUTPUT BACK TO CLAUDE');
  console.log('═'.repeat(60) + '\n');
  console.log('### CLAUDE_PARSE_START ###');
  console.log(JSON.stringify(results, null, 2));
  console.log('### CLAUDE_PARSE_END ###');
}

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════
async function main() {
  console.log('Tulip Phase 1–4 Diagnostic v2');
  console.log(`Target: ${CONFIG.BASE_URL}`);
  console.log(`DB:     ${CONFIG.DB_NAME}@${CONFIG.DB_HOST}`);
  console.log(`RPC:    ${CONFIG.POLYGON_RPC.slice(0, 50)}...`);
  console.log('─'.repeat(40));

  await testPolygon();
  await testPhase1();
  await testPhase2();
  await testPhase3();
  await testPhase4Anchoring();
  await testPhase4Verification();
  await testPhase4Scheduler();

  printReport();
  if (pgClient) { try { await pgClient.end(); } catch (e) {} }
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
