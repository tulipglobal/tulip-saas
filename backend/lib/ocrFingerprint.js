const crypto = require('crypto')

/**
 * Generate an OCR text fingerprint from raw OCR text.
 * Normalizes: lowercase, strip whitespace/punctuation, sort words, SHA-256.
 * Same document photographed twice will produce the same fingerprint.
 */
function generateOcrFingerprint(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return null
  }

  // Lowercase
  let normalized = rawText.toLowerCase()

  // Remove all non-alphanumeric characters (keep letters and digits)
  normalized = normalized.replace(/[^a-z0-9]/g, ' ')

  // Split into words, filter empties, sort alphabetically
  const words = normalized.split(/\s+/).filter(w => w.length > 0).sort()

  if (words.length === 0) return null

  // Join and hash
  const joined = words.join(' ')
  return crypto.createHash('sha256').update(joined).digest('hex')
}

module.exports = { generateOcrFingerprint }
