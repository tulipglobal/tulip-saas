// backend/services/ocrPdfService.js
// Generates a clean normalised PDF from the structured document data
const PDFDocument = require('pdfkit')

async function generateOcrPdf(doc, assessment, jobId) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 50, size: 'A4' })
    const buffers = []

    pdf.on('data', chunk => buffers.push(chunk))
    pdf.on('end', () => resolve(Buffer.concat(buffers)))
    pdf.on('error', reject)

    const colors = {
      primary: '#1a1a2e',
      accent: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      light: '#f8fafc',
      border: '#e2e8f0',
      text: '#374151',
      muted: '#6b7280'
    }

    // ── Header ──────────────────────────────────────────────────────────────
    pdf.rect(0, 0, pdf.page.width, 80).fill(colors.primary)
    pdf.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('TULIP DS', 50, 25)
    pdf.fontSize(10).font('Helvetica')
      .text('Document Verification Platform', 50, 50)
    
    // Document type badge
    const docTypeLabel = (doc.documentType || 'DOCUMENT').toUpperCase().replace('_', ' ')
    pdf.fontSize(12).font('Helvetica-Bold')
      .text(docTypeLabel, pdf.page.width - 200, 30, { width: 150, align: 'right' })
    pdf.fontSize(9).font('Helvetica')
      .text('NORMALISED & VERIFIED', pdf.page.width - 200, 50, { width: 150, align: 'right' })

    pdf.moveDown(3)

    // ── Risk Badge ───────────────────────────────────────────────────────────
    const riskColor = assessment.riskLevel === 'low' ? colors.accent 
      : assessment.riskLevel === 'medium' ? colors.warning : colors.danger
    
    pdf.rect(50, pdf.y, pdf.page.width - 100, 40).fill(riskColor + '20')
    pdf.rect(50, pdf.y, 4, 40).fill(riskColor)
    
    const yBadge = pdf.y + 8
    pdf.fillColor(riskColor).fontSize(11).font('Helvetica-Bold')
      .text(`RISK SCORE: ${assessment.riskScore}/100 — ${(assessment.riskLevel || 'unknown').toUpperCase()} RISK`, 65, yBadge)
    pdf.fillColor(colors.text).fontSize(9).font('Helvetica')
      .text(assessment.recommendation?.toUpperCase() + ': ' + assessment.recommendationReason, 65, yBadge + 16)
    
    pdf.moveDown(3)

    // ── Summary ──────────────────────────────────────────────────────────────
    pdf.fillColor(colors.text).fontSize(10).font('Helvetica')
      .text(assessment.summary || '', 50, pdf.y, { width: pdf.page.width - 100 })
    pdf.moveDown(1.5)

    // ── Document Details ─────────────────────────────────────────────────────
    sectionHeader(pdf, 'DOCUMENT DETAILS', colors)

    const details = [
      ['Document Type', docTypeLabel],
      ['Document Number', doc.documentNumber || '—'],
      ['Document Date', doc.documentDate || '—'],
      ['Language', (doc.detectedLanguage || '—').toUpperCase()],
      ['Currency', doc.currency || '—'],
      ['Payment Terms', doc.paymentTerms || '—'],
    ]
    renderTable(pdf, details, colors)
    pdf.moveDown(1)

    // ── Vendor & Buyer ───────────────────────────────────────────────────────
    const colWidth = (pdf.page.width - 100) / 2 - 10
    const startY = pdf.y

    // Vendor
    pdf.fillColor(colors.primary).fontSize(10).font('Helvetica-Bold')
      .text('FROM (VENDOR/SUPPLIER)', 50, startY)
    pdf.fillColor(colors.text).fontSize(9).font('Helvetica')
    const vendor = doc.vendor || {}
    pdf.text(vendor.name || '—', 50, pdf.y + 4)
    if (vendor.address) pdf.text(vendor.address, 50, pdf.y + 2, { width: colWidth })
    if (vendor.phone) pdf.text('Tel: ' + vendor.phone, 50, pdf.y + 2)
    if (vendor.email) pdf.text('Email: ' + vendor.email, 50, pdf.y + 2)
    if (vendor.trn) pdf.text('TRN: ' + vendor.trn, 50, pdf.y + 2)

    // Buyer
    const buyerX = 50 + colWidth + 20
    pdf.fillColor(colors.primary).fontSize(10).font('Helvetica-Bold')
      .text('TO (BUYER/CLIENT)', buyerX, startY)
    pdf.fillColor(colors.text).fontSize(9).font('Helvetica')
    const buyer = doc.buyer || {}
    pdf.text(buyer.name || '—', buyerX, startY + 16)
    if (buyer.address) pdf.text(buyer.address, buyerX, pdf.y + 2, { width: colWidth })
    if (buyer.phone) pdf.text('Tel: ' + buyer.phone, buyerX, pdf.y + 2)
    if (buyer.email) pdf.text('Email: ' + buyer.email, buyerX, pdf.y + 2)

    pdf.moveDown(2)

    // ── Line Items ───────────────────────────────────────────────────────────
    if (doc.lineItems && doc.lineItems.length > 0) {
      sectionHeader(pdf, 'LINE ITEMS', colors)

      // Table header
      const cols = [200, 60, 80, 80, 80]
      const headers = ['Description', 'Qty', 'Unit', 'Unit Price', 'Total']
      let x = 50
      pdf.fillColor(colors.primary).fontSize(9).font('Helvetica-Bold')
      headers.forEach((h, i) => {
        pdf.text(h, x, pdf.y, { width: cols[i] })
        x += cols[i]
      })
      pdf.moveDown(0.3)
      pdf.rect(50, pdf.y, pdf.page.width - 100, 1).fill(colors.border)
      pdf.moveDown(0.5)

      for (const item of doc.lineItems) {
        x = 50
        const rowData = [
          item.description || '—',
          item.quantity != null ? String(item.quantity) : '—',
          item.unit || '—',
          item.unitPrice != null ? formatCurrency(item.unitPrice, doc.currency) : '—',
          item.total != null ? formatCurrency(item.total, doc.currency) : '—',
        ]
        pdf.fillColor(colors.text).fontSize(9).font('Helvetica')
        const rowY = pdf.y
        rowData.forEach((d, i) => {
          pdf.text(d, x, rowY, { width: cols[i] })
          x += cols[i]
        })
        pdf.moveDown(0.8)
      }

      // Totals
      pdf.rect(50, pdf.y, pdf.page.width - 100, 1).fill(colors.border)
      pdf.moveDown(0.5)

      const totalsX = pdf.page.width - 200
      if (doc.subtotal) renderTotalRow(pdf, 'Subtotal', formatCurrency(doc.subtotal, doc.currency), totalsX, colors)
      if (doc.discount) renderTotalRow(pdf, 'Discount', '-' + formatCurrency(doc.discount, doc.currency), totalsX, colors)
      if (doc.tax) renderTotalRow(pdf, `Tax ${doc.taxRate ? '(' + doc.taxRate + '%)' : ''}`, formatCurrency(doc.tax, doc.currency), totalsX, colors)
      if (doc.total) {
        pdf.rect(totalsX - 10, pdf.y, 160, 1).fill(colors.primary)
        pdf.moveDown(0.3)
        renderTotalRow(pdf, 'TOTAL', formatCurrency(doc.total, doc.currency), totalsX, colors, true)
      }

      pdf.moveDown(1)
    }

    // ── Assessment Flags ─────────────────────────────────────────────────────
    if (assessment.flags && assessment.flags.length > 0) {
      sectionHeader(pdf, 'FLAGS & OBSERVATIONS', colors)
      for (const flag of assessment.flags) {
        const flagColor = flag.severity === 'high' ? colors.danger 
          : flag.severity === 'medium' ? colors.warning : colors.muted
        pdf.fillColor(flagColor).fontSize(9).font('Helvetica-Bold')
          .text(`[${flag.severity?.toUpperCase()}] ${flag.field}: `, 50, pdf.y, { continued: true })
        pdf.fillColor(colors.text).font('Helvetica')
          .text(flag.issue)
        if (flag.recommendation) {
          pdf.fillColor(colors.muted).fontSize(8)
            .text('→ ' + flag.recommendation, 60, pdf.y)
        }
        pdf.moveDown(0.5)
      }
      pdf.moveDown(0.5)
    }

    // ── Blockchain Hash ───────────────────────────────────────────────────────
    pdf.moveDown(1)
    pdf.rect(50, pdf.y, pdf.page.width - 100, 50).fill(colors.primary + '10')
    const hashY = pdf.y + 8
    pdf.fillColor(colors.primary).fontSize(9).font('Helvetica-Bold')
      .text('DOCUMENT HASH (SHA-256)', 60, hashY)
    pdf.fillColor(colors.muted).fontSize(7).font('Courier')
      .text('Pending blockchain anchor — hash will be registered on Polygon network', 60, hashY + 14)
    pdf.fillColor(colors.text).fontSize(7).font('Courier')
      .text('Job ID: ' + jobId, 60, hashY + 26)

    // ── Footer ───────────────────────────────────────────────────────────────
    pdf.moveDown(3)
    pdf.fillColor(colors.muted).fontSize(7).font('Helvetica')
      .text(
        `Generated by Tulip DS · tulipds.com · ${new Date().toISOString()} · This document has been processed using AI-assisted OCR and normalisation. Original document preserved.`,
        50, pdf.y, { width: pdf.page.width - 100, align: 'center' }
      )

    pdf.end()
  })
}

function sectionHeader(pdf, title, colors) {
  pdf.rect(50, pdf.y, pdf.page.width - 100, 22).fill(colors.primary)
  pdf.fillColor('white').fontSize(9).font('Helvetica-Bold')
    .text(title, 58, pdf.y - 16)
  pdf.moveDown(1.2)
}

function renderTable(pdf, rows, colors) {
  for (const [label, value] of rows) {
    pdf.fillColor(colors.muted).fontSize(8).font('Helvetica')
      .text(label + ':', 50, pdf.y, { width: 140, continued: false })
    pdf.fillColor(colors.text).fontSize(9).font('Helvetica-Bold')
      .text(value, 200, pdf.y - 10, { width: pdf.page.width - 250 })
    pdf.moveDown(0.6)
  }
}

function renderTotalRow(pdf, label, value, x, colors, bold = false) {
  pdf.fillColor(colors.muted).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .text(label, x - 10, pdf.y, { width: 80 })
  pdf.fillColor(colors.text).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .text(value, x + 70, pdf.y - 12, { width: 80, align: 'right' })
  pdf.moveDown(0.6)
}

function formatCurrency(amount, currency = 'AED') {
  if (amount == null) return '—'
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function generateBundlePdf(bundleName, crossAnalysis, documents, bundleId) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 50, size: 'A4' })
    const buffers = []

    pdf.on('data', chunk => buffers.push(chunk))
    pdf.on('end', () => resolve(Buffer.concat(buffers)))
    pdf.on('error', reject)

    const colors = {
      primary: '#1a1a2e',
      accent: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      light: '#f8fafc',
      border: '#e2e8f0',
      text: '#374151',
      muted: '#6b7280'
    }

    // ── Header ──────────────────────────────────────────────────
    pdf.rect(0, 0, pdf.page.width, 80).fill(colors.primary)
    pdf.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('TULIP DS', 50, 25)
    pdf.fontSize(10).font('Helvetica')
      .text('Bundle Verification Report', 50, 50)

    pdf.fontSize(12).font('Helvetica-Bold')
      .text('CROSS-ANALYSIS', pdf.page.width - 200, 30, { width: 150, align: 'right' })
    pdf.fontSize(9).font('Helvetica')
      .text(`${documents.length} DOCUMENTS`, pdf.page.width - 200, 50, { width: 150, align: 'right' })

    pdf.moveDown(3)

    // ── Bundle Name ─────────────────────────────────────────────
    pdf.fillColor(colors.text).fontSize(14).font('Helvetica-Bold')
      .text(bundleName, 50, pdf.y)
    pdf.moveDown(0.5)

    // ── Risk Badge ──────────────────────────────────────────────
    const riskColor = crossAnalysis.bundleRiskLevel === 'low' ? colors.accent
      : crossAnalysis.bundleRiskLevel === 'medium' ? colors.warning : colors.danger

    pdf.rect(50, pdf.y, pdf.page.width - 100, 40).fill(riskColor + '20')
    pdf.rect(50, pdf.y, 4, 40).fill(riskColor)

    const yBadge = pdf.y + 8
    pdf.fillColor(riskColor).fontSize(11).font('Helvetica-Bold')
      .text(`BUNDLE RISK: ${crossAnalysis.bundleRiskScore}/100 — ${(crossAnalysis.bundleRiskLevel || 'unknown').toUpperCase()}`, 65, yBadge)
    pdf.fillColor(colors.text).fontSize(9).font('Helvetica')
      .text(`${crossAnalysis.overallRecommendation?.toUpperCase()}: ${crossAnalysis.overallRecommendationReason || ''}`, 65, yBadge + 16)

    pdf.moveDown(3)

    // ── Summary ─────────────────────────────────────────────────
    pdf.fillColor(colors.text).fontSize(10).font('Helvetica')
      .text(crossAnalysis.summary || '', 50, pdf.y, { width: pdf.page.width - 100 })
    pdf.moveDown(1)

    // ── Scores ──────────────────────────────────────────────────
    sectionHeader(pdf, 'SCORES', colors)
    renderTable(pdf, [
      ['Bundle Risk Score', `${crossAnalysis.bundleRiskScore}/100`],
      ['Consistency Score', `${crossAnalysis.consistencyScore}/100`],
      ['Recommendation', (crossAnalysis.overallRecommendation || '—').toUpperCase()],
      ['Documents Analysed', String(documents.length)],
    ], colors)
    pdf.moveDown(1)

    // ── Documents in Bundle ─────────────────────────────────────
    sectionHeader(pdf, 'DOCUMENTS IN BUNDLE', colors)
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      const riskLvl = doc.assessment?.riskLevel || 'unknown'
      const rc = riskLvl === 'low' ? colors.accent : riskLvl === 'medium' ? colors.warning : colors.danger

      pdf.fillColor(colors.text).fontSize(9).font('Helvetica-Bold')
        .text(`${i + 1}. ${doc.filename}`, 50, pdf.y, { continued: true })
      pdf.fillColor(rc).font('Helvetica')
        .text(` — ${(doc.normalised?.documentType || 'unknown').toUpperCase()} · Risk ${doc.assessment?.riskScore || '?'}/100`)
      pdf.moveDown(0.3)
    }
    pdf.moveDown(1)

    // ── Cross-Check Findings ────────────────────────────────────
    if (crossAnalysis.crossChecks && crossAnalysis.crossChecks.length > 0) {
      sectionHeader(pdf, 'CROSS-CHECK FINDINGS', colors)
      for (const check of crossAnalysis.crossChecks) {
        const flagColor = check.severity === 'high' ? colors.danger
          : check.severity === 'medium' ? colors.warning : colors.muted

        pdf.fillColor(flagColor).fontSize(9).font('Helvetica-Bold')
          .text(`[${check.severity?.toUpperCase()}] ${check.checkType?.toUpperCase()}`, 50, pdf.y, { continued: true })
        pdf.fillColor(colors.text).font('Helvetica')
          .text(` (Docs: ${check.documents?.join(', ') || '—'})`)
        pdf.fillColor(colors.text).fontSize(9).font('Helvetica')
          .text(check.finding, 60, pdf.y + 2, { width: pdf.page.width - 120 })
        if (check.recommendation) {
          pdf.fillColor(colors.muted).fontSize(8)
            .text('→ ' + check.recommendation, 60, pdf.y + 2, { width: pdf.page.width - 120 })
        }
        pdf.moveDown(0.8)
      }
      pdf.moveDown(0.5)
    }

    // ── Document Relationships ──────────────────────────────────
    if (crossAnalysis.documentRelationships && crossAnalysis.documentRelationships.length > 0) {
      sectionHeader(pdf, 'DOCUMENT RELATIONSHIPS', colors)
      for (const rel of crossAnalysis.documentRelationships) {
        const d1 = documents[rel.doc1 - 1]?.filename || `Doc ${rel.doc1}`
        const d2 = documents[rel.doc2 - 1]?.filename || `Doc ${rel.doc2}`
        pdf.fillColor(colors.text).fontSize(9).font('Helvetica')
          .text(`${d1}  ↔  ${d2}`, 50, pdf.y, { continued: true })
        pdf.fillColor(colors.muted).font('Helvetica')
          .text(`  — ${rel.relationship} (${rel.confidence} confidence)`)
        pdf.moveDown(0.5)
      }
      pdf.moveDown(0.5)
    }

    // ── Missing Documents ───────────────────────────────────────
    if (crossAnalysis.missingDocuments && crossAnalysis.missingDocuments.length > 0) {
      sectionHeader(pdf, 'MISSING DOCUMENTS', colors)
      for (const missing of crossAnalysis.missingDocuments) {
        pdf.fillColor(colors.warning).fontSize(9).font('Helvetica')
          .text('⚠ ' + missing, 50, pdf.y)
        pdf.moveDown(0.3)
      }
      pdf.moveDown(0.5)
    }

    // ── Footer ──────────────────────────────────────────────────
    pdf.moveDown(2)
    pdf.rect(50, pdf.y, pdf.page.width - 100, 50).fill(colors.primary + '10')
    const hashY = pdf.y + 8
    pdf.fillColor(colors.primary).fontSize(9).font('Helvetica-Bold')
      .text('BUNDLE HASH (SHA-256)', 60, hashY)
    pdf.fillColor(colors.muted).fontSize(7).font('Courier')
      .text('Pending blockchain anchor — hash will be registered on Polygon network', 60, hashY + 14)
    pdf.fillColor(colors.text).fontSize(7).font('Courier')
      .text('Bundle ID: ' + bundleId, 60, hashY + 26)

    pdf.moveDown(3)
    pdf.fillColor(colors.muted).fontSize(7).font('Helvetica')
      .text(
        `Generated by Tulip DS · tulipds.com · ${new Date().toISOString()} · Cross-document verification performed using AI analysis. Individual documents preserved.`,
        50, pdf.y, { width: pdf.page.width - 100, align: 'center' }
      )

    pdf.end()
  })
}

module.exports = { generateOcrPdf, generateBundlePdf }
