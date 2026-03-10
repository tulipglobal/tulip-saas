// backend/services/ocrService.js
const { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } = require('@aws-sdk/client-textract')
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const logger = require('../lib/logger')

const textract = new TextractClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
})

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
})

const BUCKET = process.env.S3_BUCKET_NAME

/**
 * Upload file buffer to S3
 */
async function uploadToS3(buffer, key, mimetype) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }))
  return key
}

/**
 * Extract text from document using AWS Textract
 * Supports: PDF, PNG, JPG, TIFF
 * Handles: printed text, handwriting, tables, forms
 * Languages: auto-detected by Textract (Arabic, English, Hindi, Urdu, French, etc)
 */
async function extractText(s3Key) {
  try {
    logger.info({ s3Key }, 'Starting Textract extraction')

    // Use AnalyzeDocument for forms/tables (richer extraction)
    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: BUCKET,
          Name: s3Key,
        }
      },
      FeatureTypes: ['TABLES', 'FORMS', 'SIGNATURES']
    })

    const response = await textract.send(command)
    
    // Extract all text blocks
    const lines = []
    const keyValuePairs = {}
    const tables = []
    let confidence = 0
    let confidenceCount = 0

    for (const block of response.Blocks) {
      if (block.BlockType === 'LINE') {
        lines.push(block.Text || '')
        if (block.Confidence) {
          confidence += block.Confidence
          confidenceCount++
        }
      }
    }

    // Extract key-value pairs (form fields)
    const keyMap = {}
    const valueMap = {}
    const blockMap = {}

    for (const block of response.Blocks) {
      blockMap[block.Id] = block
      if (block.BlockType === 'KEY_VALUE_SET') {
        if (block.EntityTypes?.includes('KEY')) {
          keyMap[block.Id] = block
        } else {
          valueMap[block.Id] = block
        }
      }
    }

    for (const keyBlock of Object.values(keyMap)) {
      const keyText = getText(keyBlock, blockMap)
      const valueBlock = getValueBlock(keyBlock, valueMap)
      if (valueBlock) {
        const valueText = getText(valueBlock, blockMap)
        if (keyText && valueText) {
          keyValuePairs[keyText.trim()] = valueText.trim()
        }
      }
    }

    // Extract tables
    const tableBlocks = response.Blocks.filter(b => b.BlockType === 'TABLE')
    for (const table of tableBlocks) {
      const tableData = extractTable(table, blockMap)
      if (tableData.length > 0) tables.push(tableData)
    }

    const avgConfidence = confidenceCount > 0 ? confidence / confidenceCount : 0
    const rawText = lines.join('\n')

    logger.info({ s3Key, lineCount: lines.length, confidence: avgConfidence }, 'Textract extraction complete')

    return {
      rawText,
      lines,
      keyValuePairs,
      tables,
      confidence: Math.round(avgConfidence),
      blockCount: response.Blocks.length
    }

  } catch (err) {
    logger.error({ err, s3Key }, 'Textract extraction failed')
    throw err
  }
}

function getText(block, blockMap) {
  let text = ''
  if (block.Relationships) {
    for (const rel of block.Relationships) {
      if (rel.Type === 'CHILD') {
        for (const childId of rel.Ids) {
          const child = blockMap[childId]
          if (child?.BlockType === 'WORD') text += child.Text + ' '
        }
      }
    }
  }
  return text.trim()
}

function getValueBlock(keyBlock, valueMap) {
  if (keyBlock.Relationships) {
    for (const rel of keyBlock.Relationships) {
      if (rel.Type === 'VALUE') {
        for (const valueId of rel.Ids) {
          if (valueMap[valueId]) return valueMap[valueId]
        }
      }
    }
  }
  return null
}

function extractTable(tableBlock, blockMap) {
  const cells = {}
  if (tableBlock.Relationships) {
    for (const rel of tableBlock.Relationships) {
      if (rel.Type === 'CHILD') {
        for (const cellId of rel.Ids) {
          const cell = blockMap[cellId]
          if (cell?.BlockType === 'CELL') {
            const row = cell.RowIndex
            const col = cell.ColumnIndex
            if (!cells[row]) cells[row] = {}
            cells[row][col] = getText(cell, blockMap)
          }
        }
      }
    }
  }
  return Object.values(cells).map(row => Object.values(row))
}

module.exports = { extractText, uploadToS3 }
