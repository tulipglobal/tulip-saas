const prisma = require("../lib/client")
const { generateProof } = require("../lib/merkle")

async function getAuditProof(auditId) {

  const audit = await prisma.auditLog.findUnique({
    where: { id: auditId }
  })

  if (!audit) {
    throw new Error("Audit log not found")
  }

  const batchLogs = await prisma.auditLog.findMany({
    where: { batchId: audit.batchId }
  })

  const hashes = batchLogs.map(l => l.dataHash)

  const proof = generateProof(hashes, audit.dataHash)

  return {
    auditId: audit.id,
    dataHash: audit.dataHash,
    batchId: audit.batchId,
    blockchainTx: audit.blockchainTx,
    merkleProof: proof
  }

}

module.exports = { getAuditProof }
