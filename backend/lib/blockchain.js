const { ethers } = require("ethers")

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL)

const wallet = new ethers.Wallet(
  process.env.BLOCKCHAIN_PRIVATE_KEY,
  provider
)

async function anchorHash(hash) {

  const tx = await wallet.sendTransaction({
    to: wallet.address,
    value: 0,
    data: ethers.hexlify(ethers.toUtf8Bytes(hash))
  })

  await tx.wait()

  return tx.hash
}

module.exports = { anchorHash }
