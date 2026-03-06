const { MerkleTree } = require("merkletreejs")
const keccak256 = require("keccak256")

function buildMerkleTree(hashes) {

  const leaves = hashes.map(h => keccak256(h))

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })

  return tree
}

function buildMerkleRoot(hashes) {

  const tree = buildMerkleTree(hashes)

  return tree.getRoot().toString("hex")
}

function generateProof(hashes, targetHash) {

  const tree = buildMerkleTree(hashes)

  const leaf = keccak256(targetHash)

  const proof = tree.getProof(leaf)

  return proof.map(p => p.data.toString("hex"))
}

module.exports = {
  buildMerkleRoot,
  generateProof
}
