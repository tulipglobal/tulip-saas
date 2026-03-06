// ─────────────────────────────────────────────────────────────
//  tulip_anchorService_v2.js
//  Deploy to: src/services/anchorService.js
//
//  Changes from v1:
//  ✔ Stores blockNumber + blockHash (not just TX hash)
//  ✔ Tracks anchorStatus (pending → confirmed / failed)
//  ✔ Reorg detection at block N+256
//  ✔ Failed TX retry with gas bump
//  ✔ prevHash chain on AuditLog entries
//  ✔ Gas estimation with 20% buffer
//  ✔ Dual RPC fallback
//  ✔ hashRecord() matches auditService.js canonical payload
//  ✔ Uses shared prisma client (../prisma/client)
// ─────────────────────────────────────────────────────────────

const { ethers }  = require('ethers');
const prisma       = require('../../prisma/client');
const crypto       = require('crypto');

const RPC_PRIMARY  = process.env.POLYGON_RPC_PRIMARY;
const RPC_FALLBACK = process.env.POLYGON_RPC_FALLBACK;
const WALLET_KEY   = process.env.ANCHOR_WALLET_KEY;
const CONFIRMATIONS= parseInt(process.env.ANCHOR_CONFIRMATIONS || '128');
const REORG_RECHECK= parseInt(process.env.REORG_RECHECK_BLOCKS || '256');
const MAX_RETRIES  = parseInt(process.env.ANCHOR_MAX_RETRIES    || '3');

function getProvider() {
  try   { return new ethers.JsonRpcProvider(RPC_PRIMARY); }
  catch { return new ethers.JsonRpcProvider(RPC_FALLBACK); }
}

// ── Must match auditService.js generateHash() payload exactly ─
function hashRecord(record) {
  const canonical = JSON.stringify({
    id:         record.id,
    action:     record.action,
    entityType: record.entityType,
    entityId:   record.entityId,
    userId:     record.userId      ?? null,
    tenantId:   record.tenantId,
    createdAt:  record.createdAt instanceof Date
                  ? record.createdAt.toISOString()
                  : new Date(record.createdAt).toISOString(),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function buildHashChain(records, tenantId) {
  const last = await prisma.auditLog.findFirst({
    where:   { tenantId, prevHash: { not: null } },
    orderBy: { createdAt: 'desc' },
    select:  { dataHash: true },
  });

  let previousHash = last?.dataHash || '0'.repeat(64);
  const updates = [];
  for (const record of records) {
    const dataHash = hashRecord(record);
    updates.push({ id: record.id, dataHash, prevHash: previousHash });
    previousHash = dataHash;
  }
  return updates;
}

async function anchorBatch(batchId, auditLogIds, tenantId) {
  const provider = getProvider();
  const wallet   = new ethers.Wallet(WALLET_KEY, provider);

  const records = await prisma.auditLog.findMany({
    where:   { id: { in: auditLogIds }, tenantId },
    orderBy: { createdAt: 'asc' },
  });
  if (records.length === 0) throw new Error(`No records found for batch ${batchId}`);

  const chainUpdates = await buildHashChain(records, tenantId);
  const leaves       = chainUpdates.map(u => u.dataHash);
  const merkleRoot   = buildMerkleRoot(leaves);
  const anchorData   = ethers.hexlify(ethers.toUtf8Bytes(`tulip:${batchId}:${merkleRoot}`));

  let gasLimit;
  try {
    const est = await provider.estimateGas({ to: wallet.address, data: anchorData });
    gasLimit = (est * 120n) / 100n;
  } catch { gasLimit = 100000n; }

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const balance  = await provider.getBalance(wallet.address);
  if (balance < gasLimit * gasPrice) throw new Error('Insufficient MATIC balance');

  let tx, attempt = 0, lastError;
  while (attempt < MAX_RETRIES) {
    try {
      const bumpedGas = (gasPrice * BigInt(100 + attempt * 20)) / 100n;
      tx = await wallet.sendTransaction({ to: wallet.address, data: anchorData, gasLimit, gasPrice: bumpedGas });
      break;
    } catch (err) {
      lastError = err; attempt++;
      await sleep(2000 * attempt);
    }
  }
  if (!tx) throw new Error(`All ${MAX_RETRIES} attempts failed: ${lastError?.message}`);

  await prisma.$transaction(
    chainUpdates.map(u => prisma.auditLog.update({
      where: { id: u.id },
      data:  { dataHash: u.dataHash, prevHash: u.prevHash, batchId, anchorStatus: 'pending' },
    }))
  );

  waitForConfirmation(tx.hash, batchId, auditLogIds, tenantId, provider).catch(console.error);
  return { txHash: tx.hash, batchId, status: 'pending' };
}

async function waitForConfirmation(txHash, batchId, auditLogIds, tenantId, provider) {
  try {
    const receipt = await provider.waitForTransaction(txHash, CONFIRMATIONS);
    if (!receipt || receipt.status === 0) {
      await markBatchFailed(batchId, 'TX reverted'); return;
    }
    const block = await provider.getBlock(receipt.blockNumber);
    await prisma.auditLog.updateMany({
      where: { batchId, tenantId },
      data:  { blockchainTx: txHash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, anchorStatus: 'confirmed', ancheredAt: new Date(block.timestamp * 1000) },
    });
    scheduleReorgCheck(txHash, batchId, auditLogIds, tenantId, receipt.blockNumber, provider);
  } catch (err) {
    await markBatchFailed(batchId, err.message);
  }
}

async function scheduleReorgCheck(txHash, batchId, auditLogIds, tenantId, confirmedBlock, provider) {
  const targetBlock = confirmedBlock + REORG_RECHECK;
  const poll = async () => {
    const current = await provider.getBlockNumber();
    if (current < targetBlock) { setTimeout(poll, 30000); return; }
    const tx = await provider.getTransaction(txHash);
    if (!tx || tx.blockNumber === null) {
      await prisma.auditLog.updateMany({ where: { batchId, tenantId }, data: { anchorStatus: 'reorg_detected' } });
      await anchorBatch(`${batchId}-reanchor-${Date.now()}`, auditLogIds, tenantId);
    }
  };
  setTimeout(poll, 30000);
}

async function markBatchFailed(batchId, reason) {
  console.error(`[anchor] Batch ${batchId} failed: ${reason}`);
  await prisma.auditLog.updateMany({ where: { batchId }, data: { anchorStatus: 'failed' } });
}

function buildMerkleRoot(leaves) {
  if (leaves.length === 0) throw new Error('Empty leaves');
  if (leaves.length === 1) return leaves[0];
  const level = [...leaves];
  if (level.length % 2 !== 0) level.push(level[level.length - 1]);
  const next = [];
  for (let i = 0; i < level.length; i += 2)
    next.push(crypto.createHash('sha256').update(level[i] + level[i+1]).digest('hex'));
  return buildMerkleRoot(next);
}

async function retryFailedBatches() {
  const failed = await prisma.auditLog.findMany({
    where: { anchorStatus: { in: ['failed','reorg_detected'] } },
    select: { id: true, batchId: true, tenantId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (failed.length === 0) return;
  const batches = failed.reduce((acc, r) => {
    if (!acc[r.batchId]) acc[r.batchId] = { ids: [], tenantId: r.tenantId };
    acc[r.batchId].ids.push(r.id);
    return acc;
  }, {});
  for (const [batchId, { ids, tenantId }] of Object.entries(batches))
    await anchorBatch(`${batchId}-retry-${Date.now()}`, ids, tenantId).catch(console.error);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { anchorBatch, retryFailedBatches, buildMerkleRoot, hashRecord };
