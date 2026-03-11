// ─────────────────────────────────────────────────────────────
//  lib/pdfPageHasher.js
//
//  Splits a PDF buffer into individual pages and returns
//  SHA-256 hashes for each page plus the full document hash.
// ─────────────────────────────────────────────────────────────

const { PDFDocument } = require('pdf-lib')
const crypto = require('crypto')

/**
 * @param {Buffer} pdfBuffer — raw PDF bytes
 * @returns {Promise<{ fullHash: string, pageHashes: string[] }>}
 */
async function hashPdfPages(pdfBuffer) {
  const fullHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

  let pageHashes = []
  try {
    const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    const pageCount = srcDoc.getPageCount()

    for (let i = 0; i < pageCount; i++) {
      const singlePageDoc = await PDFDocument.create()
      const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [i])
      singlePageDoc.addPage(copiedPage)
      const singlePageBytes = await singlePageDoc.save()
      const pageHash = crypto.createHash('sha256').update(Buffer.from(singlePageBytes)).digest('hex')
      pageHashes.push(pageHash)
    }
  } catch (err) {
    // If PDF parsing fails (encrypted, malformed), return only full hash
    pageHashes = []
  }

  return { fullHash, pageHashes }
}

module.exports = { hashPdfPages }
