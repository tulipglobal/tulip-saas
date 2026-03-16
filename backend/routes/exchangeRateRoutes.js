// ─────────────────────────────────────────────────────────────
//  routes/exchangeRateRoutes.js — Exchange rate CRUD + manual fetch
// ─────────────────────────────────────────────────────────────

const router = require('express').Router()
const exchangeRateService = require('../services/exchangeRateService')

// GET /api/exchange-rates?month=2026-03
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    const rates = await exchangeRateService.getRatesForMonth(month)
    res.json({ rates, month })
  } catch (err) {
    console.error('[ExchangeRate] List error:', err)
    res.status(500).json({ error: 'Failed to fetch exchange rates' })
  }
})

// GET /api/exchange-rates/project/:projectId — rates for a specific project
router.get('/project/:projectId', async (req, res) => {
  try {
    const rates = await exchangeRateService.getRatesForProject(req.params.projectId)
    res.json({ rates })
  } catch (err) {
    console.error('[ExchangeRate] Project rates error:', err)
    res.status(500).json({ error: 'Failed to fetch project rates' })
  }
})

// GET /api/exchange-rates/:base/:target/:month — single rate lookup
router.get('/:base/:target/:month', async (req, res) => {
  try {
    const { base, target, month } = req.params
    const rate = await exchangeRateService.getRate(base, target, month)
    if (rate === null) return res.status(404).json({ error: 'Rate not found' })
    res.json({ baseCurrency: base, targetCurrency: target, month, rate })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rate' })
  }
})

// POST /api/exchange-rates/fetch — manually trigger rate fetch (admin)
router.post('/fetch', async (req, res) => {
  try {
    const month = req.body.month || new Date().toISOString().slice(0, 7)
    const result = await exchangeRateService.fetchMonthlyRates(month)
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('[ExchangeRate] Manual fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch rates' })
  }
})

// POST /api/exchange-rates/manual — set rate manually (admin)
router.post('/manual', async (req, res) => {
  try {
    const { baseCurrency, targetCurrency, rate, month } = req.body
    if (!baseCurrency || !targetCurrency || !rate || !month) {
      return res.status(400).json({ error: 'baseCurrency, targetCurrency, rate, and month are required' })
    }
    const result = await exchangeRateService.setManualRate(
      baseCurrency, targetCurrency, parseFloat(rate), month, req.user.id
    )
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Failed to set rate' })
  }
})

// PUT /api/exchange-rates/:id/lock — lock a rate
router.put('/:id/lock', async (req, res) => {
  try {
    await exchangeRateService.lockRate(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to lock rate' })
  }
})

// GET /api/exchange-rates/months — list all months with data
router.get('/months', async (req, res) => {
  try {
    const months = await exchangeRateService.getAvailableMonths()
    res.json({ months })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch months' })
  }
})

// GET /api/exchange-rates/base/:currency?months=2026-03,2026-02 — all rates for a base currency
router.get('/base/:currency', async (req, res) => {
  try {
    const months = req.query.months ? req.query.months.split(',') : null
    const rates = await exchangeRateService.getRatesForBase(req.params.currency, months)
    res.json({ baseCurrency: req.params.currency, rates })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch base rates' })
  }
})

// GET /api/exchange-rates/verify/:month — public, returns sealed hash + tx
router.get('/verify/:month', async (req, res) => {
  try {
    const { month } = req.params
    const rates = await require('../services/exchangeRateService').getRatesForMonth(month)
    const sealed = rates.filter(r => r.sealTxHash)
    if (sealed.length === 0) return res.status(404).json({ error: 'No sealed rates for this month' })

    res.json({
      month,
      rateCount: sealed.length,
      sealTxHash: sealed[0].sealTxHash,
      sealedAt: sealed[0].sealedAt,
      rates: sealed.map(r => ({
        baseCurrency: r.baseCurrency,
        targetCurrency: r.targetCurrency,
        rate: Number(r.rate),
        source: r.source,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify rates' })
  }
})

module.exports = router
