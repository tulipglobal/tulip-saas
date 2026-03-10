// backend/services/documentNormaliser.js
const Anthropic = require('@anthropic-ai/sdk')
const logger = require('../lib/logger')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Strip markdown code fences (```json ... ```) before JSON.parse */
function parseJsonResponse(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '')
  return JSON.parse(cleaned)
}

/**
 * Normalise raw OCR text into a structured clean document using Claude AI
 * Works for any language — Claude will detect and process accordingly
 */
async function normaliseDocument(rawText, keyValuePairs, tables, filename) {
  try {
    const tablesText = tables.length > 0 
      ? '\n\nTABLES DETECTED:\n' + tables.map((t, i) => 
          `Table ${i+1}:\n` + t.map(row => row.join(' | ')).join('\n')
        ).join('\n\n')
      : ''

    const kvText = Object.keys(keyValuePairs).length > 0
      ? '\n\nKEY-VALUE PAIRS DETECTED:\n' + 
        Object.entries(keyValuePairs).map(([k,v]) => `${k}: ${v}`).join('\n')
      : ''

    const prompt = `You are an expert document processor. You have received OCR-extracted text from a document called "${filename}".

Your job is to:
1. Identify the document type (invoice, quote, receipt, purchase order, contract, delivery note, expense claim, etc.)
2. Detect the language(s) used
3. Extract all key fields in a structured format
4. Normalise the document into a clean, professional structure

RAW OCR TEXT:
${rawText}
${kvText}
${tablesText}

Respond with a JSON object only (no markdown, no explanation) in this exact format:
{
  "documentType": "invoice|quote|receipt|purchase_order|contract|delivery_note|expense_claim|other",
  "detectedLanguage": "english|arabic|hindi|urdu|french|mixed|other",
  "documentDate": "YYYY-MM-DD or null",
  "documentNumber": "ref/invoice/quote number or null",
  "vendor": {
    "name": "vendor/supplier name or null",
    "address": "full address or null",
    "phone": "phone or null",
    "email": "email or null",
    "trn": "tax registration number or null"
  },
  "buyer": {
    "name": "buyer/client name or null",
    "address": "full address or null",
    "phone": "phone or null",
    "email": "email or null"
  },
  "lineItems": [
    {
      "description": "item description",
      "quantity": number or null,
      "unit": "unit of measure or null",
      "unitPrice": number or null,
      "total": number or null
    }
  ],
  "subtotal": number or null,
  "tax": number or null,
  "taxRate": number or null,
  "discount": number or null,
  "total": number or null,
  "currency": "AED|USD|EUR|GBP|SAR|other",
  "paymentTerms": "payment terms or null",
  "notes": "any additional notes or null",
  "confidence": "high|medium|low"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].text.trim()
    const parsed = parseJsonResponse(text)
    
    logger.info({ documentType: parsed.documentType, language: parsed.detectedLanguage }, 'Document normalised')
    return parsed

  } catch (err) {
    logger.error({ err }, 'Document normalisation failed')
    throw err
  }
}

/**
 * Assess document legitimacy and flag anomalies using Claude AI
 */
async function assessDocument(normalisedDoc, rawText, context = {}) {
  try {
    const prompt = `You are a financial document fraud analyst and compliance officer. Analyse this document and assess its legitimacy.

DOCUMENT TYPE: ${normalisedDoc.documentType}
LANGUAGE: ${normalisedDoc.detectedLanguage}

STRUCTURED DATA:
${JSON.stringify(normalisedDoc, null, 2)}

RAW TEXT (for reference):
${rawText.substring(0, 2000)}

${context.projectName ? `NGO PROJECT CONTEXT: ${context.projectName}` : ''}
${context.projectBudget ? `PROJECT BUDGET: ${context.projectBudget}` : ''}

Assess this document for:
1. Completeness (are all required fields present?)
2. Mathematical accuracy (do the numbers add up?)
3. Price reasonableness (are prices within expected market ranges?)
4. Vendor legitimacy indicators
5. Red flags (round numbers, missing details, unusual patterns)
6. Compliance with standard document formats
7. Purpose clarity (is it clear what this is for and why?)

Respond with JSON only (no markdown) in this exact format:
{
  "riskScore": 0-100,
  "riskLevel": "low|medium|high",
  "summary": "2-3 sentence plain English summary of what this document is and its overall assessment",
  "purpose": "clear explanation of what this document is for",
  "positives": ["list of good indicators"],
  "flags": [
    {
      "severity": "low|medium|high",
      "field": "which field has the issue",
      "issue": "description of the issue",
      "recommendation": "what to do about it"
    }
  ],
  "mathCheck": {
    "passed": true|false,
    "details": "explanation if failed"
  },
  "completenessScore": 0-100,
  "recommendation": "approve|review|reject",
  "recommendationReason": "brief reason"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].text.trim()
    const parsed = parseJsonResponse(text)

    logger.info({ riskScore: parsed.riskScore, riskLevel: parsed.riskLevel }, 'Document assessed')
    return parsed

  } catch (err) {
    logger.error({ err }, 'Document assessment failed')
    throw err
  }
}

module.exports = { normaliseDocument, assessDocument }
