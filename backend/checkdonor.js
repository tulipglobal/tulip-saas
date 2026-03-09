require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./lib/client');
async function main() {
  const user = await prisma.donorUser.findUnique({ where: { email: 'donor@tulipglobal.org' }});
  console.log('User found:', !!user);
  console.log('Hash:', user.passwordHash);
  const match = await bcrypt.compare('donor1234', user.passwordHash);
  console.log('Password match:', match);
}
main().catch(console.error).finally(() => prisma.$disconnect());
