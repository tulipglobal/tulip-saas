// ─────────────────────────────────────────────────────────────
//  lib/sealedPdfGenerator.js
//
//  Generates a sealed PDF with Sealayer Verify branding:
//  - Certificate page with document thumbnail, QR code, hash, blockchain proof
//  - Original document pages appended after the certificate
// ─────────────────────────────────────────────────────────────

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const QRCode = require('qrcode')

const SEALAYER_PURPLE = rgb(60 / 255, 52 / 255, 137 / 255)  // #3C3489
const DARK_PURPLE = rgb(45 / 255, 39 / 255, 102 / 255)       // #2D2766
const GRAY = rgb(0.4, 0.4, 0.4)
const LIGHT_GRAY = rgb(0.6, 0.6, 0.6)
const BORDER_GRAY = rgb(0.85, 0.85, 0.85)
const BLACK = rgb(0.1, 0.1, 0.1)

/**
 * Generate a sealed PDF with QR code stamp.
 *
 * @param {Object} opts
 * @param {Buffer|null} opts.originalPdf — original PDF buffer (null = standalone cert)
 * @param {string} opts.sealId
 * @param {string} opts.rawHash — SHA-256 hex
 * @param {string} opts.documentTitle
 * @param {string} opts.issuedBy
 * @param {string} opts.issuedTo
 * @param {string} opts.createdAt — ISO date string
 * @param {string|null} opts.anchorTxHash — Polygon tx hash
 * @param {number|null} opts.blockNumber
 * @param {string|null} opts.anchoredAt — ISO date string
 * @returns {Promise<Buffer>} — sealed PDF bytes
 */
async function generateSealedPdf(opts) {
  const {
    originalPdf,
    sealId,
    rawHash,
    documentTitle,
    issuedBy,
    issuedTo,
    createdAt,
    anchorTxHash,
    blockNumber,
    anchoredAt,
  } = opts

  const verifyUrl = `https://verify.sealayer.io/seal/${sealId}`

  // Generate QR code as PNG buffer
  const qrPngBuffer = await QRCode.toBuffer(verifyUrl, {
    width: 200,
    margin: 1,
    color: { dark: '#3C3489', light: '#ffffff' },
    type: 'png',
  })

  // Create the certificate document
  const certDoc = await PDFDocument.create()
  const helvetica = await certDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await certDoc.embedFont(StandardFonts.HelveticaBold)
  const qrImage = await certDoc.embedPng(qrPngBuffer)

  // ── Certificate Page ──
  const page = certDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  // Header bar
  page.drawRectangle({
    x: 0, y: height - 80,
    width, height: 80,
    color: SEALAYER_PURPLE,
  })

  page.drawText('S', {
    x: 40, y: height - 55,
    size: 24, font: helveticaBold,
    color: rgb(1, 1, 1),
  })
  page.drawText('Sealayer Verify', {
    x: 68, y: height - 50,
    size: 18, font: helveticaBold,
    color: rgb(1, 1, 1),
  })
  page.drawText('Trust Seal Certificate', {
    x: 68, y: height - 66,
    size: 10, font: helvetica,
    color: rgb(1, 1, 1, 0.8),
  })

  // ── Document thumbnail (right side) ──
  const thumbX = 370
  const thumbY = height - 400
  const thumbW = 180
  const thumbH = 240

  // Thumbnail border
  page.drawRectangle({
    x: thumbX - 2, y: thumbY - 2,
    width: thumbW + 4, height: thumbH + 4,
    borderColor: BORDER_GRAY, borderWidth: 1,
    color: rgb(0.97, 0.97, 0.97),
  })

  if (originalPdf && originalPdf.length > 0) {
    try {
      const origDoc = await PDFDocument.load(originalPdf, { ignoreEncryption: true })
      const [embeddedPage] = await certDoc.embedPdf(origDoc, [0])
      const scale = Math.min(thumbW / embeddedPage.width, thumbH / embeddedPage.height)
      page.drawPage(embeddedPage, {
        x: thumbX + (thumbW - embeddedPage.width * scale) / 2,
        y: thumbY + (thumbH - embeddedPage.height * scale) / 2,
        width: embeddedPage.width * scale,
        height: embeddedPage.height * scale,
      })
    } catch {
      page.drawText('Document Preview', {
        x: thumbX + 30, y: thumbY + thumbH / 2,
        size: 10, font: helvetica, color: LIGHT_GRAY,
      })
    }
  } else {
    page.drawText('No Preview', {
      x: thumbX + 45, y: thumbY + thumbH / 2,
      size: 10, font: helvetica, color: LIGHT_GRAY,
    })
  }

  page.drawText('Original Document — Page 1', {
    x: thumbX + thumbW / 2 - helvetica.widthOfTextAtSize('Original Document — Page 1', 7) / 2,
    y: thumbY - 15, size: 7, font: helvetica, color: LIGHT_GRAY,
  })

  // ── Document info (left column) ──
  let y = height - 120

  const drawLabel = (label, value, yPos) => {
    page.drawText(label, { x: 40, y: yPos, size: 9, font: helveticaBold, color: GRAY })
    page.drawText(value || '—', { x: 40, y: yPos - 15, size: 11, font: helvetica, color: BLACK })
    return yPos - 40
  }

  y = drawLabel('DOCUMENT TITLE', documentTitle, y)
  y = drawLabel('ISSUED BY', issuedBy, y)
  y = drawLabel('ISSUED TO', issuedTo, y)
  y = drawLabel('ISSUE DATE', formatDate(createdAt), y)

  // Divider
  y -= 5
  page.drawLine({ start: { x: 40, y }, end: { x: 330, y }, thickness: 1, color: BORDER_GRAY })
  y -= 25

  // Integrity section
  page.drawText('DOCUMENT INTEGRITY', {
    x: 40, y, size: 11, font: helveticaBold, color: SEALAYER_PURPLE,
  })
  y -= 25

  page.drawText('SHA-256 HASH', { x: 40, y, size: 9, font: helveticaBold, color: GRAY })
  y -= 14
  page.drawText(rawHash, { x: 40, y, size: 7.5, font: helvetica, color: BLACK })
  y -= 25
  y = drawLabel('SEAL ID', sealId, y)

  // Blockchain section
  y -= 5
  page.drawLine({ start: { x: 40, y }, end: { x: 330, y }, thickness: 1, color: BORDER_GRAY })
  y -= 25

  page.drawText('BLOCKCHAIN ANCHOR', {
    x: 40, y, size: 11, font: helveticaBold, color: SEALAYER_PURPLE,
  })
  y -= 25

  if (anchorTxHash) {
    y = drawLabel('STATUS', 'Confirmed on Polygon', y)
    page.drawText('TRANSACTION HASH', { x: 40, y, size: 9, font: helveticaBold, color: GRAY })
    y -= 14
    page.drawText(anchorTxHash, { x: 40, y, size: 7.5, font: helvetica, color: BLACK })
    y -= 25
    if (blockNumber) {
      y = drawLabel('BLOCK NUMBER', String(blockNumber), y)
    }
    if (anchoredAt) {
      y = drawLabel('ANCHORED AT', formatDate(anchoredAt), y)
    }
  } else {
    y = drawLabel('STATUS', 'Pending blockchain anchor', y)
  }

  // QR Code section (bottom left)
  const qrSize = 90
  const qrX = 40
  const qrY = 140
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  page.drawText('Scan to verify independently', {
    x: qrX + qrSize + 15, y: qrY + qrSize - 15,
    size: 10, font: helveticaBold, color: SEALAYER_PURPLE,
  })
  page.drawText(verifyUrl, {
    x: qrX + qrSize + 15, y: qrY + qrSize - 30,
    size: 8, font: helvetica, color: GRAY,
  })

  // Footer divider
  page.drawLine({ start: { x: 40, y: 110 }, end: { x: width - 40, y: 110 }, thickness: 1, color: BORDER_GRAY })

  // Disclaimer
  page.drawText(
    'This document was sealed and verified by Sealayer Verify. The SHA-256 hash above',
    { x: 40, y: 90, size: 8, font: helvetica, color: LIGHT_GRAY }
  )
  page.drawText(
    'uniquely identifies the original document. Any modification will invalidate this certificate.',
    { x: 40, y: 78, size: 8, font: helvetica, color: LIGHT_GRAY }
  )

  // Footer branding
  page.drawText('Powered by Sealayer Verify — verify.sealayer.io', {
    x: width / 2 - helvetica.widthOfTextAtSize('Powered by Sealayer Verify — verify.sealayer.io', 8) / 2,
    y: 45, size: 8, font: helveticaBold, color: SEALAYER_PURPLE,
  })
  page.drawText(`Generated on ${new Date().toISOString().split('T')[0]}`, {
    x: 40, y: 30, size: 7, font: helvetica, color: LIGHT_GRAY,
  })

  // ── Append original document pages ──
  if (originalPdf && originalPdf.length > 0) {
    try {
      const origDoc = await PDFDocument.load(originalPdf, { ignoreEncryption: true })
      const pageIndices = origDoc.getPageIndices()
      const copiedPages = await certDoc.copyPages(origDoc, pageIndices)
      for (const p of copiedPages) {
        certDoc.addPage(p)
      }
    } catch (err) {
      console.error('[sealedPdfGenerator] Failed to append original pages:', err.message)
    }
  }

  const pdfBytes = await certDoc.save()
  return Buffer.from(pdfBytes)
}

function formatDate(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    const day = d.getDate()
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    const hours = d.getHours().toString().padStart(2, '0')
    const mins = d.getMinutes().toString().padStart(2, '0')
    return `${day} ${month} ${year} at ${hours}:${mins}`
  } catch {
    return isoStr
  }
}

module.exports = { generateSealedPdf }
