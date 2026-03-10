// One-time script: Set CORS policy on S3 bucket for presigned URL access
// Usage: node scripts/set-s3-cors.js

require('dotenv').config()

const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3')

const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'tulipglobal.org'
const REGION = process.env.AWS_REGION || 'ap-south-1'

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

async function main() {
  console.log(`Setting CORS on bucket: ${BUCKET} (region: ${REGION})`)

  await s3.send(new PutBucketCorsCommand({
    Bucket: BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [
            'https://verify.tulipds.com',
            'https://tulipds.com',
            'https://api.tulipds.com',
          ],
          AllowedMethods: ['GET', 'HEAD'],
          AllowedHeaders: ['*'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }))

  console.log('CORS policy set successfully.')
}

main().catch(err => {
  console.error('Failed to set CORS:', err.message)
  process.exit(1)
})
