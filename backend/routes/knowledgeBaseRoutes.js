const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// GET /api/kb/articles
router.get('/articles', async (req, res) => {
  try {
    const { role, category, search } = req.query
    const where = { isPublished: true }
    if (role) where.targetRole = { in: [role, 'both'] }
    if (category) where.category = category
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } }
    ]
    const articles = await prisma.knowledgeBaseArticle.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, slug: true, category: true, targetRole: true, isFeatured: true, viewCount: true, createdAt: true, updatedAt: true }
    })
    res.json(articles)
  } catch (err) {
    console.error('KB articles error:', err)
    res.status(500).json({ error: 'Failed to fetch articles' })
  }
})

// GET /api/kb/articles/:slug
router.get('/articles/:slug', async (req, res) => {
  try {
    const article = await prisma.knowledgeBaseArticle.findUnique({ where: { slug: req.params.slug } })
    if (!article || !article.isPublished) return res.status(404).json({ error: 'Article not found' })
    await prisma.knowledgeBaseArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } })
    res.json({ ...article, viewCount: article.viewCount + 1 })
  } catch (err) {
    console.error('KB article error:', err)
    res.status(500).json({ error: 'Failed to fetch article' })
  }
})

// GET /api/kb/categories
router.get('/categories', async (req, res) => {
  try {
    const { role } = req.query
    const where = {}
    if (role) where.targetRole = { in: [role, 'both'] }
    const categories = await prisma.knowledgeBaseCategory.findMany({ where, orderBy: { order: 'asc' } })
    // Add article count per category
    const result = await Promise.all(categories.map(async (cat) => {
      const count = await prisma.knowledgeBaseArticle.count({ where: { category: cat.slug, isPublished: true, targetRole: role ? { in: [role, 'both'] } : undefined } })
      return { ...cat, articleCount: count }
    }))
    res.json(result)
  } catch (err) {
    console.error('KB categories error:', err)
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

// GET /api/kb/search?q=
router.get('/search', async (req, res) => {
  try {
    const { q, role } = req.query
    if (!q || q.length < 2) return res.json([])
    const where = {
      isPublished: true,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } }
      ]
    }
    if (role) where.targetRole = { in: [role, 'both'] }
    const articles = await prisma.knowledgeBaseArticle.findMany({
      where,
      take: 20,
      orderBy: { viewCount: 'desc' },
      select: { id: true, title: true, slug: true, category: true, targetRole: true, viewCount: true }
    })
    res.json(articles)
  } catch (err) {
    console.error('KB search error:', err)
    res.status(500).json({ error: 'Search failed' })
  }
})

// POST /api/kb/articles/:slug/feedback
router.post('/articles/:slug/feedback', async (req, res) => {
  try {
    const { helpful } = req.body
    if (typeof helpful !== 'boolean') return res.status(400).json({ error: 'helpful (boolean) is required' })
    // V1: acknowledge only — store feedback in a future release
    res.json({ success: true })
  } catch (err) {
    console.error('KB feedback error:', err)
    res.status(500).json({ error: 'Failed to submit feedback' })
  }
})

// GET /api/kb/featured
router.get('/featured', async (req, res) => {
  try {
    const { role } = req.query
    const where = { isPublished: true, isFeatured: true }
    if (role) where.targetRole = { in: [role, 'both'] }
    const articles = await prisma.knowledgeBaseArticle.findMany({
      where,
      orderBy: { order: 'asc' },
      select: { id: true, title: true, slug: true, category: true, targetRole: true, viewCount: true }
    })
    res.json(articles)
  } catch (err) {
    console.error('KB featured error:', err)
    res.status(500).json({ error: 'Failed to fetch featured' })
  }
})

module.exports = router
