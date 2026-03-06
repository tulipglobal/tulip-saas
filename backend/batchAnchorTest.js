require("dotenv").config()

const { anchorBatch } = require("./services/batchAnchorService")

async function run() {

  try {

    console.log("Starting batch anchor test...")

    await anchorBatch()

    console.log("Batch process finished")

  } catch (err) {

    console.error("Batch error:", err)

  }

}

run()
