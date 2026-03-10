// backend/services/ocrService.js
const { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } = require('@aws-sdk/client-textract')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
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

const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'tulipglobal.org'

/**
 * Upload file buffer to S3
 */
async function uploadToS3(buffer, key, mimetype) {
  logger.info({ bucket: BUCKET, key }, 'Uploading to S3')
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }))
  return key
}

/**
 * Extract text from document using AWS Textract.
 * Uses sync AnalyzeDocument for images (single page).
 * Uses async StartDocumentAnalysis for PDFs (multi-page).
 */
async function extractText(s3Key) {
  const isPdf = s3Key.toLowerCase().endsWith('.pdf')

  if (isPdf) {
    return extractTextAsync(s3Key)
  }
  return extractTextSync(s3Key)
}

/**
 * Sync extraction — single-page images only
 */
async function extractTextSync(s3Key) {
  try {
    logger.info({ s3Key }, 'Starting sync Textract extraction')

    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: { Bucket: BUCKET, Name: s3Key }
      },
      FeatureTypes: ['TABLES', 'FORMS']
    })

    const response = await textract.send(command)
    return parseTextractBlocks(response.Blocks, s3Key)

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, s3Key }, 'Sync Textract extraction failed')
    throw err
  }
}

/**
 * Async extraction — multi-page PDFs
 */
async function extractTextAsync(s3Key) {
  try {
    logger.info({ s3Key }, 'Starting async Textract extraction (PDF)')

    // Start the async job
    const startCommand = new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: { Bucket: BUCKET, Name: s3Key }
      },
      FeatureTypes: ['TABLES', 'FORMS']
    })

    const startResult = await textract.send(startCommand)
    const jobId = startResult.JobId
    logger.info({ s3Key, textractJobId: jobId }, 'Textract async job started')

    // Poll for completion (max ~5 min)
    let allBlocks = []
    const maxAttempts = 60
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 5000)) // 5s intervals

      let nextToken = undefined
      let jobStatus = 'IN_PROGRESS'

      do {
        const getCommand = new GetDocumentAnalysisCommand({
          JobId: jobId,
          ...(nextToken && { NextToken: nextToken }),
        })
        const result = await textract.send(getCommand)
        jobStatus = result.JobStatus

        if (jobStatus === 'FAILED') {
          throw new Error(`Textract job failed: ${result.StatusMessage || 'unknown reason'}`)
        }

        if (jobStatus === 'SUCCEEDED') {
          if (result.Blocks) allBlocks = allBlocks.concat(result.Blocks)
          nextToken = result.NextToken
        }
      } while (jobStatus === 'SUCCEEDED' && nextToken)

      if (jobStatus === 'SUCCEEDED') {
        logger.info({ s3Key, textractJobId: jobId, blockCount: allBlocks.length }, 'Textract async job completed')
        return parseTextractBlocks(allBlocks, s3Key)
      }

      // Still IN_PROGRESS, keep polling
    }

    throw new Error('Textract job timed out after 5 minutes')

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, s3Key }, 'Async Textract extraction failed')
    throw err
  }
}

/**
 * Parse Textract blocks into structured result
 */
function parseTextractBlocks(blocks, s3Key) {
  const lines = []
  const keyValuePairs = {}
  const tables = []
  let confidence = 0
  let confidenceCount = 0

  const blockMap = {}
  const keyMap = {}
  const valueMap = {}

  for (const block of blocks) {
    blockMap[block.Id] = block

    if (block.BlockType === 'LINE') {
      lines.push(block.Text || '')
      if (block.Confidence) {
        confidence += block.Confidence
        confidenceCount++
      }
    }

    if (block.BlockType === 'KEY_VALUE_SET') {
      if (block.EntityTypes?.includes('KEY')) {
        keyMap[block.Id] = block
      } else {
        valueMap[block.Id] = block
      }
    }
  }

  // Extract key-value pairs
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
  const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE')
  for (const table of tableBlocks) {
    const tableData = extractTable(table, blockMap)
    if (tableData.length > 0) tables.push(tableData)
  }

  const avgConfidence = confidenceCount > 0 ? confidence / confidenceCount : 0
  const rawText = lines.join('\n')

  logger.info({ s3Key, lineCount: lines.length, confidence: Math.round(avgConfidence) }, 'Textract extraction parsed')

  return {
    rawText,
    lines,
    keyValuePairs,
    tables,
    confidence: Math.round(avgConfidence),
    blockCount: blocks.length
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
