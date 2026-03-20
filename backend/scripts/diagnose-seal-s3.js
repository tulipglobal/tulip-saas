// Diagnostic: test the full seal → S3 → presigned URL → fetch chain
// Usage: node scripts/diagnose-seal-s3.js

require('dotenv').config()
const prisma = require('../lib/client')
const { getPresignedUrlFromKey, headObject } = require('../lib/s3Upload')
const https = require('https')
const http = require('http')

function httpHead(url) {
  return new Promise(resolve => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.request(url, { method: 'HEAD' }, res => {
      resolve({ status: res.statusCode, headers: Object.fromEntries(Object.entries(res.headers)) })
    })
    req.on('error', err => resolve({ status: 0, error: err.message }))
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }) })
    req.end()
  })
}

function httpGet(url) {
  return new Promise(resolve => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, res => {
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], bodyLength: body.length, bodyPreview: body.substring(0, 500) }))
    }).on('error', err => resolve({ status: 0, error: err.message }))
  })
}

async function main() {
  console.log('=== SEAL S3 DIAGNOSTIC ===\n')

  // 1. Check env vars
  console.log('1. Environment:')
  console.log('   AWS_REGION:', process.env.AWS_REGION || '(not set, defaults to ap-south-1)')
  console.log('   S3_BUCKET:', process.env.S3_BUCKET || '(not set, defaults to tulipglobal.org)')
  console.log('   AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'NOT SET')
  console.log('   AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'set (' + process.env.AWS_SECRET_ACCESS_KEY.length + ' chars)' : 'NOT SET')
  console.log()

  // 2. Find recent seals with s3Key
  const seals = await prisma.trustSeal.findMany({
    where: { s3Key: { not: null } },
    select: { id: true, s3Key: true, fileType: true, documentTitle: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  console.log(`2. Found ${seals.length} seals with s3Key:\n`)

  if (seals.length === 0) {
    console.log('   No seals with files found. Nothing to test.')
    await prisma.$disconnect()
    return
  }

  for (const seal of seals) {
    console.log(`--- Seal: ${seal.id} ---`)
    console.log(`   Title: ${seal.documentTitle}`)
    console.log(`   FileType: ${seal.fileType}`)
    console.log(`   s3Key: ${seal.s3Key}`)
    console.log(`   Created: ${seal.createdAt}`)

    // Resolve key (handle legacy full URLs)
    let key = seal.s3Key
    if (key.startsWith('http')) {
      try { key = decodeURIComponent(new URL(key).pathname.substring(1)) } catch {}
      console.log(`   Resolved key: ${key}`)
    }

    // 3. HEAD check on S3 directly
    console.log('\n   3a. HEAD check (direct S3):')
    const head = await headObject(key)
    console.log(`       exists: ${head.exists}, notFound: ${head.notFound || false}, error: ${head.error || 'none'}`)

    // 4. Generate presigned URL
    console.log('\n   3b. Presigned URL generation:')
    const presignedUrl = await getPresignedUrlFromKey(key, 3600, {
      contentType: seal.fileType || undefined,
    })
    if (!presignedUrl) {
      console.log('       FAILED — getPresignedUrlFromKey returned null')
      console.log()
      continue
    }
    console.log(`       URL: ${presignedUrl.substring(0, 120)}...`)
    console.log(`       URL length: ${presignedUrl.length}`)

    // Parse the URL to check structure
    try {
      const parsed = new URL(presignedUrl)
      console.log(`       Host: ${parsed.host}`)
      console.log(`       Protocol: ${parsed.protocol}`)
      console.log(`       Path: ${parsed.pathname}`)
    } catch (e) {
      console.log(`       URL PARSE ERROR: ${e.message}`)
    }

    // 5. HEAD request on presigned URL
    console.log('\n   3c. HEAD request on presigned URL:')
    const headResult = await httpHead(presignedUrl)
    console.log(`       Status: ${headResult.status}`)
    if (headResult.error) console.log(`       Error: ${headResult.error}`)
    if (headResult.headers) {
      console.log(`       Content-Type: ${headResult.headers['content-type'] || 'not set'}`)
      console.log(`       Content-Length: ${headResult.headers['content-length'] || 'not set'}`)
    }

    // 6. GET request on presigned URL (only first 500 bytes to check response)
    console.log('\n   3d. GET request on presigned URL:')
    const getResult = await httpGet(presignedUrl)
    console.log(`       Status: ${getResult.status}`)
    console.log(`       Content-Type: ${getResult.contentType}`)
    console.log(`       Body length: ${getResult.bodyLength}`)
    if (getResult.status !== 200 || (getResult.contentType && getResult.contentType.includes('xml'))) {
      console.log(`       Body preview: ${getResult.bodyPreview}`)
    } else {
      console.log(`       Body: (binary data, looks good)`)
    }
    if (getResult.error) console.log(`       Error: ${getResult.error}`)

    console.log('\n')
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Diagnostic failed:', err)
  process.exit(1)
})
