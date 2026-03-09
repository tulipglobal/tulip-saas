// ─────────────────────────────────────────────────────────────
//  lib/documentCategories.js — shared key document categories
// ─────────────────────────────────────────────────────────────

const KEY_DOCUMENT_CATEGORIES = [
  'licence',
  'certificate',
  'contract',
  'permit',
  'insurance',
  'visa',
  'id_document',
  'mou',
]

function isKeyCategory(category) {
  return KEY_DOCUMENT_CATEGORIES.includes((category || '').toLowerCase())
}

module.exports = { KEY_DOCUMENT_CATEGORIES, isKeyCategory }
