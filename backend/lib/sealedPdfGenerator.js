// ─────────────────────────────────────────────────────────────
//  lib/sealedPdfGenerator.js
//
//  Generates a sealed PDF by stamping a QR code + seal metadata
//  onto the last page of the original PDF. If there's no original
//  PDF, creates a standalone seal certificate page.
// ─────────────────────────────────────────────────────────────

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const QRCode = require('qrcode')

const TULIP_BLUE = rgb(12 / 255, 122 / 255, 237 / 255) // #0c7aed
const GRAY = rgb(0.4, 0.4, 0.4)
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85)

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
    color: { dark: '#0c7aed', light: '#ffffff' },
    type: 'png',
  })

  let pdfDoc

  if (originalPdf && originalPdf.length > 0) {
    // Load original PDF and stamp on last page
    try {
      pdfDoc = await PDFDocument.load(originalPdf, { ignoreEncryption: true })
    } catch {
      // If we can't load the original, create standalone
      pdfDoc = await PDFDocument.create()
    }
  } else {
    pdfDoc = await PDFDocument.create()
  }

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Embed QR code image
  const qrImage = await pdfDoc.embedPng(qrPngBuffer)

  // Add a seal certificate page at the end
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  // ── Header bar ──
  page.drawRectangle({
    x: 0, y: height - 80,
    width, height: 80,
    color: TULIP_BLUE,
  })

  page.drawText('TULIP DS', {
    x: 40, y: height - 35,
    size: 22, font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  page.drawText('Trust Seal Certificate', {
    x: 40, y: height - 58,
    size: 13, font: helvetica,
    color: rgb(1, 1, 1, 0.85),
  })

  // ── QR code (top right) ──
  const qrSize = 100
  const qrX = width - qrSize - 40
  const qrY = height - 200
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  page.drawText('Scan to verify', {
    x: qrX + 12, y: qrY - 14,
    size: 8, font: helvetica, color: GRAY,
  })

  // ── Document info ──
  let y = height - 120

  const drawLabel = (label, value, yPos) => {
    page.drawText(label, { x: 40, y: yPos, size: 9, font: helveticaBold, color: GRAY })
    page.drawText(value || '—', { x: 40, y: yPos - 15, size: 11, font: helvetica, color: rgb(0.1, 0.1, 0.1) })
    return yPos - 40
  }

  y = drawLabel('DOCUMENT TITLE', documentTitle, y)
  y = drawLabel('ISSUED BY', issuedBy, y)
  y = drawLabel('ISSUED TO', issuedTo, y)
  y = drawLabel('ISSUE DATE', formatDate(createdAt), y)

  // ── Divider ──
  y -= 5
  page.drawLine({
    start: { x: 40, y }, end: { x: width - 40, y },
    thickness: 1, color: LIGHT_GRAY,
  })
  y -= 25

  // ── Integrity section ──
  page.drawText('DOCUMENT INTEGRITY', {
    x: 40, y, size: 11, font: helveticaBold, color: TULIP_BLUE,
  })
  y -= 25

  y = drawLabel('SHA-256 HASH', rawHash, y)
  y = drawLabel('SEAL ID', sealId, y)

  // ── Blockchain section ──
  y -= 5
  page.drawLine({
    start: { x: 40, y }, end: { x: width - 40, y },
    thickness: 1, color: LIGHT_GRAY,
  })
  y -= 25

  page.drawText('BLOCKCHAIN ANCHOR', {
    x: 40, y, size: 11, font: helveticaBold, color: TULIP_BLUE,
  })
  y -= 25

  if (anchorTxHash) {
    y = drawLabel('STATUS', 'Confirmed on Polygon', y)
    y = drawLabel('TRANSACTION HASH', anchorTxHash, y)
    if (blockNumber) {
      y = drawLabel('BLOCK NUMBER', String(blockNumber), y)
    }
    if (anchoredAt) {
      y = drawLabel('ANCHORED AT', formatDate(anchoredAt), y)
    }
  } else {
    y = drawLabel('STATUS', 'Pending blockchain anchor', y)
  }

  // ── Verify URL ──
  y -= 10
  page.drawLine({
    start: { x: 40, y }, end: { x: width - 40, y },
    thickness: 1, color: LIGHT_GRAY,
  })
  y -= 25

  page.drawText('VERIFY ONLINE', {
    x: 40, y, size: 9, font: helveticaBold, color: GRAY,
  })
  y -= 16
  page.drawText(verifyUrl, {
    x: 40, y, size: 10, font: helvetica, color: TULIP_BLUE,
  })

  // ── Footer ──
  page.drawText(
    'This document was sealed and verified by Tulip DS. The SHA-256 hash above uniquely identifies the original document.',
    { x: 40, y: 60, size: 8, font: helvetica, color: GRAY, maxWidth: width - 80 }
  )
  page.drawText(
    `Generated on ${new Date().toISOString().split('T')[0]}`,
    { x: 40, y: 40, size: 7, font: helvetica, color: LIGHT_GRAY }
  )

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

function formatDate(isoStr) {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

module.exports = { generateSealedPdf }
