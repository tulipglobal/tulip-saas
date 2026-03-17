const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// Admin auth check — accepts NGO superadmin or admin panel JWT
async function adminCheck(req, res, next) {
  if (req.user && req.user.role === 'SYSTEM_ADMIN') return next()
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { email: true } })
    if (user?.email === 'info@tulipglobal.org') return next()
  } catch {}
  return res.status(403).json({ error: 'Admin access required' })
}
router.use(adminCheck)

// Articles CRUD
router.get('/articles', async (req, res) => {
  try {
    const articles = await prisma.knowledgeBaseArticle.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] })
    res.json(articles)
  } catch (err) { res.status(500).json({ error: 'Failed to fetch articles' }) }
})

router.post('/articles', async (req, res) => {
  try {
    const { title, slug, content, category, targetRole, isPublished, isFeatured, order } = req.body
    if (!title || !slug || !content || !category || !targetRole) return res.status(400).json({ error: 'Missing required fields' })
    const article = await prisma.knowledgeBaseArticle.create({
      data: { title, slug, content, category, targetRole, isPublished: isPublished || false, isFeatured: isFeatured || false, order: order || 0 }
    })
    res.status(201).json(article)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: 'Failed to create article' })
  }
})

router.patch('/articles/:id', async (req, res) => {
  try {
    const article = await prisma.knowledgeBaseArticle.update({ where: { id: req.params.id }, data: req.body })
    res.json(article)
  } catch (err) { res.status(500).json({ error: 'Failed to update article' }) }
})

router.delete('/articles/:id', async (req, res) => {
  try {
    await prisma.knowledgeBaseArticle.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to delete article' }) }
})

// Categories CRUD
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.knowledgeBaseCategory.findMany({ orderBy: { order: 'asc' } })
    res.json(categories)
  } catch (err) { res.status(500).json({ error: 'Failed to fetch categories' }) }
})

router.post('/categories', async (req, res) => {
  try {
    const { name, slug, description, icon, targetRole, order } = req.body
    if (!name || !slug || !targetRole) return res.status(400).json({ error: 'Missing required fields' })
    const cat = await prisma.knowledgeBaseCategory.create({ data: { name, slug, description, icon, targetRole, order: order || 0 } })
    res.status(201).json(cat)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: 'Failed to create category' })
  }
})

router.patch('/categories/:id', async (req, res) => {
  try {
    const cat = await prisma.knowledgeBaseCategory.update({ where: { id: req.params.id }, data: req.body })
    res.json(cat)
  } catch (err) { res.status(500).json({ error: 'Failed to update category' }) }
})

router.delete('/categories/:id', async (req, res) => {
  try {
    await prisma.knowledgeBaseCategory.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to delete category' }) }
})

module.exports = router
