const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const crypto = require('crypto')
const path = require('path')

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
})

const BUCKET = process.env.S3_BUCKET || 'tulipglobal.org'

async function uploadToS3(fileBuffer, originalName, tenantId, folder = 'documents') {
  const ext = path.extname(originalName).toLowerCase()
  const timestamp = Date.now()
  const random = crypto.randomBytes(8).toString('hex')
  const key = `${folder}/${tenantId}/${timestamp}-${random}${ext}`

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: getContentType(ext),
    ServerSideEncryption: 'AES256',
  }))

  const fileUrl = `https://${BUCKET}.s3.ap-south-1.amazonaws.com/${key}`
  return { fileUrl, key }
}

function computeSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function getContentType(ext) {
  const map = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.svg': 'image/svg+xml',
  }
  return map[ext] || 'application/octet-stream'
}

async function getPresignedUrl(fileUrl, expiresIn = 3600) {
  try {
    const url = new URL(fileUrl)
    const key = url.pathname.substring(1)
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
    return await getSignedUrl(s3, command, { expiresIn })
  } catch (err) {
    console.error('Presign error:', err)
    return null
  }
}

async function getPresignedUrlFromKey(key, expiresIn = 3600, options = {}) {
  try {
    const params = { Bucket: BUCKET, Key: key }
    if (options.contentType) {
      params.ResponseContentType = options.contentType
      params.ResponseContentDisposition = 'inline'
    }
    const command = new GetObjectCommand(params)
    return await getSignedUrl(s3, command, { expiresIn })
  } catch (err) {
    console.error('Presign error:', err)
    return null
  }
}

module.exports = { uploadToS3, computeSHA256, getPresignedUrl, getPresignedUrlFromKey }
