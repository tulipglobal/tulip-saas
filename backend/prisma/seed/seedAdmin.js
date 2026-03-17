// ─────────────────────────────────────────────────────────────
//  seedAdmin.js — Create initial admin user for admin.sealayer.io
//
//  Usage: node backend/prisma/seed/seedAdmin.js
// ─────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const prisma = require('../../lib/client')

async function main() {
  const email = 'admin@sealayer.io'
  const existing = await prisma.adminUser.findUnique({ where: { email } })

  if (existing) {
    console.log(`Admin user already exists: ${email}`)
    return
  }

  const password = crypto.randomBytes(16).toString('base64url')
  const hash = await bcrypt.hash(password, 12)

  const admin = await prisma.adminUser.create({
    data: {
      email,
      name: 'System Admin',
      password: hash,
    },
  })

  console.log('─────────────────────────────────────────')
  console.log('  Admin user created successfully')
  console.log('─────────────────────────────────────────')
  console.log(`  Email:    ${admin.email}`)
  console.log(`  Password: ${password}`)
  console.log(`  ID:       ${admin.id}`)
  console.log('─────────────────────────────────────────')
  console.log('  SAVE THIS PASSWORD — it will not be shown again.')
  console.log('─────────────────────────────────────────')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
