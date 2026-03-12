const sharp = require('sharp')

/**
 * Compute a perceptual hash (pHash) from an image buffer.
 * Returns a 64-bit hex string (16 hex chars).
 *
 * Algorithm: resize to 32x32 greyscale, compute DCT-like average,
 * threshold each pixel against the mean to produce a 64-bit hash.
 */
async function computePHash(buffer) {
  try {
    // Resize to 32x32 greyscale
    const pixels = await sharp(buffer)
      .greyscale()
      .resize(32, 32, { fit: 'fill' })
      .raw()
      .toBuffer()

    // Take top-left 8x8 block (low-frequency components)
    const block = []
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        block.push(pixels[y * 32 + x])
      }
    }

    // Compute mean (excluding first DC component for better discrimination)
    const mean = block.slice(1).reduce((a, b) => a + b, 0) / (block.length - 1)

    // Generate 64-bit hash: 1 if pixel > mean, 0 otherwise
    let hash = ''
    for (let i = 0; i < 64; i++) {
      hash += block[i] > mean ? '1' : '0'
    }

    // Convert binary string to hex
    let hex = ''
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(hash.substring(i, i + 4), 2).toString(16)
    }

    return hex
  } catch (err) {
    console.error('[pHash] compute failed:', err.message)
    return null
  }
}

/**
 * Compute pHash from a PDF buffer by rendering the first page as an image.
 */
async function computePHashFromPdf(buffer) {
  try {
    // sharp can render first page of PDF if built with poppler/libvips support
    // Fallback: try to render it; if sharp can't handle PDF, return null
    const imgBuffer = await sharp(buffer, { page: 0, density: 150 })
      .png()
      .toBuffer()
    return computePHash(imgBuffer)
  } catch (err) {
    console.error('[pHash] PDF render failed:', err.message)
    return null
  }
}

/**
 * Compute Hamming distance between two hex pHash strings.
 * Returns number of differing bits (0 = identical, 64 = completely different).
 */
function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64

  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16)
    // Count bits in xor
    let bits = xor
    while (bits) {
      distance += bits & 1
      bits >>= 1
    }
  }
  return distance
}

/**
 * Compute pHash from a file buffer, detecting type automatically.
 * Supports images (jpg, png, tiff, webp, gif) and PDFs.
 */
async function computePHashFromFile(buffer, fileType) {
  const ft = (fileType || '').toLowerCase().replace('.', '')
  const isPdf = ft === 'pdf' || ft === 'application/pdf'
  const isImage = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'webp', 'gif',
    'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/gif'].includes(ft)

  if (isPdf) return computePHashFromPdf(buffer)
  if (isImage) return computePHash(buffer)
  return null
}

module.exports = { computePHash, computePHashFromPdf, computePHashFromFile, hammingDistance }
