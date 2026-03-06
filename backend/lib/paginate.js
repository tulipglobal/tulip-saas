// ─────────────────────────────────────────────────────────────
//  lib/paginate.js — v1
//
//  Reusable pagination helper for all list endpoints.
//
//  Usage in controller:
//    const { parsePagination, paginatedResponse } = require('../lib/paginate')
//    const { skip, take, page, limit } = parsePagination(req)
//    const [data, total] = await Promise.all([
//      db.project.findMany({ skip, take, ...rest }),
//      db.project.count({ where })
//    ])
//    res.json(paginatedResponse(data, total, page, limit))
//
//  Query params:
//    ?page=1&limit=20
//    ?page=2&limit=50
//
//  Response shape:
//  {
//    data: [...],
//    pagination: {
//      page: 1, limit: 20, total: 143,
//      pages: 8, hasNext: true, hasPrev: false
//    }
//  }
// ─────────────────────────────────────────────────────────────

function parsePagination(req, defaultLimit = 20, maxLimit = 100) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defaultLimit))
  const skip  = (page - 1) * limit
  return { page, limit, skip, take: limit }
}

function paginatedResponse(data, total, page, limit) {
  const pages = Math.ceil(total / limit)
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    }
  }
}

module.exports = { parsePagination, paginatedResponse }
