require('dotenv').config()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../prisma/client')

exports.register = async (req, res) => {
  try {
    const { email, name, password, tenantId } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 10)

    let role = await prisma.role.findFirst({
      where: { name: 'member', tenantId }
    })

    if (!role) {
      role = await prisma.role.create({
        data: { name: 'member', tenantId }
      })
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashed,
        tenantId,
        roles: { create: { roleId: role.id } }
      },
      include: { roles: { include: { role: true } } }
    })

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    })

  } catch (err) {
    res.status(500).json({ error: 'Registration failed' })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } }
    })

    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId
      }
    })

  } catch (err) {
    res.status(500).json({ error: 'Login failed' })
  }
}

exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { roles: { include: { role: true } } }
    })

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      roles: user.roles.map(r => r.role.name)
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}
