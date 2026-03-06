require("dotenv").config()
const { anchorHash } = require("./lib/blockchain")

async function test() {

  const hash = "Tulip Audit Test " + Date.now()

  console.log("Sending test hash:", hash)

  const txHash = await anchorHash(hash)

  console.log("Blockchain TX:", txHash)
}

test()
